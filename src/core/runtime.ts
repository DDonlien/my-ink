import { FakeActionExecutor, actorLabel, durationHours, parseCommand, placeLabel, statusLabel } from './actions';
import type { Action, ActionStatus, ChoiceGroup, CompiledDocument, Instance, LogEntry, RuntimeSnapshot, TranscriptEntry, WorldValue } from './types';

export interface RunnerOptions { autoExpandDialogue?: boolean }

export class StoryRunner {
  private story;
  private serial = 0;
  private queue: string[] = [];
  private draining = false;
  private fired = new Set<string>();
  private sessionFired = new Set<string>();
  private observed: Record<string, WorldValue> = {};
  time = 8;
  instances: Instance[] = [];
  actions: Action[] = [];
  transcript: TranscriptEntry[] = [];
  logs: LogEntry[] = [];
  halted = false;
  autoExpandDialogue: boolean;

  private assertLive() {
    if (this.halted) throw new Error('预演因剧情循环暂停，请修正后从头预演。');
  }
  private continueLine() {
    // Bound a single Ink continuation too: an invisible divert loop can never
    // yield a text line and would otherwise freeze the authoring UI.
    let slices = 0;
    do {
      this.story.ContinueAsync(8);
      if (++slices >= 12 && !this.story.asyncContinueComplete) {
        this.halted = true;
        throw new Error('这段 Ink 长时间没有产生输出，可能存在循环。请修正后从头预演。');
      }
    } while (!this.story.asyncContinueComplete);
    return this.story.currentText || '';
  }

  static executionKey(document: CompiledDocument) {
    return JSON.stringify([document.generatedInk, document.knots.map(k => [k.id, k.name, k.on, k.when, k.once])]);
  }
  rebaseDocument(document: CompiledDocument) {
    if (StoryRunner.executionKey(document) !== StoryRunner.executionKey(this.document)) throw new Error('剧情已改变，请重新预演。');
    const translate = (line?: number) => {
      if (!line) return line;
      const index = this.document.lineMap.indexOf(line);
      return index >= 0 ? document.lineMap[index] : line;
    };
    for (const entry of [...this.logs, ...this.transcript]) entry.line = translate(entry.line);
    for (const action of this.actions) action.line = translate(action.line)!;
    for (const instance of this.instances) {
      instance.line = translate(instance.line)!;
      instance.title = document.knots.find(k => k.name === instance.knot)?.title || instance.title;
    }
    this.document = document;
  }

  constructor(public document: CompiledDocument, public executor = new FakeActionExecutor(), autostart = true, options: RunnerOptions = {}) {
    this.autoExpandDialogue = options.autoExpandDialogue ?? true;
    this.story = document.createStory();
    this.story.BindExternalFunction('__loom_barrier', () => 0, false);
    this.story.onError = (message, type) => {
      if (type === 2) throw new Error(message);
      this.log('error', message);
    };
    for (const name of document.variables) {
      this.observed[name] = this.story.variablesState.$(name) as WorldValue;
      this.story.ObserveVariable(name, (key, value) => {
        if (this.observed[key] === value) return;
        const previous = this.observed[key];
        this.observed[key] = value;
        this.log('state', key, String(previous) + ' → ' + String(value), this.currentInstance()?.line);
        this.enqueue('world.changed');
      });
    }
    if (autostart) {
      this.log('story', '预演已开始', document.title);
      const entries = document.knots.filter(k => k.on);
      if (entries.length) this.dispatch('start');
      else {
        const instance = this.newInstance('__root', '故事', document.knots[0]?.range.line || 1);
        instance.id = this.story.currentFlowName;
        this.pump(instance);
        this.drain();
      }
    }
  }

