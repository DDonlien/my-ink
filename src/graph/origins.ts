import type { StoryBlock, StoryStructure } from './model';
import type { StateChange, StateOrigin } from './semantics';
import { actorLabel, parseCommand, placeLabel } from '../core/actions';

function actionLabel(block: StoryBlock): string {
  try {
    const command = parseCommand(block.text);
    if (command.mode === 'emit') return command.args.event || '发出事件';
    if (['npc.move', 'npc.travel'].includes(command.target) && command.args.actor && command.args.to) return actorLabel(command.args.actor) + '前往' + placeLabel(command.args.to);
    return command.mode === 'await' ? '等待行为完成' : block.title;
  } catch { return block.title; }
}

// Follow authored control flow, not the preview's current values. At a merge,
// keep every possible source; drawing the graph must never choose a path.
export function stateOrigins(structure: StoryStructure, block: StoryBlock, change: StateChange): StateOrigin[] {
  const insideStep = block.sequence?.findIndex(step => step.range && step.range.start < change.range.start && change.range.start < step.range.end) ?? -1;
  if (insideStep >= 0) return [{ kind: 'dialogue', label: block.title, blockId: block.id, stepIndex: insideStep }];
  if (block.sequence?.length && change.beforeStep > 0) return [{
    kind: 'dialogue', label: block.title, blockId: block.id,
    stepIndex: Math.min(change.beforeStep - 1, block.sequence.length - 1),
  }];
  const origins: StateOrigin[] = [], visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    const incoming = structure.links.filter(link => link.target === id);
    for (const link of incoming) {
      const previous = structure.blocks.find(candidate => candidate.id === link.source);
      if (!previous) continue;
      if (previous.sequence?.length || previous.ports.some(port => port.choice)) {
        const choice = previous.ports.find(port => port.id === link.port && port.choice);
        origins.push({ kind: 'dialogue', label: choice?.label || previous.title, blockId: previous.id,
          portId: choice?.id, stepIndex: choice ? undefined : Math.max(0, (previous.sequence?.length || 1) - 1) });
      } else if (previous.kind === 'action') {
        origins.push({ kind: link.kind === 'event' || previous.title === '发出事件' ? 'event' : 'action', label: actionLabel(previous), blockId: previous.id });
      } else visit(previous.id);
    }
    if (!incoming.length) {
      const root = structure.blocks.find(candidate => candidate.id === id);
      if (root?.event) origins.push({ kind: 'event', label: root.event, ...(root.id !== block.id ? { blockId: root.id } : {}) });
      else if (root && root.id !== block.id) origins.push({ kind: 'story', label: root.title, blockId: root.id });
    }
  };
  visit(block.id);
  if (!origins.length) origins.push(block.sequence?.length
    ? { kind: 'dialogue', label: block.title, blockId: block.id, stepIndex: 0 }
    : { kind: 'story', label: block.title });
  return origins.filter((origin, index) => origins.findIndex(other => other.kind === origin.kind && other.blockId === origin.blockId && other.portId === origin.portId && other.label === origin.label) === index);
}

export function withStateOrigins(structure: StoryStructure): StoryStructure {
  return { ...structure, blocks: structure.blocks.map(block => ({ ...block,
    stateChanges: block.stateChanges?.map(change => ({ ...change, origins: stateOrigins(structure, block, change) })),
  })) };
}

export function originLabel(origin: StateOrigin, multiple = false): string {
  const kind = { dialogue: '对话', action: '行为', event: '事件', story: '剧情' }[origin.kind];
  return (multiple ? '可能来自' : '来自') + kind + ' · ' + origin.label;
}
