import { describe, expect, it } from 'vitest';
import { compileDocument, DocumentError, parseStoryDocument, replaceJump, replaceKnotBody, writeLayout } from '../src/core/document';
import { StoryRunner } from '../src/core/runtime';
import merchant from './fixtures/legacy-journey.md?raw';
import lighthouse from './fixtures/plain-choices.md?raw';
import guard from './fixtures/parallel-walk.md?raw';

function relocating() {
  const document = compileDocument(merchant);
  const runner = new StoryRunner(document);
  runner.choose(runner.choices[0].instanceId, 0);
  return { document, runner };
}

describe('真实 Ink 与宿主行为的运行边界', () => {
  it('等待期间不提前赋值；三小时存档恢复后正确完成迁居且不重复触发', () => {
    const { document, runner } = relocating();
    expect(runner.world.road_closed).toBe(true);
    expect(runner.world.merchant_relocated).toBe(false);
    expect(runner.world.merchant_location).toBe('town_b');
    expect(runner.world.travel_result).toBe('');
    expect(runner.actions).toHaveLength(1);
    expect(runner.instances.find(i => i.knot === 'merchant_relocate')?.status).toBe('waiting');
    runner.advance(3);
    const restored = StoryRunner.restore(document, runner.snapshot());
    expect(restored.time).toBe(11);
    expect(restored.world.merchant_relocated).toBe(false);
    restored.advance(3);
    expect(restored.time).toBe(14);
    expect(restored.world.merchant_location).toBe('harbor');
    expect(restored.world.merchant_relocated).toBe(true);
    expect(restored.world.travel_result).toBe('completed');
    restored.dispatch('interact.merchant');
    expect(restored.transcript.some(t => t.text.includes('旧路走不通了'))).toBe(true);
    restored.dispatch('world.changed');
    restored.setWorld('merchant_relocated', false);
    expect(restored.actions).toHaveLength(1);
  });
  it('旅行期间其他剧情可以继续，行为失败不改变逻辑位置', () => {
    const { runner } = relocating();
    runner.dispatch('interact.merchant');
    expect(runner.transcript.some(t => t.text.includes('货车还未抵达'))).toBe(true);
    runner.completeAction(runner.actions[0].id, 'blocked');
    expect(runner.world.merchant_location).toBe('town_b');
    expect(runner.world.merchant_relocated).toBe(false);
    expect(runner.world.travel_result).toBe('blocked');
    runner.advance(6);
    expect(runner.world.merchant_relocated).toBe(false);
  });
  it('角色死亡会终止进行中的行为并返回 actor_missing', () => {
    const { runner } = relocating();
    runner.setWorld('merchant_alive', false);
    expect(runner.actions[0].status).toBe('actor_missing');
    expect(runner.world.travel_result).toBe('actor_missing');
    expect(runner.world.merchant_relocated).toBe(false);
    runner.advance(6);
    expect(runner.world.merchant_location).toBe('town_b');
  });
  it('start 行为不阻塞第一句台词，await 句柄阻塞后续台词', () => {
    const runner = new StoryRunner(compileDocument(guard));
    expect(runner.transcript.some(t => t.text.includes('边走边向你解释'))).toBe(true);
    expect(runner.transcript.some(t => t.text.includes('就是这里'))).toBe(false);
    runner.dispatch('inspect.square');
    expect(runner.transcript.some(t => t.text.includes('广场的钟响了'))).toBe(true);
    runner.advance(1);
    expect(runner.world.guard_location).toBe('gate');
    expect(runner.transcript.some(t => t.text.includes('就是这里'))).toBe(true);
  });
  it('普通 Ink 的选择和条件由 Ink 本身执行', () => {
    const runner = new StoryRunner(compileDocument(lighthouse));
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.world.letter_opened).toBe(true);
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.transcript.some(t => t.text.includes('既然你读过信'))).toBe(true);
  });
  it('无元数据的普通 Ink 从根入口运行', () => {
    const source = ['# 普通故事', '', '~~~ink', '你好。', '* [继续]', '    再见。', '    -> END', '~~~'].join('\n');
    const runner = new StoryRunner(compileDocument(source));
    expect(runner.transcript[0].text).toBe('你好。');
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.transcript.some(t => t.text === '再见。')).toBe(true);
  });
  it('未知行为明确报错，不默认成功', () => {
    const runner = new StoryRunner(compileDocument(guard.replace('npc.move', 'camera.unknown')));
    expect(runner.instances[0].status).toBe('error');
    expect(runner.logs.some(l => l.detail?.includes('尚未注册行为'))).toBe(true);
    expect(runner.world.walk_result).toBe('');
  });
  it('同一个 NPC 的并发行为被仲裁，第二条不会抢走第一条的控制权', () => {
    const extra = ['=== second ===', '# on: banquet', '>>> await npc.move actor=merchant to=gate duration=1h result=other_result', '-> DONE', ''].join('\n');
    const source = merchant.replace('VAR travel_result = ""', 'VAR travel_result = ""\nVAR other_result = ""').replace('=== merchant_greeting ===', extra + '\n=== merchant_greeting ===');
    const runner = new StoryRunner(compileDocument(source));
    runner.choose(runner.choices[0].instanceId, 0);
    runner.dispatch('banquet');
    expect(runner.actions.map(a => a.status)).toEqual(['running', 'blocked']);
    expect(runner.world.other_result).toBe('blocked');
    expect(runner.world.merchant_state).toBe('traveling');
  });
  it('一次大幅时间推进按顺序完成新产生的行为', () => {
    const source = guard.replace('>>> await guard_walk result=walk_result', '>>> await guard_walk result=walk_result\n>>> await npc.move actor=guard to=square duration=1h result=walk_result');
    const runner = new StoryRunner(compileDocument(source));
    runner.advance(3);
    expect(runner.actions).toHaveLength(2);
    expect(runner.actions.every(a => a.status === 'completed')).toBe(true);
    expect(runner.actions[1].started).toBe(9);
    expect(runner.world.guard_location).toBe('square');
    expect(runner.time).toBe(11);
  });
  it('拒绝不匹配或损坏的进度文件', () => {
    const { runner, document } = relocating();
    expect(() => StoryRunner.restore(compileDocument(lighthouse), runner.snapshot())).toThrow('不匹配');
    expect(() => StoryRunner.restore(document, { ...runner.snapshot(), time: -1 })).toThrow('损坏');
    expect(() => StoryRunner.restore(document, { ...runner.snapshot(), actions: [] })).toThrow('缺少');
  });
  it('没有输出的 Ink 跳转循环会暂停，不锁死宿主', () => {
    const source = ['# 循环', '~~~ink', 'VAR count = 0', '=== loop ===', '# on: start', '~ count = count + 1', '-> loop', '~~~'].join('\n');
    const runner = new StoryRunner(compileDocument(source));
    expect(runner.halted).toBe(true);
    expect(runner.instances[0].status).toBe('error');
    expect(runner.logs.some(l => l.detail?.includes('可能存在循环'))).toBe(true);
    expect(() => runner.advance(1)).toThrow('剧情循环');
  });
  it('Ink 内部改变存活状态，也会终止另一段剧情的旅行', () => {
    const extra = ['=== death ===', '# on: actor.death', '~ merchant_alive = false', '-> DONE', ''].join('\n');
    const runner = new StoryRunner(compileDocument(merchant.replace('=== merchant_greeting ===', extra + '\n=== merchant_greeting ===')));
    runner.choose(runner.choices[0].instanceId, 0);
    runner.dispatch('actor.death');
    expect(runner.actions[0].status).toBe('actor_missing');
    expect(runner.world.merchant_relocated).toBe(false);
  });
  it('布局修改可以在不中断旅行的情况下重新映射文档，并保存恢复', () => {
    const { runner } = relocating();
    runner.advance(3);
    const document = compileDocument(writeLayout(merchant, 'crossroads', { x: 100, y: 200 }));
    runner.rebaseDocument(document);
    const restored = StoryRunner.restore(document, runner.snapshot());
    restored.advance(3);
    expect(restored.world.merchant_relocated).toBe(true);
    expect(restored.logs.find(l => l.title === 'merchant → harbor')?.line).toBe(document.commands[0].line);
  });
});

