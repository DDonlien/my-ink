import { describe, expect, it } from 'vitest';
import { compileDocument, parseStoryDocument } from '../src/core/document';
import { StoryRunner } from '../src/core/runtime';
import { applyCondition, conditionTargets, inkExpression } from '../src/graph/conditions';
import { storyStructure, sequentialStructure } from '../src/graph/model';
import { stateOrigins, withStateOrigins } from '../src/graph/origins';
import { blockDraft, canEditContent, writeBlockDraft } from '../src/graph/content';
import { manCatCase } from '../src/samples';
import type { ExpressionView } from '../src/graph/semantics';

const ink = (body: string, variables = 'VAR score = 1\nVAR available = true') => '# 条件\n\n参考：[[人物]]\n\n```ink\n' + variables + '\n=== start ===\n# on: start\n' + body + '\n```\n';
const literal = (value: string | boolean | number): ExpressionView => ({ kind: 'literal', value });

describe('authored result provenance', () => {
  it('attributes acceptance to the actual previous option without adding a check or an edit', () => {
    const structure = withStateOrigins(storyStructure(parseStoryDocument(manCatCase)));
    const block = structure.blocks.find(block => !block.sequence && block.stateChanges?.some(change => change.variable === 'case_started'))!;
    expect(block.editable).toBe(false);
    expect(canEditContent(block)).toBe(false);
    expect(block.stateChanges![0].origins).toEqual([{ kind: 'dialogue', label: '接下旧公寓的查验委托', blockId: 'job_interview', portId: structure.blocks[0].ports[0].id, stepIndex: undefined }]);
    const draft = blockDraft(manCatCase, block); draft.raw = '~ case_started = false';
    expect(() => writeBlockDraft(manCatCase, block, draft)).toThrow('状态结果只读');
  });
  it('retains both possible sources at a merge and follows the correct sequential step', () => {
    const source = ink('一句。\n二句。\n* [甲]\n    甲回答。\n* [乙]\n    乙回答。\n- (join)\n~ available = false\n-> DONE');
    const graph = withStateOrigins(storyStructure(parseStoryDocument(source)));
    const block = graph.blocks.find(block => block.stateChanges?.length)!;
    expect(block.stateChanges![0].origins!.map(origin => graph.blocks.find(block => block.id === origin.blockId)?.text)).toEqual(['甲回答。', '乙回答。']);
    const inline = ink('第一句。\n~ score += 1\n第二句。\n~ available = false\n-> DONE');
    const merged = storyStructure(parseStoryDocument(inline));
    expect(stateOrigins(merged, merged.blocks[0], merged.blocks[0].stateChanges![0])[0].stepIndex).toBe(0);
    const split = withStateOrigins(sequentialStructure(merged, 'split'));
    expect(split.blocks[1].stateChanges!.map(change => change.origins![0].blockId)).toEqual(['start', 'start::step-1']);
  });
  it('identifies an action or event as the source and never calls an authored assignment a default', () => {
    const graph = withStateOrigins(storyStructure(parseStoryDocument(ink('>>> emit event=arrived\n~ available = false\n-> DONE'))));
    const block = graph.blocks.find(block => block.stateChanges?.length)!;
    expect(block.stateChanges![0].origins![0]).toMatchObject({ kind: 'event', label: 'arrived', blockId: 'start' });
    expect(withStateOrigins(storyStructure(parseStoryDocument(ink('~ available = false\n-> DONE')))).blocks[0].stateChanges![0].origins).toEqual([{ kind: 'event', label: 'start' }]);
  });
});

