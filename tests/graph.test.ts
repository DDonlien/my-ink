import { describe, expect, it } from 'vitest';
import { compileDocument, parseStoryDocument } from '../src/core/document';
import { storyStructure, sceneStructure } from '../src/graph/model';
import { manCatCase } from '../src/samples';
import { layoutStructure } from '../src/graph/layout';
import { applyStructuralDrop, replaceBlock, structuralDrop } from '../src/graph/edits';
import { StoryRunner } from '../src/core/runtime';
import { withStateOrigins } from '../src/graph/origins';

const ink = (body: string) => '# 对话\n\n```ink\n-> start\n=== start ===\n' + body + '\n```\n';

describe('dialogue structure', () => {
  it('keeps four uninterrupted NPC lines in one box and splits both options', () => {
    const source = ink('邻居：第一句。\n邻居：第二句。\n邻居：第三句。\n邻居：第四句。\n* [追问]\n    邻居：回答。\n    -> END\n* [离开]\n    周渡：再见。\n    -> END');
    const graph = storyStructure(parseStoryDocument(source));
    expect(graph.blocks[0].text.split('\n')).toHaveLength(4);
    expect(graph.blocks[0].ports.map(p => p.label)).toEqual(['追问', '离开']);
    const answers = graph.links.filter(e => e.source === graph.blocks[0].id).map(e => graph.blocks.find(b => b.id === e.target)?.text);
    expect(answers).toEqual(['邻居：回答。', '周渡：再见。']);
    expect(graph.blocks.filter(b => b.kind === 'end')).toHaveLength(2);
  });
  it('preserves nested options and their two separate merges', () => {
    const source = ink('开场\n* [甲]\n    甲段\n    ** [甲一]\n        内一\n    ** [甲二]\n        内二\n    -- 汇合甲\n* [乙]\n    乙段\n- (join) 大汇合\n-> END');
    compileDocument(source);
    const graph = storyStructure(parseStoryDocument(source));
    expect(graph.blocks[0].ports.map(p => p.label)).toEqual(['甲', '乙']);
    const first = graph.blocks.find(b => b.text === '甲段')!;
    expect(first.ports.map(p => p.label)).toEqual(['甲一', '甲二']);
    const merge = graph.blocks.find(b => b.text === '汇合甲')!;
    expect(graph.links.filter(e => e.target === merge.id)).toHaveLength(2);
    expect(graph.blocks.find(b => b.address === 'start.join')).toBeTruthy();
  });
  it('shows waits, conditional results, and external returns in the real case', () => {
    const graph = storyStructure(parseStoryDocument(manCatCase));
    const cat = sceneStructure(graph, 'cat-niche');
    expect(cat.blocks.some(b => b.kind === 'action' && b.text.includes('await npc.move'))).toBe(true);
    expect(cat.blocks.some(b => b.kind === 'condition')).toBe(true);
    expect(cat.blocks.some(b => b.text.includes('账页边角拖出来'))).toBe(true);
    expect(graph.blocks.length).toBeGreaterThan(70);
    expect(graph.blocks.some(b => b.kind === 'call' && b.reference === 'neighbor_testimony')).toBe(true);
    for (const edge of graph.links) {
      expect(graph.blocks.some(b => b.id === edge.source)).toBe(true);
      expect(graph.blocks.some(b => b.id === edge.target)).toBe(true);
    }
  });
  it('renders the sample neighbor as four lines, two question routes and separate endings', () => {
    const graph = sceneStructure(storyStructure(parseStoryDocument(manCatCase)), 'neighbor');
    expect(graph.blocks[0].text.split('\n')).toHaveLength(4);
    expect(graph.blocks[0].ports.map(p => p.label)).toHaveLength(2);
    expect(graph.blocks.filter(b => b.kind === 'end')).toHaveLength(2);
    expect(graph.blocks.filter(b => b.ports.some(port => port.choice))).toHaveLength(1);
    expect(graph.blocks.filter(b => b.kind === 'dialogue')).toHaveLength(3);
  });
  it('preserves variable placeholders and protects boxes sharing an inline-branch source line', () => {
    const source = '# 对话\n\n```ink\nVAR score = 3\n=== start ===\n邻居：你给我{score}枚硬币。\n邻居：{score > 1:足够|不够}了。\n-> END\n```\n';
    const graph = storyStructure(parseStoryDocument(source));
    expect(graph.blocks.some(b => b.text.includes('{score}'))).toBe(true);
    expect(graph.blocks.find(b => b.kind === 'condition')?.text).toBe('score > 1');
    expect(graph.blocks.filter(b => ['足够', '不够', '了。'].includes(b.text)).every(b => !b.editable)).toBe(true);
  });
});

