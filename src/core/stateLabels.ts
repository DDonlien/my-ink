import { placeLabel, statusLabel } from './actions';
import type { ActionStatus, WorldValue } from './types';

const labels: Record<string, string> = {
  case_started: '已接下委托', cat_alive: '黑猫存活', cat_location: '黑猫所在地点', cat_state: '黑猫当前状态', cat_fed: '黑猫已恢复体力', cat_path_result: '窄路行动结果',
  room_checked: '现场已记录', past_window: '窗与门的残留已观察', past_conflict: '冲突残留已观察', niche_open: '壁龛通路已打开', ledger_corner: '账页边角已取得',
  neighbor_checked: '邻居观察范围已询问', restaurant_checked: '老板娘证言已取得', ache_left_seen: '街口逃出已目击', agent_checked: '代理人已询问', agent_key_record: '钥匙夜访已核对',
  technician_checked: '维修员已询问', repair_order: '工单与入屋记录已核对', search_permit: '衣物盒搜查许可', stolen_box: '失窃衣物盒已核验',
  cart_checked: '搬运路线已复查', cart_records: '原始推车登记已留存', cart_trace: '现场搬运痕迹已核对', garbage_permit: '垃圾房查验许可', coal_latch_open: '煤柜背扣已拨开',
  body_identified: '遗体身份已核验', injury_checked: '伤情与现场已核对', window_theft_locked: '闯窗盗窃结论已确认', death_locked: '致命冲突结论已确认',
  agent_actions_locked: '代理人夜访与移尸已确认', missing_status_locked: '阿澈最后行动已确认', premature_accusation: '已过早公开指控', cart_record_lost: '原始推车登记已丢失',
  clearance_state: '清运安排', report_submitted: '报告已提交', report_quality: '报告完整度', house_state: '房源处置', ache_status: '阿澈的可证实状态', phone_trace: '号码暗线',
};
export const stateLabel = (name: string) => labels[name] || name;
export function stateValueOptions(name?: string): string[] {
  return ({
    cat_path_result: ['', 'running', 'completed', 'blocked', 'cancelled', 'actor_missing'],
    cat_state: ['hungry', 'idle', 'traveling'],
    cat_location: ['storage_room', 'apartment', 'wall_niche', 'coal_cabinet'],
    clearance_state: ['scheduled', 'accelerated'],
  } as Record<string, string[]>)[name || ''] || [];
}
export function stateValueLabel(value: WorldValue, name?: string): string {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return String(value);
  if (!value) return '空字符串';
  if (name === 'cat_location') return placeLabel(value);
  if (name === 'cat_path_result' && ['running', 'completed', 'blocked', 'cancelled', 'actor_missing'].includes(value)) return statusLabel(value as ActionStatus);
  if (name === 'cat_state') return ({ hungry: '饥饿', idle: '待命', traveling: '行动中' } as Record<string, string>)[value] || '「' + value + '」';
  if (name === 'clearance_state') return ({ scheduled: '按原计划', accelerated: '提前清运' } as Record<string, string>)[value] || '「' + value + '」';
  return '「' + value + '」';
}