  get world(): Record<string, WorldValue> {
    return Object.fromEntries(this.document.variables.map(name => [name, this.story.variablesState.$(name) as WorldValue]));
  }
  get events() { return [...new Set(this.document.knots.map(k => k.on).filter((on): on is string => Boolean(on) && on !== 'start' && on !== 'world.changed'))]; }
  get continuations() { return this.instances.filter(instance => instance.status === 'continue'); }
  get choices(): ChoiceGroup[] {
    const original = this.story.currentFlowName;
    const groups = this.instances.filter(i => i.status === 'choices').map(instance => {
      this.story.SwitchFlow(instance.id);
      return { instanceId: instance.id, title: instance.title, choices: this.story.currentChoices.map(choice => ({ index: choice.index, text: choice.text })) };
    });
    this.story.SwitchFlow(original);
    return groups;
  }
  private currentInstance() { return this.instances.find(i => i.id === this.story.currentFlowName); }
  private log(kind: LogEntry['kind'], title: string, detail?: string, line?: number) {
    this.logs.push({ id: ++this.serial, time: this.time, kind, title, detail, line });
    if (this.logs.length > 1000) this.logs.shift();
  }
  private enqueue(event: string) { if (!this.queue.includes(event)) this.queue.push(event); }
  private newInstance(knot: string, title: string, line: number) {
    const instance: Instance = { id: 'flow_' + ++this.serial, knot, title, line, status: 'running', handles: {} };
    this.instances.push(instance);
    return instance;
  }
  private checkVariable(name: string) {
    if (!this.document.variables.includes(name)) throw new Error('变量未声明：' + name + '。请在 Ink 中添加 VAR。');
  }
  private setVariable(name: string, value: WorldValue) {
    this.checkVariable(name);
    this.story.variablesState.$(name, value);
  }
  setWorld(name: string, value: WorldValue) {
    this.assertLive();
    const existing = this.world[name];
    if (typeof existing !== typeof value) throw new Error('请保持变量 ' + name + ' 的类型为 ' + typeof existing + '。');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('请输入有效数字。');
    this.setVariable(name, value);
    this.cancelMissingActors();
    this.drain();
  }
  dispatch(event: string) {
    this.assertLive();
    this.log('event', event);
    this.enqueue(event);
    this.drain();
  }
  private drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      let count = 0;
      while (this.queue.length) {
        if (this.halted) { this.queue = []; break; }
        if (++count > 100) { this.log('error', '事件循环已停止', '请检查重复触发的剧情规则。'); this.queue = []; break; }
        const event = this.queue.shift()!;
        if (event === 'world.changed') this.cancelMissingActors();
        for (const knot of this.document.knots.filter(k => k.on === event)) {
          if (this.halted) break;
          if (this.instances.some(i => i.knot === knot.name && !['completed', 'error'].includes(i.status))) continue;
          if ((knot.once === 'save' && this.fired.has(knot.id)) || (knot.once === 'session' && this.sessionFired.has(knot.id))) continue;
          if (knot.when && !this.story.EvaluateFunction('__loom_when_' + knot.name)) continue;
          if (knot.once === 'save') this.fired.add(knot.id);
          if (knot.once === 'session') this.sessionFired.add(knot.id);
          const instance = this.newInstance(knot.name, knot.title, knot.range.line);
          this.story.SwitchFlow(instance.id);
          this.story.ChoosePathString(knot.name);
          this.log('story', '启动 · ' + knot.title, event, knot.range.line);
          this.pump(instance);
        }
      }
    } finally { this.draining = false; }
  }
  private pump(instance: Instance) {
    this.story.SwitchFlow(instance.id);
    instance.status = 'running';
    try {
      let count = 0;
      while (this.story.canContinue && !instance.waiting) {
        if (++count > 500) throw new Error('单次推进超过 500 行，请检查无出口的剧情循环。');
        const text = this.continueLine().trim();
        if (!text) continue;
        const command = text.match(/^>>> __loom_(c\d+)\s+([\s\S]+)$/);
        if (!command && text.includes('>>> __loom_')) throw new Error('行为语句需要独立输出，请移除与它连接的 Ink glue（<>）。');
        if (command) {
          const source = this.document.commands.find(c => c.id === command[1]);
          instance.line = source?.line || instance.line;
          this.runCommand(command[2], instance);
          continue;
        }
        const speakerTag = this.story.currentTags?.find(tag => tag.startsWith('speaker:'))?.slice(8).trim();
        const spoken = text.match(/^([^：:\n]{1,20})[：:]\s*([\s\S]+)$/);
        const sourceLine = this.findTextLine(text, instance.knot);
        this.transcript.push({
          id: ++this.serial, time: this.time, instanceId: instance.id, line: sourceLine,
          kind: speakerTag || spoken ? 'dialogue' : 'narration',
          speaker: speakerTag || spoken?.[1], text: spoken ? spoken[2] : text,
        });
        if (!this.autoExpandDialogue && this.story.canContinue) {
          instance.status = 'continue';
          return;
        }
      }
      instance.status = instance.waiting ? 'waiting' : this.story.currentChoices.length ? 'choices' : 'completed';
    } catch (error) {
      instance.status = 'error';
      instance.waiting = undefined;
      this.log('error', '剧情暂停 · ' + instance.title, error instanceof Error ? error.message : String(error), instance.line);
    }
  }
  private findTextLine(text: string, knotName: string) {
    const knot = this.document.knots.find(k => k.name === knotName);
    const start = knot?.body.line || 1;
    const lines = (knot?.text || this.document.source).split('\n');
    const index = lines.findIndex(line => line.trim() === text);
    return index >= 0 ? start + index : knot?.range.line;
  }
  private runCommand(text: string, instance: Instance) {
    const { mode, target, args } = parseCommand(text);
    if (mode === 'emit') {
      if (!args.event) throw new Error('emit 需要 event 参数。');
      if (Object.keys(args).some(key => key !== 'event')) throw new Error('emit 只接受 event 参数。');
      this.log('event', args.event, instance.title, instance.line);
      this.enqueue(args.event);
      return;
    }
    if (args.result) this.checkVariable(args.result);
    if (!target.includes('.')) {
      if (mode !== 'await' || Object.keys(args).some(key => key !== 'result')) throw new Error('等待句柄只接受 result 参数。');
      const action = this.actions.find(a => a.id === instance.handles[target]);
      if (!action) throw new Error('找不到行为句柄：' + target);
      this.waitFor(instance, action, args.result);
      return;
    }
    if (!this.executor.supports(target)) throw new Error('尚未注册行为：' + target + '。预演器不会自动假定它成功。');
    if (!args.actor || !args.to || !args.duration) throw new Error(target + ' 需要 actor、to 和 duration 参数。');
    if (Object.keys(args).some(key => !['actor', 'to', 'duration', 'result', 'as'].includes(key))) throw new Error('行为包含未支持的参数。');
    if (mode === 'start' && !args.as) throw new Error('start 需要 as=句柄，以便后续等待。');
    if (mode === 'start' && args.result) throw new Error('请在 await 句柄时指定 result。');
    if (mode === 'await' && args.as) throw new Error('await 行为不接受 as 参数。');
    if (args.as && instance.handles[args.as]) throw new Error('行为句柄重复：' + args.as);
    const action: Action = {
      id: 'action_' + ++this.serial, type: target, actor: args.actor, destination: args.to,
      started: this.time, due: this.time + durationHours(args.duration), status: 'running',
      instanceId: instance.id, line: instance.line,
    };
    const busy = this.actions.some(a => a.actor === action.actor && a.status === 'running');
    action.status = busy ? 'blocked' : this.executor.start(action, { get: n => this.world[n], set: (n, v) => this.setVariable(n, v) });
    this.actions.push(action);
    if (args.as) instance.handles[args.as] = action.id;
    this.log('action', actorLabel(action.actor) + ' → ' + placeLabel(action.destination), busy ? '角色已有进行中的行为，本次请求受阻。' : statusLabel(action.status), action.line);
    this.transcript.push({
      id: ++this.serial, time: this.time, kind: 'action', instanceId: instance.id, line: action.line,
      text: actorLabel(action.actor) + '前往' + placeLabel(action.destination) + ' · ' + args.duration + ' · ' + statusLabel(action.status),
    });
    if (mode === 'await') this.waitFor(instance, action, args.result);
  }
  private waitFor(instance: Instance, action: Action, result?: string) {
    if (action.status === 'running') instance.waiting = { actionId: action.id, result };
    else if (result) this.setVariable(result, action.status);
  }
  choose(instanceId: string, index: number) {
    this.assertLive();
    const instance = this.instances.find(i => i.id === instanceId && i.status === 'choices');
    if (!instance) throw new Error('这段剧情当前没有可选项。');
    this.story.SwitchFlow(instance.id);
    const choice = this.story.currentChoices.find(c => c.index === index);
    if (!choice) throw new Error('找不到这个选项。');
    this.transcript.push({ id: ++this.serial, time: this.time, kind: 'choice', text: choice.text, instanceId, line: instance.line });
    this.story.ChooseChoiceIndex(index);
    this.pump(instance);
    this.drain();
  }
  continueDialogue(instanceId: string) {
    this.assertLive();
    const instance = this.instances.find(instance => instance.id === instanceId && instance.status === 'continue');
    if (!instance) throw new Error('这段对话当前不需要继续。');
    this.transcript.push({ id: ++this.serial, time: this.time, kind: 'continue', text: '点击继续', instanceId, line: instance.line });
    this.pump(instance);
    this.drain();
  }
  setAutoExpandDialogue(enabled: boolean) {
    this.assertLive();
    this.autoExpandDialogue = enabled;
    if (enabled) {
      for (const instance of [...this.continuations]) this.pump(instance);
      this.drain();
    }
  }
  completeAction(id: string, status: Exclude<ActionStatus, 'running'> = 'completed') {
    this.assertLive();
    const action = this.actions.find(a => a.id === id);
    if (!action || action.status !== 'running') throw new Error('行为已结束或不存在。');
    if (this.world[action.actor + '_alive'] === false) status = 'actor_missing';
    this.finishAction(action, status);
    this.drain();
  }
  private finishAction(action: Action, status: Exclude<ActionStatus, 'running'>) {
    action.status = status;
    this.executor.finish(action, status, { get: n => this.world[n], set: (n, v) => this.setVariable(n, v) });
    this.log('action', actorLabel(action.actor) + ' · ' + statusLabel(status), placeLabel(action.destination), action.line);
    for (const instance of this.instances.filter(i => i.waiting?.actionId === action.id)) {
      const result = instance.waiting!.result;
      instance.waiting = undefined;
      if (result) this.setVariable(result, status);
      this.pump(instance);
    }
  }
  private cancelMissingActors() {
    for (const action of this.actions.filter(a => a.status === 'running' && this.world[a.actor + '_alive'] === false)) this.finishAction(action, 'actor_missing');
  }
  advance(hours: number) {
    this.assertLive();
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) throw new Error('请输入有效的推进时长。');
    const target = this.time + hours;
    let count = 0;
    while (true) {
      const next = this.actions.filter(a => a.status === 'running' && a.due <= target).sort((a, b) => a.due - b.due)[0];
      if (!next) break;
      if (++count > 500) throw new Error('时间推进产生了过多行为，请检查循环。');
      this.time = next.due;
      const status = this.world[next.actor + '_alive'] === false ? 'actor_missing' : 'completed';
      this.finishAction(next, status);
      this.drain();
    }
    this.time = target;
    this.log('event', '世界时间推进', '+' + hours + ' 小时');
    this.drain();
  }
  snapshot(): RuntimeSnapshot {
    this.assertLive();
    return JSON.parse(JSON.stringify({
      schema: 1, fingerprint: this.document.fingerprint, inkState: this.story.state.ToJson(),
      time: this.time, serial: this.serial, instances: this.instances, actions: this.actions,
      transcript: this.transcript, logs: this.logs, fired: [...this.fired],
      autoExpandDialogue: this.autoExpandDialogue,
    }));
  }
  static restore(document: CompiledDocument, input: unknown): StoryRunner {
    const snapshot = input as RuntimeSnapshot;
    if (!snapshot || snapshot.schema !== 1 || snapshot.fingerprint !== document.fingerprint) throw new Error('存档与当前剧情文档不匹配。');
    if (!Number.isFinite(snapshot.time) || snapshot.time < 0 || !Number.isSafeInteger(snapshot.serial) || snapshot.serial < 0 ||
      typeof snapshot.inkState !== 'string' || (snapshot.autoExpandDialogue !== undefined && typeof snapshot.autoExpandDialogue !== 'boolean') || !Array.isArray(snapshot.instances) || !Array.isArray(snapshot.actions) ||
      !Array.isArray(snapshot.logs) || !Array.isArray(snapshot.transcript) || !Array.isArray(snapshot.fired)) throw new Error('进度文件已损坏。');
    const runner = new StoryRunner(document, new FakeActionExecutor(), false, { autoExpandDialogue: snapshot.autoExpandDialogue });
    runner.story.state.LoadJson(snapshot.inkState);
    const ids = new Set<string>();
    for (const instance of snapshot.instances) {
      if (!instance || typeof instance.id !== 'string' || ids.has(instance.id) || (!runner.story.aliveFlowNames?.includes(instance.id) && instance.id !== 'DEFAULT_FLOW') ||
        !['running', 'continue', 'waiting', 'choices', 'completed', 'error'].includes(instance.status) || !instance.handles ||
        (instance.status === 'waiting' && !instance.waiting)) throw new Error('存档中的剧情实例无效。');
      ids.add(instance.id);
      if (instance.waiting?.result && !document.variables.includes(instance.waiting.result)) throw new Error('存档中的结果变量无效。');
      if (instance.status === 'continue') {
        const original = runner.story.currentFlowName;
        runner.story.SwitchFlow(instance.id);
        const valid = runner.story.canContinue && !instance.waiting;
        runner.story.SwitchFlow(original);
        if (!valid) throw new Error('存档中的顺序对话位置无效。');
      }
    }
    for (const action of snapshot.actions) {
      if (!action || !ids.has(action.instanceId) || !runner.executor.supports(action.type) || !Number.isFinite(action.started) ||
        !Number.isFinite(action.due) || action.due <= action.started || (action.status === 'running' && action.due < snapshot.time) ||
        !['running', 'completed', 'blocked', 'cancelled', 'actor_missing'].includes(action.status)) throw new Error('存档中的行为无效。');
    }
    if (snapshot.instances.some(i => i.waiting && !snapshot.actions.some(a => a.id === i.waiting!.actionId && a.status === 'running'))) throw new Error('存档缺少等待中的行为。');
    runner.time = snapshot.time;
    runner.serial = snapshot.serial;
    runner.instances = structuredClone(snapshot.instances);
    runner.actions = structuredClone(snapshot.actions);
    runner.transcript = structuredClone(snapshot.transcript);
    runner.logs = structuredClone(snapshot.logs);
    runner.fired = new Set(snapshot.fired);
    runner.observed = runner.world;
    runner.log('story', '进度已恢复', '未完成行为将从保存的时间继续。');
    return runner;
  }
}