describe('canonical horizontal layout', () => {
  it('gives identical positions and routes on re-open, ignores old free coordinates', async () => {
    const first = parseStoryDocument(manCatCase);
    const oldLayout = parseStoryDocument(manCatCase.replace('schema: 1', 'schema: 1\nlayout:\n  neighbor_testimony: { x: 8000, y: -1500 }'));
    const scene = sceneStructure(storyStructure(first), 'neighbor');
    const a = await layoutStructure(scene);
    const b = await layoutStructure(sceneStructure(storyStructure(oldLayout), 'neighbor'));
    expect(a).toEqual(b);
    for (const edge of scene.links) {
      const source = a.blocks[edge.source], target = a.blocks[edge.target];
      expect(target.x).toBeGreaterThan(source.x + source.width);
      const route = a.routes[edge.id];
      const port = source.ports.find(port => port.id === edge.port)!;
      expect(route[0].x).toBeCloseTo(source.x + port.x);
      expect(route[0].y).toBeCloseTo(source.y + port.y);
      if (port.height) {
        expect(port.x).toBeLessThan(source.width);
        expect(route[1].x).toBeCloseTo(source.x + source.width);
        expect(route[1].y).toBeCloseTo(route[0].y);
      }
      expect(route.at(-1)?.x).toBeCloseTo(target.x);
      for (let i = 1; i < route.length; i++) expect(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y).toBe(true);
    }
    const answers = scene.links.filter(e => e.source === scene.blocks[0].id).map(e => a.blocks[e.target]);
    expect(answers[0].y).toBeLessThan(answers[1].y);
    expect(answers[0].y + answers[0].height).toBeLessThan(answers[1].y);
  });
  it('lays out every case segment without overlap or backwards forward links', async () => {
    const structure = withStateOrigins(storyStructure(parseStoryDocument(manCatCase)));
    for (const scope of [...structure.scenes.map(s => s.id), '__all']) {
      const graph = sceneStructure(structure, scope);
      const layout = await layoutStructure(graph);
      for (let i = 0; i < graph.blocks.length; i++) for (let j = i + 1; j < graph.blocks.length; j++) {
        const a = layout.blocks[graph.blocks[i].id], b = layout.blocks[graph.blocks[j].id];
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, scope + ': overlapping boxes').toBe(true);
      }
      for (const edge of graph.links) {
        const a = layout.blocks[edge.source], b = layout.blocks[edge.target];
        expect(b.x, scope + ': backwards link').toBeGreaterThan(a.x + a.width);
        const route = layout.routes[edge.id];
        const port = a.ports.find(port => port.id === edge.port)!;
        expect(route[0]).toEqual({ x: a.x + port.x, y: a.y + port.y });
        if (port.height) expect(port.y > port.top && port.y < port.top + port.height, scope + ': source belongs to its option row').toBe(true);
        for (let i = 1; i < route.length; i++) for (const node of graph.blocks.filter(node => node.id !== edge.source && node.id !== edge.target)) {
          const box = layout.blocks[node.id], p = route[i - 1], q = route[i];
          const through = p.y === q.y
            ? p.y > box.y && p.y < box.y + box.height && Math.max(p.x, q.x) > box.x && Math.min(p.x, q.x) < box.x + box.width
            : p.x > box.x && p.x < box.x + box.width && Math.max(p.y, q.y) > box.y && Math.min(p.y, q.y) < box.y + box.height;
          expect(through, scope + ': line through a third box').toBe(false);
        }
      }
    }
  });
});

