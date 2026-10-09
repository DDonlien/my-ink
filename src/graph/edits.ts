import { compileDocument } from '../core/document';
import type { SourceRange } from '../core/types';
import type { StoryStructure, StoryLink } from './model';

export type StructuralDrop = { kind: 'order'; moving: StoryLink; target: StoryLink }
  | { kind: 'successor'; moving: StoryLink; target: StoryLink };

function nonoverlapping(a: SourceRange, b: SourceRange) { return a.end <= b.start || b.end <= a.start; }
function reaches(structure: StoryStructure, from: string, to: string, seen = new Set<string>()): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return structure.links.some(e => e.kind !== 'event' && e.source === from && reaches(structure, e.target, to, seen));
}

// A drop has an effect only when it identifies a real structural relationship.
// The caller always restores the canonical positions after the gesture.
export function structuralDrop(structure: StoryStructure, scene: StoryStructure, movingId: string, targetId: string, targetPort?: string): StructuralDrop | undefined {
  if (movingId === targetId) return;
  const visibleIncoming = scene.links.filter(e => e.target === movingId && e.kind !== 'event');
  if (visibleIncoming.length !== 1) return;
  const moving = structure.links.find(e => e.id === visibleIncoming[0].id);
  if (!moving) return;
  if (!targetPort) {
    const targetIncoming = scene.links.filter(e => e.target === targetId && e.kind !== 'event');
    if (targetIncoming.length !== 1) return;
    const target = structure.links.find(e => e.id === targetIncoming[0].id);
    if (moving.branch && target?.branch && moving.branch.group === target.branch.group && nonoverlapping(moving.branch.range, target.branch.range)) return { kind: 'order', moving, target };
    return;
  }
  const target = structure.links.find(e => e.source === targetId && e.port === targetPort && e.kind === 'jump');
  if (!target?.jump || !moving.jump || target.id === moving.id || target.target === moving.target) return;
  const incoming = structure.links.filter(e => e.target === moving.target && e.kind !== 'event');
  if (incoming.length !== 1) return;
  const movingBlock = structure.blocks.find(b => b.id === moving.target);
  const targetBlock = structure.blocks.find(b => b.id === target.target);
  if (!movingBlock?.address || !targetBlock?.address || movingBlock.event || targetBlock.event) return;
  // Moving an ancestor into its descendant would create a new loop, not a
  // well-defined successor slot. Existing intentional Ink loops remain intact.
  if (reaches(structure, moving.target, target.source) || reaches(structure, target.target, moving.source)) return;
  if (!nonoverlapping(moving.jump.range, target.jump.range)) return;
  return { kind: 'successor', moving, target };
}

export function applyStructuralDrop(source: string, drop: StructuralDrop): string {
  const a = drop.kind === 'order' ? drop.moving.branch?.range : drop.moving.jump?.range;
  const b = drop.kind === 'order' ? drop.target.branch?.range : drop.target.jump?.range;
  if (!a || !b || !nonoverlapping(a, b)) throw new Error('这个位置没有可交换的结构。');
  const edits = [{ range: a, text: source.slice(b.start, b.end) }, { range: b, text: source.slice(a.start, a.end) }].sort((x, y) => y.range.start - x.range.start);
  let next = source;
  for (const edit of edits) next = next.slice(0, edit.range.start) + edit.text + next.slice(edit.range.end);
  compileDocument(next); // Invalid edits never replace the user's document.
  return next;
}

export function replaceBlock(source: string, range: SourceRange, text: string): string {
  const original = source.slice(range.start, range.end);
  const next = source.slice(0, range.start) + text.replace(/\r\n/g, '\n').trimEnd() + (original.endsWith('\n') ? '\n' : '') + source.slice(range.end);
  compileDocument(next); return next;
}