describe('structured Ink condition changes', () => {
  it('captures every first-case predicate at its exact expression and can round-trip it through a structured expression', () => {
    const graph = storyStructure(parseStoryDocument(manCatCase)), targets = graph.blocks.flatMap(conditionTargets);
    expect(targets.length).toBeGreaterThan(35);
    for (const target of targets) {
      expect(manCatCase.slice(target.range.start, target.range.end)).toBe(target.original);
      let next: string;
      try { next = applyCondition(manCatCase, target, target.expression); }
      catch (error) { throw new Error(target.original + ' → ' + inkExpression(target.expression) + ': ' + (error as Error).message); }
      const nextGraph = storyStructure(parseStoryDocument(next));
      expect(nextGraph.blocks.map(block => block.kind)).toEqual(graph.blocks.map(block => block.kind));
      expect(nextGraph.blocks.flatMap(block => block.ports.map(port => !!port.choice))).toEqual(graph.blocks.flatMap(block => block.ports.map(port => !!port.choice)));
    }
  });
  it('changes only a choice eligibility expression and preserves its wording, identifier, tag, answer and target', () => {
    const source = ink('开场。\n+ (ask) {score >= 2 and available} [询问] # clue\n    回答。\n    -> DONE\n+ [离开]\n    -> DONE');
    const target = storyStructure(parseStoryDocument(source)).blocks[0].ports[0].conditionTarget!;
    const expression: ExpressionView = { kind: 'binary', op: 'and', left: { kind: 'binary', op: '>=', left: { kind: 'variable', name: 'score' }, right: literal(1) }, right: { kind: 'variable', name: 'available' } };
    const next = applyCondition(source, target, expression);
    expect(next).toBe(source.replace('score >= 2 and available', '((score >= 1) and available)'));
    expect(new StoryRunner(compileDocument(source)).choices[0].choices.map(choice => choice.text)).toEqual(['离开']);
    expect(new StoryRunner(compileDocument(next)).choices[0].choices.map(choice => choice.text)).toEqual(['询问', '离开']);
  });
  it('keeps mixed all/any precedence and changes a comparison without changing either branch', () => {
    const source = ink('{available and (score > 2 or not available):通过。|拒绝。}\n-> DONE');
    const target = storyStructure(parseStoryDocument(source)).blocks[0].conditionTarget!;
    expect(target.original).toBe('available and (score > 2 or not available)');
    const expression = structuredClone(target.expression) as Extract<ExpressionView, { kind: 'binary' }>;
    const any = expression.right as Extract<ExpressionView, { kind: 'binary' }>;
    (any.left as Extract<ExpressionView, { kind: 'binary' }>).right = literal(0);
    const next = applyCondition(source, target, expression);
    expect(next).toContain('{(available and ((score > 0) or (not available))):通过。|拒绝。}');
    expect(new StoryRunner(compileDocument(next)).transcript.some(entry => entry.text === '通过。')).toBe(true);
  });
  it('edits inline, ordered and value-matching conditions without replacing adjacent text or an else branch', () => {
    const source = ink('前{score > 2:甲|乙}中{available:丙|丁}后。\n{score:\n- 1:\n    一。\n- 2:\n    二。\n- else:\n    其他。\n}\n{\n- available:\n    有。\n- score > 2:\n    高。\n- else:\n    无。\n}\n-> DONE');
    const conditions = storyStructure(parseStoryDocument(source)).blocks.filter(block => block.kind === 'condition');
    expect(applyCondition(source, conditions[0].conditionTarget!, literal(true))).toBe(source.replace('score > 2:甲', 'true:甲'));
    expect(conditions[2].ports[0].conditionTarget!.original).toBe('1');
    expect(applyCondition(source, conditions[2].ports[0].conditionTarget!, literal(3))).toBe(source.replace('- 1:', '- 3:'));
    expect(conditions[3].ports[1].conditionTarget!.original).toBe('score > 2');
    expect(applyCondition(source, conditions[3].ports[1].conditionTarget!, literal(false))).toBe(source.replace('- score > 2:', '- false:'));
    expect(conditions[2].ports.at(-1)!.conditionTarget).toBeUndefined();
    expect(conditions[3].ports.at(-1)!.conditionTarget).toBeUndefined();
  });
  it('treats string punctuation as a literal value and keeps it separate from boolean true', () => {
    const value = 'true "quoted" {score} [选项] #标记 | 分隔 <> \\路径';
    const source = ink('{note == "":匹配。|不匹配。}\n-> DONE', 'VAR score = 1\nVAR note = ' + inkExpression(literal(value)));
    const target = storyStructure(parseStoryDocument(source)).blocks[0].conditionTarget!;
    const expression = structuredClone(target.expression) as Extract<ExpressionView, { kind: 'binary' }>;
    expression.right = literal(value);
    const next = applyCondition(source, target, expression), runner = new StoryRunner(compileDocument(next));
    expect(runner.world.note).toBe(value);
    expect(runner.transcript.some(entry => entry.text === '匹配。')).toBe(true);
    expect(inkExpression(literal('true'))).toBe('"true"');
    expect(inkExpression(literal(true))).toBe('true');
  });
  it('rejects stale ranges and invalid changes atomically, and preserves CRLF and separate Ink blocks', () => {
    const source = (ink('{score > 1:甲|乙}\n-> DONE') + '\n说明。\n\n```ink\n=== extra ===\n保留。\n-> DONE\n```\n').replace(/\n/g, '\r\n');
    const target = storyStructure(parseStoryDocument(source)).blocks[0].conditionTarget!;
    expect(applyCondition(source, target, literal(true))).toBe(source.replace('score > 1', 'true'));
    expect(() => applyCondition(source.replace('score > 1', 'score > 2'), target, literal(false))).toThrow('条件已发生变化');
    expect(() => applyCondition(source, target, literal(NaN))).toThrow('有效的数字');
    expect(() => applyCondition(source, target, { kind: 'variable', name: 'missing' })).toThrow();
    expect(source).toContain('{score > 1:甲|乙}');
  });
  it('retains an unknown function call without evaluating it during editing', () => {
    const source = ink('{mark() > 0:甲|乙}\n-> DONE\n=== function mark() ===\n~ score += 1\n~ return score');
    const runner = new StoryRunner(compileDocument(source), undefined, false);
    const target = storyStructure(parseStoryDocument(source)).blocks[0].conditionTarget!;
    const expression = structuredClone(target.expression) as Extract<ExpressionView, { kind: 'binary' }>;
    expression.right = literal(2);
    const next = applyCondition(source, target, expression);
    expect(next).toContain('{(mark() > 2):甲|乙}');
    expect(runner.world.score).toBe(1);
  });
});
