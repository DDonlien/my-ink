import { compileDocument } from '../core/document';
import type { SourceRange } from '../core/types';
import type { GraphPort, StoryBlock } from './model';

export interface BlockDraft { steps: string[][]; choices: string[][]; raw: string }
export const editableChoices = (block: StoryBlock): GraphPort[] => block.ports.filter(port => port.choice);
export function blockDraft(source: string, block: StoryBlock): BlockDraft {
  return {
    steps: (block.sequence || []).map(step => step.fragments?.length ? step.fragments.map(fragment => fragment.text) : [step.text]),
    choices: editableChoices(block).map(port => port.choice!.fragments.map(fragment => fragment.text)),
    raw: block.range ? source.slice(block.range.start, block.range.end).trimEnd() : block.text,
  };
}
export function draftChanged(source: string, block: StoryBlock, draft: BlockDraft): boolean {
  return JSON.stringify(blockDraft(source, block)) !== JSON.stringify(draft);
}
export function canEditContent(block: StoryBlock): boolean {
  return Boolean(block.sequence?.some(step => step.editable && step.fragments?.length) ||
    editableChoices(block).some(port => port.choice!.fragments.length) || (!block.sequence && !block.stateChanges?.length && block.kind !== 'condition' && block.editable && block.range));
}

// Author fields contain literal text, so punctuation must not become Ink
// conditions, comments, diverts or choices when written back.
function literalText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('对白和选项文字不能为空。');
  if (/[\r\n]/.test(trimmed)) throw new Error('每个输入框对应一次显示，请连续输入这段文字。新增点击可从框名打开原文编辑。');
  return trimmed.replace(/[\\[\]{}|#<>*+~=\-()/^]/g, '\\$&');
}

export function writeBlockDraft(source: string, block: StoryBlock, draft: BlockDraft): string {
  const original = blockDraft(source, block), edits: { range: SourceRange; text: string }[] = [];
  if (draft.steps.length !== original.steps.length || draft.choices.length !== original.choices.length) throw new Error('节点结构已变化，请重新打开节点编辑。');
  (block.sequence || []).forEach((step, stepIndex) => {
    if (draft.steps[stepIndex].length !== original.steps[stepIndex].length) throw new Error('显示内容已变化，请重新打开节点编辑。');
    (step.fragments || []).forEach((fragment, partIndex) => {
      const text = draft.steps[stepIndex][partIndex];
      if (text === original.steps[stepIndex][partIndex]) return;
      if (!step.editable) throw new Error('这段内容需要从框名打开原文编辑。');
      edits.push({ range: fragment.range, text: literalText(text) });
    });
  });
  editableChoices(block).forEach((port, index) => {
    if (draft.choices[index].length !== original.choices[index].length) throw new Error('选项结构已变化，请重新打开节点编辑。');
    port.choice!.fragments.forEach((fragment, partIndex) => {
      const text = draft.choices[index][partIndex];
      if (text !== original.choices[index][partIndex]) edits.push({ range: fragment.range, text: literalText(text) });
    });
  });
  if (!block.sequence && draft.raw !== original.raw) {
    if (!block.editable || !block.range || block.stateChanges?.length || block.kind === 'condition') throw new Error('状态结果只读；请使用专用控件修改条件。');
    edits.push({ range: block.range, text: draft.raw.replace(/\r\n/g, '\n').trimEnd() + (source.slice(block.range.start, block.range.end).endsWith('\n') ? '\n' : '') });
  }
  edits.sort((a, b) => b.range.start - a.range.start);
  for (let index = 0; index < edits.length; index++) {
    const { range } = edits[index];
    if (range.start < 0 || range.end > source.length || range.end <= range.start || (index > 0 && range.end > edits[index - 1].range.start)) throw new Error('编辑范围发生重叠，请从框名打开原文编辑。');
  }
  let next = source;
  for (const { range, text } of edits) next = next.slice(0, range.start) + text + next.slice(range.end);
  compileDocument(next); // All fields commit together, only after compilation.
  return next;
}
