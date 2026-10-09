import type { Action, ActionStatus, WorldValue } from './types';

export interface ParsedCommand { mode: 'start' | 'await' | 'emit'; target: string; args: Record<string, string> }
export function parseCommand(text: string): ParsedCommand {
  const tokens = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const mode = tokens.shift();
  if (mode !== 'start' && mode !== 'await' && mode !== 'emit') throw new Error('行为语句需要以 start、await 或 emit 开头。');
  const target = mode === 'emit' ? 'event' : tokens.shift();
  if (!target) throw new Error('请指定行为类型或等待句柄。');
  const args: Record<string, string> = {};
  for (const token of tokens) {
    const match = token.match(/^([A-Za-z_]\w*)=(.+)$/);
    if (!match) throw new Error('参数请使用 key=value 格式：' + token);
    if (Object.hasOwn(args, match[1])) throw new Error('参数重复：' + match[1]);
    const value = match[2];
    args[match[1]] = /^".*"$/.test(value) ? JSON.parse(value) : /^'.*'$/.test(value) ? value.slice(1, -1) : value;
  }
  return { mode, target, args };
}

export function durationHours(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)(h|m|d)$/);
  if (!match) throw new Error('时间请使用 6h、30m 或 1d。');
  const hours = Number(match[1]) * ({ h: 1, m: 1 / 60, d: 24 }[match[2]] || 0);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) throw new Error('行为时长需要大于零，且不超过一年。');
  return hours;
}

export interface WorldAccess { get(name: string): WorldValue | undefined; set(name: string, value: WorldValue): void }
export interface ActionHandler {
  label: string;
  start(action: Action, world: WorldAccess): ActionStatus;
  finish(action: Action, status: ActionStatus, world: WorldAccess): void;
}

/** Replace these handlers with engine adapters without changing the document protocol. */
export class FakeActionExecutor {
  private handlers = new Map<string, ActionHandler>();
  constructor() {
    const movement: ActionHandler = {
      label: '前往',
      start(action, world) {
        if (world.get(action.actor + '_alive') === false ||
          [world.get(action.actor + '_alive'), world.get(action.actor + '_location'), world.get(action.actor + '_state')].every(v => v === undefined)) return 'actor_missing';
        action.previousState = world.get(action.actor + '_state');
        if (action.previousState !== undefined) world.set(action.actor + '_state', 'traveling');
        return 'running';
      },
      finish(action, status, world) {
        if (status === 'completed' && world.get(action.actor + '_location') !== undefined) world.set(action.actor + '_location', action.destination);
        if (action.previousState !== undefined) world.set(action.actor + '_state', status === 'completed' ? 'idle' : action.previousState);
      },
    };
    this.register('npc.travel', movement);
    this.register('npc.move', movement);
  }
  register(type: string, handler: ActionHandler) { this.handlers.set(type, handler); }
  supports(type: string) { return this.handlers.has(type); }
  start(action: Action, world: WorldAccess) {
    const handler = this.handlers.get(action.type);
    if (!handler) throw new Error('尚未注册行为：' + action.type);
    return handler.start(action, world);
  }
  finish(action: Action, status: ActionStatus, world: WorldAccess) { this.handlers.get(action.type)?.finish(action, status, world); }
}

export const actorLabel = (id: string) => ({ cat: '黑猫', zhoudu: '周渡' }[id] || id);
export const placeLabel = (id: string) => ({ storage_room: '储物间', apartment: '旧公寓房间', wall_niche: '壁龛窄缝', coal_cabinet: '旧煤柜背面' }[id] || id);
export const statusLabel = (status: ActionStatus) => ({ running: '进行中', completed: '已完成', blocked: '受阻', cancelled: '已取消', actor_missing: '角色失效' }[status]);
export function formatTime(hours: number) {
  const minutes = Math.round(hours * 60);
  return '第 ' + (Math.floor(minutes / 1440) + 1) + ' 天 · ' + String(Math.floor(minutes / 60) % 24).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
