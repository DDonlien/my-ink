import { describe, expect, it } from 'vitest';
import { compileDocument, parseStoryDocument } from '../src/core/document';
import { StoryRunner } from '../src/core/runtime';
import { storyStructure, sequentialStructure } from '../src/graph/model';
import { blockDraft, canEditContent, draftChanged, writeBlockDraft } from '../src/graph/content';
import { manCatCase } from '../src/samples';

const ink = (body: string) => '# 对白编辑\n\n人物：[[周渡]]\n\n```ink\nVAR asked = false\nVAR available = true\n=== start ===\n# on: start\n' + body + '\n```\n';
const source = ink('邻居：先听我说。\n~ asked = true\n周渡：我在听。\n+ (ask) {available} [追问]\n    邻居：回答甲。\n    -> DONE\n* [离开]\n    周渡：再见。\n    -> DONE');

describe('literal dialogue and choice editing', () => {
  it('writes prose and choices together while preserving assignments, conditional headers, identifiers, answers and Markdown', () => {
    const first = storyStructure(parseStoryDocument(source)).blocks[0];
    const draft = blockDraft(source, first);
    expect(draft.steps).toEqual([['邻居：先听我说。'], ['周渡：我在听。']]);
    expect(draft.choices).toEqual([['追问'], ['离开']]);
    expect(draftChanged(source, first, draft)).toBe(false);
    draft.steps[1][0] = '周渡：继续，我会记下。';
    draft.choices[0][0] = '请再说明';
    expect(draftChanged(source, first, draft)).toBe(true);
    const next = writeBlockDraft(source, first, draft);
    expect(next).toBe(source.replace('周渡：我在听。', '周渡：继续，我会记下。').replace('[追问]', '[请再说明]'));
    const runner = new StoryRunner(compileDocument(next));
    expect(runner.world.asked).toBe(true);
    expect(runner.choices[0].choices.map(choice => choice.text)).toEqual(['请再说明', '离开']);
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.transcript.some(entry => entry.text === '回答甲。')).toBe(true);
  });
  it('edits each nested choice at its exact span and keeps its sibling and parent branches', () => {
    const nested = ink('开场。\n* [甲]\n    甲段。\n    ** [甲一]\n        回答一。\n    ** [甲二]\n        回答二。\n    -- 汇合甲。\n* [乙]\n    乙段。\n- 汇合。\n-> DONE');
    const block = storyStructure(parseStoryDocument(nested)).blocks.find(block => block.text === '甲段。')!;
    const draft = blockDraft(nested, block); draft.choices[1][0] = '另外一种问法';
    expect(writeBlockDraft(nested, block, draft)).toBe(nested.replace('** [甲二]', '** [另外一种问法]'));
  });
  it('supports a choice-only box and the final box in split mode', () => {
    const only = ink('* [先问]\n    回答。\n    -> DONE');
    const block = storyStructure(parseStoryDocument(only)).blocks[0];
    expect(block.editable).toBe(false); expect(canEditContent(block)).toBe(true);
    const draft = blockDraft(only, block); draft.choices[0][0] = '直接询问';
    expect(writeBlockDraft(only, block, draft)).toBe(only.replace('[先问]', '[直接询问]'));
    const split = sequentialStructure(storyStructure(parseStoryDocument(source)), 'split');
    const last = split.blocks.find(block => block.id === 'start::step-1')!;
    const splitDraft = blockDraft(source, last); splitDraft.choices[0][0] = '请解释';
    expect(writeBlockDraft(source, last, splitDraft)).toBe(source.replace('[追问]', '[请解释]'));
  });
  it('edits glued fragments and tagged prose without deleting glue, intervening facts, tags or click boundaries', () => {
    const glued = ink('邻居：前半句<>\n~ asked = true\n后半句。\n周渡：我明白了。 # speaker: 周渡\n* [追问]\n    回答。\n    -> DONE');
    const first = storyStructure(parseStoryDocument(glued)).blocks[0];
    const draft = blockDraft(glued, first);
    expect(draft.steps).toEqual([['邻居：前半句', '后半句。'], ['周渡：我明白了。']]);
    draft.steps[0][1] = '补充的后半句。'; draft.steps[1][0] = '周渡：我记下了。';
    const next = writeBlockDraft(glued, first, draft);
    expect(next).toBe(glued.replace('后半句。', '补充的后半句。').replace('周渡：我明白了。', '周渡：我记下了。'));
    const runner = new StoryRunner(compileDocument(next), undefined, true, { autoExpandDialogue: false });
    expect(runner.transcript.filter(entry => entry.kind === 'dialogue').map(entry => entry.text)).toEqual(['前半句补充的后半句。']);
    runner.continueDialogue(runner.continuations[0].id);
    expect(runner.world.asked).toBe(true);
    expect(runner.choices[0].choices[0].text).toBe('追问');
    expect(storyStructure(parseStoryDocument(next)).blocks[0].sequence).toHaveLength(2);
  });
  it('preserves the distinction between shared wording and choice-only wording in a mixed header', () => {
    const mixed = ink('开场。\n* 周渡：[追问]我会复核。 -> DONE');
    const block = storyStructure(parseStoryDocument(mixed)).blocks[0];
    const draft = blockDraft(mixed, block);
    expect(draft.choices).toEqual([['周渡：', '追问']]);
    draft.choices[0][1] = '再问一句';
    const next = writeBlockDraft(mixed, block, draft);
    expect(next).toBe(mixed.replace('[追问]', '[再问一句]'));
    const runner = new StoryRunner(compileDocument(next));
    expect(runner.choices[0].choices[0].text).toBe('周渡：再问一句');
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.transcript.some(entry => entry.text === '我会复核。')).toBe(true);
  });
  it('escapes literal punctuation so editing a label cannot create branches, conditions, tags or jumps', () => {
    const block = storyStructure(parseStoryDocument(source)).blocks[0], draft = blockDraft(source, block);
    const label = '确认 [笔记] #1 -> 去{屋里} / 再问';
    draft.choices[0][0] = label;
    const next = writeBlockDraft(source, block, draft), runner = new StoryRunner(compileDocument(next));
    expect(runner.choices[0].choices.map(choice => choice.text)).toEqual([label, '离开']);
    const roundtrip = storyStructure(parseStoryDocument(next)).blocks[0];
    expect(blockDraft(next, roundtrip).choices[0]).toEqual([label]);
    expect(writeBlockDraft(next, roundtrip, blockDraft(next, roundtrip))).toBe(next);
  });
  it('does not expose expression results as replaceable literal fields and rejects incomplete or multiline edits atomically', () => {
    const dynamic = ink('周渡：你说了{asked}。\n* [追问 {available}]\n    回答。\n    -> DONE');
    const block = storyStructure(parseStoryDocument(dynamic)).blocks[0];
    expect(canEditContent(block)).toBe(false);
    const first = storyStructure(parseStoryDocument(source)).blocks[0], draft = blockDraft(source, first);
    draft.steps[0][0] = '有效的改稿。'; draft.choices[0][0] = '';
    expect(() => writeBlockDraft(source, first, draft)).toThrow('不能为空');
    draft.choices[0][0] = '第一行\n第二行';
    expect(() => writeBlockDraft(source, first, draft)).toThrow('每个输入框对应一次显示');
    expect(first.sequence).toHaveLength(2);
  });
  it('provides choice editing for every literal option in the first case', () => {
    const graph = storyStructure(parseStoryDocument(manCatCase));
    const ports = graph.blocks.flatMap(block => block.ports.filter(port => port.choice));
    expect(ports.length).toBeGreaterThan(35);
    for (const port of ports) expect(port.choice!.fragments.length, port.label).toBeGreaterThan(0);
  });
});
