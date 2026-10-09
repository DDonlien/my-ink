import ELK, { type ElkNode, type ElkPoint } from 'elkjs/lib/elk.bundled.js';
import type { StoryBlock, StoryStructure } from './model';
import { changeDisplay, conditionDisplay, formatCondition, formatExpression } from './semantics';

export interface StateGeometry { index: number; top: number; height: number; label: string[]; value: string[]; inline: boolean }

export interface BlockGeometry {
  x: number; y: number; width: number; height: number; lines: string[];
  steps?: { top: number; lines: string[]; separator?: number }[];
  stateChanges?: StateGeometry[];
  condition?: { top: number; height: number; caption: string; clauses: string[][] };
  ports: { id: string; x: number; y: number; top: number; height: number; lines: string[]; condition: string[] }[];
}
export interface GraphLayout { blocks: Record<string, BlockGeometry>; routes: Record<string, ElkPoint[]> }
const WIDTH = 360;
export const BLOCK_CONTENT_TOP = 108;
export const PROSE_LINE_HEIGHT = 24;
export const OPTION_INSET = 14;
export const BLOCK_BORDER = 1;

// Explicit line breaks keep measurements independent of font-loading timing,
// ResizeObserver order, saved canvas coordinates, and the user's drag history.
export function wrapText(text: string, columns = 22): string[] {
  return text.split('\n').flatMap(line => {
    const rows: string[] = []; let row = '', length = 0;
    for (const character of line) {
      const size = /[\x00-\x7f]/.test(character) ? 0.6 : 1;
      if (length + size > columns && row) { rows.push(row); row = ''; length = 0; }
      row += character; length += size;
    }
    rows.push(row); return rows;
  });
}
function measure(block: StoryBlock): BlockGeometry {
  const lines = wrapText(block.text || '继续');
  let top = BLOCK_CONTENT_TOP;
  const stateChanges: StateGeometry[] = [];
  const appendChanges = (beforeStep: number) => (block.stateChanges || []).forEach((change, index) => {
    if (change.beforeStep !== beforeStep) return;
    const display = changeDisplay(change), label = wrapText(display.label, 20), value = wrapText(display.value, 20);
    const inline = wrapText(display.label + '：' + display.value, 19).length === 1;
    const height = 20 + (inline ? 24 : (label.length + value.length) * 24 + 4) + 6
      + (change.origins?.length || 0) * 20 + (change.temporary ? 20 : 0);
    stateChanges.push({ index, top, height, label, value, inline }); top += height + 8;
  });
  const steps = block.sequence && (block.sequence.length > 1 || block.stateChanges?.length) ? block.sequence.map((step, index) => {
    const separator = index ? top + 15 : undefined;
    if (index) top += 32;
    appendChanges(index);
    const item = { top, lines: wrapText(step.text), separator };
    top += item.lines.length * PROSE_LINE_HEIGHT;
    return item;
  }) : undefined;
  if (block.sequence && steps) {
    if (block.stateChanges?.some(change => change.beforeStep === block.sequence!.length)) top += 8;
    appendChanges(block.sequence.length);
  } else if (block.stateChanges?.length) appendChanges(0);
  let condition: BlockGeometry['condition'];
  if (block.kind === 'condition') {
    const display = block.conditionMode === 'match' ? { caption: '按此值匹配', clauses: [formatExpression(block.predicate || { kind: 'source', text: block.text })] }
      : block.conditionMode === 'multiple' ? { caption: '按顺序判断', clauses: ['逐条判断下面的分支条件'] }
      : conditionDisplay(block.predicate || { kind: 'source', text: block.text });
    const clauses = display.clauses.map(clause => wrapText(clause, 20));
    const height = 46 + clauses.reduce((sum, lines) => sum + lines.length * 24, 0) + Math.max(0, clauses.length - 1) * 8;
    condition = { top, height, caption: display.caption, clauses }; top += height;
  } else if (!steps && !stateChanges.length) top += lines.length * PROSE_LINE_HEIGHT;
  top += 12;
  const ports = block.ports.map(port => {
    const labels = port.label ? wrapText(port.label, 22) : [];
    const condition = port.condition ? wrapText(port.predicate ? formatCondition(port.predicate) : port.condition, 24) : [];
    const height = labels.length * 22 + condition.length * 18 + (labels.length || condition.length ? 20 : 0);
    const geometry = { id: port.id, x: height ? WIDTH - OPTION_INSET : WIDTH, y: height ? top + height / 2 : 0, top, height, lines: labels, condition };
    top += height; return geometry;
  });
  const height = top + 10;
  ports.forEach(port => { if (!port.lines.length && !port.condition.length) port.y = height / 2; });
  return { x: 0, y: 0, width: WIDTH, height, lines, steps, stateChanges, condition, ports };
}

export async function layoutStructure(structure: StoryStructure): Promise<GraphLayout> {
  const blocks = Object.fromEntries(structure.blocks.map(b => [b.id, measure(b)]));
  if (!structure.blocks.length) return { blocks, routes: {} };
  const graph: ElkNode = {
    id: 'story',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.randomSeed': '1', 'elk.spacing.nodeNode': '46',
      'elk.layered.spacing.nodeNodeBetweenLayers': '110',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.padding': '[top=28,left=28,bottom=28,right=28]',
    },
    children: structure.blocks.map(block => {
      const shape = blocks[block.id];
      return {
        id: block.id, width: shape.width, height: shape.height,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
        ports: [
          { id: block.id + '/in', x: 0, y: shape.height / 2, width: 0, height: 0, layoutOptions: { 'elk.port.side': 'WEST' } },
          // ELK places east ports on the outer node boundary. The visible
          // option anchor and its short lead are added to the route below.
          ...shape.ports.map(port => ({ id: block.id + '/' + port.id, x: shape.width, y: port.y, width: 0, height: 0, layoutOptions: { 'elk.port.side': 'EAST' } })),
        ],
      };
    }),
    edges: structure.links.map(edge => ({ id: edge.id, sources: [edge.source + '/' + edge.port], targets: [edge.target + '/in'] })),
  };
  // Bundled ELK uses a synchronous worker shim. It has no terminate() method
  // and is collected after this promise; no browser Worker is started here.
  const elk = new ELK({ algorithms: ['layered'] });
  const result = await elk.layout(graph);
  result.children?.forEach(node => { blocks[node.id].x = node.x || 0; blocks[node.id].y = node.y || 0; });
  const routes: GraphLayout['routes'] = {};
  result.edges?.forEach(edge => {
    const section = edge.sections?.[0];
    if (section) {
      const link = structure.links.find(link => link.id === edge.id)!;
      const source = blocks[link.source], port = source.ports.find(port => port.id === link.port)!;
      routes[edge.id] = [
        ...(port.x < source.width ? [{ x: source.x + port.x, y: source.y + port.y }] : []),
        section.startPoint, ...(section.bendPoints || []), section.endPoint,
      ];
    }
  });
  return { blocks, routes };
}
