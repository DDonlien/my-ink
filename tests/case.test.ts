import { describe, expect, it } from 'vitest';
import { compileDocument } from '../src/core/document';
import { StoryRunner } from '../src/core/runtime';
import { manCatCase, samples } from '../src/samples';

function pick(runner: StoryRunner, text: string) {
  const group = runner.choices.find(group => group.choices.some(choice => choice.text.includes(text)));
  if (!group) throw new Error('没有可选项：' + text + '\n' + runner.choices.flatMap(g => g.choices.map(c => c.text)).join('\n'));
  runner.choose(group.instanceId, group.choices.find(choice => choice.text.includes(text))!.index);
  if (text === '楼上的邻居') pick(runner, '你看见他的脸');
  expect(runner.instances.filter(instance => instance.status === 'error')).toHaveLength(0);
}
function opened() {
  const document = compileDocument(manCatCase);
  const runner = new StoryRunner(document);
  pick(runner, '接下旧公寓');
  pick(runner, '解开外扣');
  return { document, runner };
}
function readyForNiche(runner: StoryRunner) {
  pick(runner, '水和食物');
  pick(runner, '检查半收');
  pick(runner, '观察窗沿');
  pick(runner, '移开低柜');
  pick(runner, '沿窄缝取出');
}
function investigate(runner: StoryRunner, witnessesFirst = false) {
  if (witnessesFirst) {
    pick(runner, '一楼餐厅');
    pick(runner, '楼上的邻居');
  }
  readyForNiche(runner);
  runner.advance(5 / 60);
  if (!witnessesFirst) {
    pick(runner, '楼上的邻居');
    pick(runner, '一楼餐厅');
  }
  pick(runner, '代理人的钥匙');
  pick(runner, '电话工单');
  pick(runner, '取得搜查许可');
  pick(runner, '核验衣物盒');
  pick(runner, '复查冲突');
  pick(runner, '推车登记');
  pick(runner, '垃圾房开门许可');
  pick(runner, '拨开旧煤柜');
  runner.advance(5 / 60);
  pick(runner, '核验遗体身份');
  pick(runner, '核对伤情');
}
function confirmClaims(runner: StoryRunner) {
  pick(runner, '打开笔记');
  pick(runner, '组合窗锁');
  pick(runner, '确认“陶启文');
  pick(runner, '组合冲突');
  pick(runner, '确认“维修员');
  pick(runner, '组合钥匙');
  pick(runner, '确认“许明昌');
  pick(runner, '组合半收');
  pick(runner, '确认“阿澈');
  pick(runner, '返回现场');
}

