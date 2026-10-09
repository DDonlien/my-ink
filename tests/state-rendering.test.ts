import { describe, expect, it } from 'vitest';
import { compileDocument, parseStoryDocument } from '../src/core/document';
import { StoryRunner } from '../src/core/runtime';
import { layoutStructure } from '../src/graph/layout';
import { sceneStructure, sequentialStructure, storyStructure } from '../src/graph/model';
import { changeDisplay, conditionDisplay, formatCondition } from '../src/graph/semantics';
import { blockDraft, writeBlockDraft } from '../src/graph/content';
import { manCatCase } from '../src/samples';

const ink = (body: string, variables = '') => '# 状态逻辑\n\n```ink\n' + variables + '\n=== start ===\n# on: start\n' + body + '\n```\n';

describe('readable state operations and conditions', () => {
  it('identifies the annotated case box as a read-only authored result, rather than another inspection', async () => {
    const graph = storyStructure(parseStoryDocument(manCatCase));
    const block = graph.blocks.find(block => !block.sequence && block.stateChanges?.some(change => change.variable === 'case_started'))!;
    expect(block.kind).toBe('logic');
    expect(block.predicate).toBeUndefined();
    expect(changeDisplay(block.stateChanges![0])).toEqual({ label: '已接下委托', value: '是' });
    const geometry = (await layoutStructure(sceneStructure(graph, graph.scenes[0].id))).blocks[block.id];
    expect(geometry.stateChanges![0].label).toEqual(['已接下委托']);
    expect(geometry.stateChanges![0].value).toEqual(['是']);
    expect(geometry.ports[0].y).toBeLessThan(geometry.height);
  });

  it('distinguishes set, increase and decrease, temporary variables, booleans and string values', () => {
    const source = ink('~ case_started = true\n~ report_quality = 4\n~ report_quality += 2\n~ report_quality--\n~ temp estimate = report_quality + 1\n~ cat_location = "wall_niche"\n~ custom_note = "true"\n-> DONE', 'VAR case_started = false\nVAR report_quality = 0\nVAR cat_location = "apartment"\nVAR custom_note = ""');
    const changes = storyStructure(parseStoryDocument(source)).blocks[0].stateChanges!;
    expect(changes.map(changeDisplay)).toEqual([
      { label: '已接下委托', value: '是' },
      { label: '报告完整度', value: '4' },
      { label: '报告完整度', value: '原值 + 2' },
      { label: '报告完整度', value: '原值 − 1' },
      { label: 'estimate', value: '（报告完整度 + 1）' },
      { label: '黑猫所在地点', value: '壁龛窄缝' },
      { label: 'custom_note', value: '「true」' },
    ]);
    expect(changes[4].temporary).toBe(true);
    expect(changes[0].temporary).toBe(false);
    for (const change of changes) expect(source.slice(change.range.start, change.range.end).trim()).toMatch(/^~/);
  });

  it('keeps automatic updates at the actual click boundary in merged and split dialogue', async () => {
    const source = ink('~ case_started = true\n邻居：先听我说。\n~ room_checked = true\n周渡：我已经记下。\n~ neighbor_checked = true\n-> DONE', 'VAR case_started = false\nVAR room_checked = false\nVAR neighbor_checked = false');
    const graph = storyStructure(parseStoryDocument(source)), block = graph.blocks[0];
    expect(block.sequence).toHaveLength(2);
    expect(block.stateChanges!.map(change => change.beforeStep)).toEqual([0, 1, 2]);
    const shape = (await layoutStructure(graph)).blocks[block.id];
    expect(shape.stateChanges![0].top + shape.stateChanges![0].height).toBeLessThan(shape.steps![0].top);
    expect(shape.stateChanges![1].top).toBeGreaterThan(shape.steps![1].separator!);
    expect(shape.stateChanges![1].top + shape.stateChanges![1].height).toBeLessThan(shape.steps![1].top);
    expect(shape.stateChanges![2].top).toBeGreaterThan(shape.steps![1].top + shape.steps![1].lines.length * 20);
    const split = sequentialStructure(graph, 'split');
    expect(split.blocks[0].stateChanges!.map(change => change.variable)).toEqual(['case_started']);
    expect(split.blocks[1].stateChanges!.map(change => [change.variable, change.beforeStep])).toEqual([['room_checked', 0], ['neighbor_checked', 1]]);
    expect(split.links.filter(link => link.sequential)).toHaveLength(1);
    const runner = new StoryRunner(compileDocument(source), undefined, true, { autoExpandDialogue: false });
    expect(runner.world.case_started).toBe(true);
    expect(runner.world.room_checked).toBe(false);
    runner.continueDialogue(runner.continuations[0].id);
    expect(runner.world.room_checked).toBe(true);
  });

  it('keeps glue as one display even when a state update lies between its fragments', () => {
    const source = ink('邻居：前半句<>\n~ room_checked = true\n后半句。\n周渡：收到。\n-> DONE', 'VAR room_checked = false');
    const graph = storyStructure(parseStoryDocument(source));
    expect(graph.blocks[0].sequence!.map(step => step.text)).toEqual(['邻居：前半句后半句。', '周渡：收到。']);
    expect(graph.blocks[0].stateChanges![0].beforeStep).toBe(0);
    expect(sequentialStructure(graph, 'split').blocks[0].stateChanges![0].variable).toBe('room_checked');
  });

  it('shows all/any conditions, comparisons and negation without losing mixed precedence', () => {
    const source = ink('{case_started and (cat_alive or not cat_fed) and report_quality >= 2:\n    条件成立。\n- else:\n    条件不成立。\n}\n-> DONE', 'VAR case_started = false\nVAR cat_alive = true\nVAR cat_fed = false\nVAR report_quality = 0');
    const block = storyStructure(parseStoryDocument(source)).blocks.find(block => block.kind === 'condition')!;
    expect(block.text).not.toMatch(/:$/);
    expect(conditionDisplay(block.predicate!)).toEqual({ caption: '全部满足', clauses: ['已接下委托 为是', '（黑猫存活 为是）或（黑猫已恢复体力 为否）', '（报告完整度 大于等于 2）'] });
    expect(block.ports.map(port => port.label)).toEqual(['条件成立', '条件不成立']);
    const any = storyStructure(parseStoryDocument(ink('{cat_alive or cat_fed:可行动|不可行动}\n-> DONE', 'VAR cat_alive = true\nVAR cat_fed = false'))).blocks[0];
    expect(conditionDisplay(any.predicate!)).toEqual({ caption: '任一满足', clauses: ['黑猫存活 为是', '黑猫已恢复体力 为是'] });
  });

  it('formats actual choice eligibility while keeping its Ink source and branch targets', () => {
    const source = ink('周渡：检查通路。\n+ {cat_alive and cat_path_result == "completed"} [取回物证]\n    成功回应。\n    -> DONE\n+ [等一等]\n    等待回应。\n    -> DONE', 'VAR cat_alive = true\nVAR cat_path_result = "blocked"');
    const graph = storyStructure(parseStoryDocument(source)), first = graph.blocks[0];
    expect(first.ports[0].condition).toBe('cat_alive and cat_path_result == "completed"');
    expect(formatCondition(first.ports[0].predicate!)).toBe('（黑猫存活 为是）且（（窄路行动结果 等于 已完成））');
    const draft = blockDraft(source, first); draft.choices[0][0] = '核验物证';
    expect(writeBlockDraft(source, first, draft)).toBe(source.replace('[取回物证]', '[核验物证]'));
  });

  it('renders value matching and ordered conditions as their actual branch semantics', async () => {
    const source = ink('{report_quality:\n- 2:\n    完整。\n- 1:\n    有限。\n- else:\n    待调查。\n}\n{\n- cat_alive:\n    猫观察。\n- cat_fed:\n    猫休息。\n- else:\n    先救猫。\n}\n-> DONE', 'VAR report_quality = 0\nVAR cat_alive = true\nVAR cat_fed = false');
    const graph = storyStructure(parseStoryDocument(source));
    const conditions = graph.blocks.filter(block => block.kind === 'condition');
    expect(conditions[0].conditionMode).toBe('match');
    expect(conditions[0].ports.map(port => port.label)).toEqual(['等于 2', '等于 1', '都不匹配']);
    expect(conditions[1].conditionMode).toBe('multiple');
    expect(conditions[1].ports.map(port => port.label)).toEqual(['黑猫存活 为是', '黑猫已恢复体力 为是', '此前条件均不成立']);
    const layout = await layoutStructure(graph);
    expect(layout.blocks[conditions[0].id].condition!.clauses).toEqual([['报告完整度']]);
    expect(layout.blocks[conditions[0].id].condition!.caption).toBe('按此值匹配');
    expect(layout.blocks[conditions[1].id].condition!.caption).toBe('按顺序判断');
  });

  it('keeps unknown expressions and automatic calls visible without executing them to draw the graph', () => {
    const source = ink('~ report_quality = mark()\n~ mark()\n{mark() > 0:已记下|未记下}\n-> DONE\n=== function mark() ===\n~ report_quality += 1\n~ return report_quality', 'VAR report_quality = 0');
    const document = compileDocument(source);
    const runner = new StoryRunner(document, undefined, false);
    expect(runner.world.report_quality).toBe(0);
    const graph = storyStructure(document);
    const first = graph.blocks[0];
    expect(changeDisplay(first.stateChanges![0]).value).toBe('mark()');
    expect(graph.blocks.some(block => block.text === '~ mark()' && !block.stateChanges)).toBe(true);
    const condition = graph.blocks.find(block => block.kind === 'condition')!;
    expect(formatCondition(condition.predicate!)).toBe('（mark() 大于 0）');
    expect(runner.world.report_quality).toBe(0);
  });
});