describe('structural edits', () => {
  const source = '# 分支\n\n```ink\n=== start ===\n# on: start\n四句之前\n* [甲]\n    -> a\n* [乙]\n    -> b\n=== a ===\n甲的答案\n-> END\n=== b ===\n乙的答案\n-> END\n```\n';
  it('swaps complete sibling branches, keeping their answers and surrounding Markdown', async () => {
    const graph = storyStructure(parseStoryDocument(manCatCase));
    const scene = sceneStructure(graph, 'neighbor');
    const branches = scene.links.filter(e => e.source === 'neighbor_testimony');
    const plan = structuralDrop(graph, scene, branches[0].target, branches[1].target)!;
    expect(plan.kind).toBe('order');
    const next = applyStructuralDrop(manCatCase, plan);
    const runner = new StoryRunner(compileDocument(next));
    runner.choose(runner.choices[0].instanceId, 0); // accept commission
    runner.choose(runner.choices[0].instanceId, 0); // rescue cat
    const group = runner.choices[0];
    runner.choose(group.instanceId, group.choices.find(c => c.text.includes('楼上的邻居'))!.index);
    expect(runner.choices[0].choices[0].text).toContain('复核');
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.transcript.some(t => t.text.includes('从门缝复看'))).toBe(true);
    expect(runner.world.neighbor_checked).toBe(true);
    expect(next.slice(0, plan.moving.branch!.range.start)).toBe(manCatCase.slice(0, plan.moving.branch!.range.start));
    expect(next.slice(plan.target.branch!.range.end)).toBe(manCatCase.slice(plan.target.branch!.range.end));
    const moved = sceneStructure(storyStructure(parseStoryDocument(next)), 'neighbor');
    expect(moved.blocks[0].ports[0].label).toContain('复核');
    const layout = await layoutStructure(moved);
    const answers = moved.links.filter(e => e.source === 'neighbor_testimony').map(e => layout.blocks[e.target]);
    expect(answers[0].y).toBeLessThan(answers[1].y);
  });
  it('changes real jump targets on successor-slot drops and restores the same layout after reopening', async () => {
    const graph = storyStructure(parseStoryDocument(source));
    const scene = sceneStructure(graph, '__all');
    const edge = graph.links.find(e => e.target === 'b')!;
    const plan = structuralDrop(graph, scene, 'a', edge.source, edge.port)!;
    expect(plan.kind).toBe('successor');
    const next = applyStructuralDrop(source, plan);
    const runner = new StoryRunner(compileDocument(next));
    runner.choose(runner.choices[0].instanceId, 0);
    expect(runner.transcript.some(t => t.text === '乙的答案')).toBe(true);
    expect(next).not.toContain('layout:');
    const reordered = sceneStructure(storyStructure(parseStoryDocument(next)), '__all');
    const shape = await layoutStructure(reordered);
    const branches = reordered.links.filter(e => e.source === 'start');
    expect(shape.blocks[branches[0].target].y).toBeLessThan(shape.blocks[branches[1].target].y);
    expect(await layoutStructure(sceneStructure(storyStructure(parseStoryDocument(next)), '__all'))).toEqual(shape);
  });
  it('has no structural effect for blank space, the same box, unrelated boxes or an ambiguous merge', () => {
    const graph = storyStructure(parseStoryDocument(source)), scene = sceneStructure(graph, '__all');
    expect(structuralDrop(graph, scene, 'a', 'blank')).toBeUndefined();
    expect(structuralDrop(graph, scene, 'a', 'a')).toBeUndefined();
    expect(structuralDrop(graph, scene, 'a', graph.blocks.find(b => b.kind === 'end')!.id)).toBeUndefined();
    const joined = { ...graph, links: [...graph.links, { ...graph.links[0], id: 'second-entry', target: 'a' }] };
    expect(structuralDrop(joined, joined, 'a', 'b')).toBeUndefined();
  });
  it('edits one continuous response only, preserving its choice, sibling, and return', () => {
    const graph = sceneStructure(storyStructure(parseStoryDocument(manCatCase)), 'neighbor');
    const block = graph.blocks.find(b => b.text.includes('你看见他的脸了吗'))!;
    const original = manCatCase.slice(block.range!.start, block.range!.end);
    const next = replaceBlock(manCatCase, block.range!, original.replace('先把衣服和人分开记', '把亲见和推断分开记录'));
    expect(next).toContain('* [追问：你看见他的脸了吗？]');
    expect(next).toContain('* [复核：带我看看你当时的站位]');
    expect(next).toContain('~ neighbor_checked = true\n    ->->');
    expect(next.slice(0, block.range!.start)).toBe(manCatCase.slice(0, block.range!.start));
    expect(next.slice(block.range!.start + (next.length - manCatCase.length) + original.length)).toBe(manCatCase.slice(block.range!.end));
  });
});