describe('man-cat 第一案的证言与报告边界', () => {
  it('唯一模板来自当前案稿；开场只有查验委托，不提前给出凶手、死亡或猫的名字', () => {
    expect(samples).toHaveLength(1);
    expect(samples[0].source).toBe(manCatCase);
    const document = compileDocument(manCatCase);
    expect(document.diagnostics.filter(d => d.severity === 'error')).toHaveLength(0);
    expect(document.title).toBe('无人接听的房间');
    expect(manCatCase).toContain('旧煤柜发现遗体（原案待确认方案）');
    const runner = new StoryRunner(document);
    const visible = runner.transcript.map(t => t.text).join('\n');
    expect(visible).toContain('欠租失联');
    expect(visible).not.toMatch(/陶启文|死亡|移尸|黑狗/);
    expect(runner.world.death_locked).toBe(false);
    expect(runner.world.report_submitted).toBe(false);
  });
  it('先救出并喂猫才能走猫路线；等待可并行询问，存档恢复不提前给出账页', () => {
    const { document, runner } = opened();
    expect(runner.choices.flatMap(g => g.choices.map(c => c.text)).join('\n')).not.toContain('切换黑猫');
    readyForNiche(runner);
    expect(runner.world.niche_open).toBe(true);
    expect(runner.world.ledger_corner).toBe(false);
    expect(runner.world.cat_location).toBe('apartment');
    expect(runner.actions[0].status).toBe('running');
    runner.dispatch('question.neighbor');
    pick(runner, '你看见他的脸');
    runner.dispatch('question.restaurant');
    expect(runner.world.neighbor_checked).toBe(true);
    expect(runner.world.restaurant_checked).toBe(true);
    expect(runner.world.death_locked).toBe(false);
    const restored = StoryRunner.restore(document, runner.snapshot());
    expect(restored.world.ledger_corner).toBe(false);
    expect(restored.world.cat_path_result).toBe('');
    restored.advance(5 / 60);
    expect(restored.world.cat_location).toBe('wall_niche');
    expect(restored.world.ledger_corner).toBe(true);
    expect(restored.actions).toHaveLength(1);
    expect(restored.world.phone_trace).toContain('关联待核验');
    expect(restored.world.ache_status).toContain('生死未证实');
  });
  it('猫取物受阻后不获得物证，保留人类造出的通路并允许重试', () => {
    const { runner } = opened(); readyForNiche(runner);
    runner.completeAction(runner.actions[0].id, 'blocked');
    expect(runner.world.ledger_corner).toBe(false);
    expect(runner.world.niche_open).toBe(true);
    expect(runner.world.cat_location).toBe('apartment');
    pick(runner, '沿窄缝取出');
    runner.advance(5 / 60);
    expect(runner.world.ledger_corner).toBe(true);
    expect(runner.actions.map(a => a.status)).toEqual(['blocked', 'completed']);
  });
  it('残留和证言不能直接锁定死亡；错误组合也不吞掉线索', () => {
    const { runner } = opened();
    pick(runner, '水和食物'); pick(runner, '检查半收');
    pick(runner, '复查冲突'); pick(runner, '一楼餐厅');
    pick(runner, '打开笔记'); pick(runner, '直接当作凶手');
    pick(runner, '组合冲突');
    expect(runner.world.death_locked).toBe(false);
    expect(runner.world.body_identified).toBe(false);
    expect(runner.world.past_conflict).toBe(true);
    expect(runner.world.restaurant_checked).toBe(true);
    expect(runner.transcript.some(t => t.text.includes('死亡必须有遗体身份'))).toBe(true);
    pick(runner, '组合半收'); pick(runner, '现在已经安全离城');
    expect(runner.world.missing_status_locked).toBe(false);
    expect(runner.world.ache_left_seen).toBe(true);
  });
  it.each([false, true])('询问顺序可交换（先询问=%s）；物证齐全也须手动确认四项结论', witnessesFirst => {
    const { runner } = opened(); investigate(runner, witnessesFirst);
    expect(runner.world.body_identified).toBe(true);
    for (const key of ['window_theft_locked', 'death_locked', 'agent_actions_locked', 'missing_status_locked']) expect(runner.world[key]).toBe(false);
    confirmClaims(runner);
    for (const key of ['window_theft_locked', 'death_locked', 'agent_actions_locked', 'missing_status_locked']) expect(runner.world[key]).toBe(true);
    pick(runner, '起草房屋'); pick(runner, '提交报告');
    expect(runner.world.report_quality).toBe('四项结论已确认，证据记录完整');
    expect(runner.world.house_state).toBe('事故屋，暂缓出租并保全现场');
    expect(runner.world.ache_status).toBe('失踪，仍待查；冲突后逃出已核证');
    expect(runner.transcript.some(t => t.text.includes('以后叫你黑狗'))).toBe(true);
    const count = runner.instances.filter(i => i.knot === 'report_aftermath').length;
    runner.dispatch('case.reported');
    expect(runner.instances.filter(i => i.knot === 'report_aftermath')).toHaveLength(count);
  });
  it('提前指控造成未留存登记的不可逆缺失，最低证明与报告通路仍开放', () => {
    const { document, runner } = opened();
    pick(runner, '证据未齐就公开指控');
    expect(runner.world.clearance_state).toBe('accelerated');
    expect(runner.world.cart_record_lost).toBe(true);
    const restored = StoryRunner.restore(document, runner.snapshot());
    investigate(restored); confirmClaims(restored);
    expect(restored.world.cart_records).toBe(false);
    expect(restored.world.body_identified).toBe(true);
    pick(restored, '起草房屋'); pick(restored, '提交报告');
    expect(restored.world.report_quality).toBe('四项结论已确认，原始推车登记缺失');
  });
  it('提前指控不删除已经留存的登记；有限报告不替未核证责任下结论', () => {
    const { runner } = opened();
    pick(runner, '楼上的邻居'); pick(runner, '代理人的钥匙'); pick(runner, '推车登记');
    pick(runner, '证据未齐就公开指控');
    expect(runner.world.cart_records).toBe(true);
    expect(runner.world.cart_record_lost).toBe(false);
    pick(runner, '检查半收'); pick(runner, '起草房屋'); pick(runner, '提交报告');
    expect(runner.world.report_quality).toBe('有限报告，未确认结论继续调查');
    expect(runner.world.house_state).toBe('暂停清房，补充核验');
    expect(runner.world.death_locked).toBe(false);
    expect(runner.transcript.some(t => t.text.includes('以后叫你黑狗'))).toBe(false);
  });
});