describe('Markdown 作为唯一内容源', () => {
  it('所有示例都能由真正的编译器编译', () => {
    for (const source of [merchant, lighthouse, guard]) expect(compileDocument(source).json).toContain('inkVersion');
  });
  it('图形修改只替换节点内容，保留文档说明、双链、注释和其他节点', () => {
    const document = parseStoryDocument(merchant);
    const knot = document.knots.find(k => k.id === 'road_sealed')!;
    const patched = replaceKnotBody(merchant, knot.id, knot.text.replace('马车的铃声', '远行的脚步声'));
    expect(patched.slice(0, knot.body.start)).toBe(merchant.slice(0, knot.body.start));
    expect(patched.endsWith(merchant.slice(knot.body.end))).toBe(true);
    expect(patched).toContain('[[北方关卡]]');
    expect(patched).toContain('远行的脚步声');
    expect(compileDocument(patched).knots).toHaveLength(4);
  });
  it('连线修改只改对应跳转目标', () => {
    const patched = replaceJump(merchant, 'crossroads', 0, 'merchant_greeting');
    expect(patched).toBe(merchant.replace('-> road_sealed', '-> merchant_greeting'));
    expect(compileDocument(patched).knots).toHaveLength(4);
  });
  it('拖动节点只改变布局，Ink 内容保持一致', () => {
    const patched = writeLayout(merchant, 'crossroads', { x: 142.2, y: 81.7 });
    expect(parseStoryDocument(patched).layout.crossroads).toEqual({ x: 142, y: 82 });
    expect(patched.slice(patched.indexOf('# 商路的另一端'))).toBe(merchant.slice(merchant.indexOf('# 商路的另一端')));
    expect(compileDocument(patched).generatedInk).toBe(compileDocument(merchant).generatedInk);
  });
  it('错误能够定位回原 Markdown 行号', () => {
    const broken = merchant.replace('~ road_closed = true', '~ undefined_variable = true');
    try { compileDocument(broken); throw new Error('不应编译通过'); }
    catch (error) {
      expect(error).toBeInstanceOf(DocumentError);
      expect((error as DocumentError).diagnostics.some(d => d.line === broken.split('\n').findIndex(l => l.includes('undefined_variable')) + 1)).toBe(true);
    }
  });
});
