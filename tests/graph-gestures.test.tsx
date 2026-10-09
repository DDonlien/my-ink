// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Edge, Node, ReactFlowProps } from '@xyflow/react';
import { StoryGraph } from '../src/components/StoryGraph';
import { parseStoryDocument } from '../src/core/document';
import type { StoryBlock } from '../src/graph/model';
import type { BlockGeometry } from '../src/graph/layout';
import { manCatCase } from '../src/samples';
import { compileDocument } from '../src/core/document';
import { StoryRunner } from '../src/core/runtime';

type HarnessNode = Node<{ block: StoryBlock; shape: BlockGeometry }, 'story'>;
type HarnessProps = ReactFlowProps<HarnessNode, Edge>;
const observed = vi.hoisted(() => ({ current: undefined as HarnessProps | undefined }));
vi.mock('@xyflow/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    ReactFlow: (props: HarnessProps) => { observed.current = props; return <actual.ReactFlow {...props} />; },
    // This DOM harness delivers coordinates already in graph space. It tests
    // gesture callbacks and write-back, not a browser's viewport or pointer API.
    useReactFlow: () => ({ ...actual.useReactFlow(), screenToFlowPosition: (point: { x: number; y: number }) => point }),
  };
});
afterEach(cleanup);
const source = '# 对话\n\n```ink\n=== start ===\n# on: start\n邻居：一。\n邻居：二。\n邻居：三。\n邻居：四。\n* [追问]\n    回答一。\n    -> END\n* [复核]\n    回答二。\n    -> END\n```\n';
const props = (document = parseStoryDocument(source)) => ({ document, activeKnots: [], onChange: vi.fn(), onError: vi.fn(), onJump: vi.fn() });
const graphReady = () => waitFor(() => expect(observed.current?.nodes?.length).toBeGreaterThan(0));

describe('graph gesture callbacks in a DOM harness', () => {
  it('shows results with an actual event source and no raw editing or write-back footer', async () => {
    observed.current = undefined;
    const text = '# 状态\n\n```ink\nVAR case_started = false\n=== start ===\n# on: start\n~ case_started = true\n-> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    const node = view.container.querySelector('.react-flow__node[data-id="start"]')! as HTMLElement;
    expect(within(node).getByText('状态结果')).toBeVisible();
    expect(within(node).getByText('已接下委托：')).toBeVisible();
    expect(within(node).getByText('来自事件 · start')).toBeVisible();
    expect(within(node).getByText('是')).toBeVisible();
    expect(node.querySelector('.node-prose')).toBeNull();
    fireEvent.click(within(node).getByRole('link', { name: /查看原文/ }));
    expect(callbacks.onJump).toHaveBeenCalledWith(7);
    fireEvent.click(node);
    const inspector = screen.getByRole('region', { name: '查看节点 · start' });
    expect(within(inspector).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(inspector).queryByText('状态语句')).not.toBeInTheDocument();
    expect(inspector.querySelector('.node-editor-footer')).toBeNull();
    expect(within(inspector).queryByRole('button', { name: '写回 Markdown' })).not.toBeInTheDocument();
    expect(callbacks.onChange).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('returns from the first-case result to the exact original option, in merged and split views', async () => {
    observed.current = undefined;
    const callbacks = props(parseStoryDocument(manCatCase)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    for (const mode of ['merged', 'split']) {
      if (mode === 'split') {
        fireEvent.change(screen.getByRole('combobox', { name: '顺序对话显示' }), { target: { value: 'split' } });
        await waitFor(() => expect(observed.current?.nodes?.some(node => node.id === 'job_interview::step-4')).toBe(true));
      }
      const result = observed.current!.nodes!.find(node => !node.data.block.sequence && node.data.block.stateChanges?.some(change => change.variable === 'case_started'))!;
      act(() => observed.current!.onNodeClick!(new MouseEvent('click') as never, result));
      const inspector = screen.getByRole('region', { name: '查看节点 · 回声地产 · 试岗' });
      expect(within(inspector).getByText('已接下委托：')).toBeVisible();
      expect(inspector.querySelector('.node-editor-footer')).toBeNull();
      fireEvent.click(within(inspector).getByRole('button', { name: '定位原始对话 · 接下旧公寓的查验委托' }));
      expect(screen.queryByRole('region', { name: '查看节点 · 回声地产 · 试岗' })).not.toBeInTheDocument();
      const origin = view.container.querySelector('.knot-node.is-origin')!;
      expect(origin.closest('.react-flow__node')).toHaveAttribute('data-id', mode === 'split' ? 'job_interview::step-4' : 'job_interview');
      expect(origin.querySelector('.node-option.is-origin-option')).toHaveTextContent('接下旧公寓的查验委托');
    }
    expect(callbacks.onChange).not.toHaveBeenCalled();
    expect(callbacks.onJump).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('resolves an origin in another scene and focuses it after that scene has been laid out', async () => {
    observed.current = undefined;
    const text = '# 跨段落\n\n```ink\nVAR accepted = false\n=== start ===\n# on: start\n邀请。\n* [接受]\n    -> result\n=== result ===\n~ accepted = true\n-> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.change(screen.getByRole('combobox', { name: '剧情图段落' }), { target: { value: 'result' } });
    await waitFor(() => expect(view.container.querySelector('.react-flow__node[data-id="result"]')).not.toBeNull());
    fireEvent.click(view.container.querySelector('.react-flow__node[data-id="result"]')!);
    fireEvent.click(within(screen.getByRole('region', { name: '查看节点 · result' })).getByRole('button', { name: '定位原始对话 · 接受' }));
    await waitFor(() => expect(view.container.querySelector('.react-flow__node[data-id="start"] .knot-node.is-origin')).not.toBeNull());
    expect(screen.getByRole('combobox', { name: '剧情图段落' })).toHaveValue('start');
    expect(callbacks.onChange).not.toHaveBeenCalled();
  });
  it('edits actual conditions through structured controls and applies a different runtime branch without Markdown controls', async () => {
    observed.current = undefined;
    const text = '# 查验\n\n```ink\nVAR cat_alive = false\n=== start ===\n# on: start\n{cat_alive:\n    喂猫。\n- else:\n    先救猫。\n}\n-> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.click(view.container.querySelector('.react-flow__node[data-id="start"]')!);
    const inspector = screen.getByRole('region', { name: '查看节点 · 条件分支' });
    expect(within(inspector).queryByRole('textbox')).not.toBeInTheDocument();
    expect(inspector.querySelector('.node-editor-footer')).toBeNull();
    fireEvent.click(within(inspector).getByRole('button', { name: '修改条件' }));
    const dialog = screen.getByRole('dialog', { name: '修改条件 · 查验条件' });
    expect(within(dialog).queryByRole('button', { name: '写回 Markdown' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: '条件 · 查验条目' })).toHaveValue('cat_alive');
    fireEvent.change(within(dialog).getByRole('combobox', { name: '条件 · 结果' }), { target: { value: 'false' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '应用条件' }));
    expect(callbacks.onChange, dialog.textContent || '').toHaveBeenCalledTimes(1);
    const next = callbacks.onChange.mock.calls[0][0];
    expect(next).toBe(text.replace('{cat_alive:', '{(not cat_alive):'));
    const runner = new StoryRunner(compileDocument(next));
    expect(runner.transcript.some(entry => entry.text === '喂猫。')).toBe(true);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('presents equivalent checks together and changes all/any through one group control', async () => {
    observed.current = undefined;
    const text = '# 组合\n\n```ink\nVAR cat_alive = true\nVAR cat_fed = false\nVAR room_checked = false\n=== start ===\n# on: start\n{cat_alive and cat_fed and room_checked:可行动。|继续调查。}\n-> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.click(view.container.querySelector('.react-flow__node[data-id="start"]')!);
    fireEvent.click(screen.getByRole('button', { name: '修改条件' }));
    const dialog = screen.getByRole('dialog', { name: '修改条件 · 查验条件' });
    expect(dialog.querySelectorAll('.condition-group')).toHaveLength(1);
    expect(within(dialog).getByRole('combobox', { name: '条件 · 第 3 项 · 查验条目' })).toHaveValue('room_checked');
    fireEvent.change(within(dialog).getByRole('combobox', { name: '条件 · 通过方式' }), { target: { value: 'or' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '应用条件' }));
    expect(callbacks.onChange).toHaveBeenCalledTimes(1);
    const runner = new StoryRunner(compileDocument(callbacks.onChange.mock.calls[0][0]));
    expect(runner.transcript.some(entry => entry.text === '可行动。')).toBe(true);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('offers readable action results and preserves the actual Ink string when a result is changed', async () => {
    observed.current = undefined;
    const text = '# 行为结果\n\n```ink\nVAR cat_path_result = "blocked"\n=== start ===\n# on: start\n{cat_path_result == "completed":取得。|重试。}\n-> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.click(view.container.querySelector('.react-flow__node[data-id="start"]')!);
    fireEvent.click(screen.getByRole('button', { name: '修改条件' }));
    const dialog = screen.getByRole('dialog', { name: '修改条件 · 查验条件' });
    const result = within(dialog).getByRole('combobox', { name: '条件 · 结果' });
    expect(within(result).getByRole('option', { name: '已完成' })).toHaveValue('completed');
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.change(result, { target: { value: 'blocked' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '应用条件' }));
    const next = callbacks.onChange.mock.calls[0][0];
    expect(next).toContain('(cat_path_result == "blocked")');
    expect(new StoryRunner(compileDocument(next)).transcript.some(entry => entry.text === '取得。')).toBe(true);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('renders the actual predicate and places condition outcomes in connected exit rows', async () => {
    observed.current = undefined;
    const text = '# 判断\n\n```ink\nVAR cat_alive = false\nVAR cat_fed = false\n=== start ===\n# on: start\n{cat_alive and not cat_fed:\n    喂猫。\n- else:\n    先救猫。\n}\n-> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    const node = view.container.querySelector('.react-flow__node[data-id="start"]')! as HTMLElement;
    expect(within(node).getByText('全部满足')).toBeVisible();
    expect(within(node).getByText('黑猫存活 为是')).toBeVisible();
    expect(within(node).getByText('黑猫已恢复体力 为否')).toBeVisible();
    expect(node.querySelectorAll('.node-option')).toHaveLength(2);
    expect(node.querySelector('.node-prose')).toBeNull();
    for (const handle of node.querySelectorAll('.react-flow__handle.source')) expect(handle.closest('.node-option')).not.toBeNull();
    expect(callbacks.onChange).not.toHaveBeenCalled();
  });
  it('allows a choice-only box to edit its label and preserves the complete answer', async () => {
    const text = '# 选项\n\n```ink\n=== start ===\n# on: start\n+ [先问]\n    回答。\n    -> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.click(view.container.querySelector('.react-flow__node[data-id="start"]')!);
    const option = screen.getByRole('textbox', { name: '选项 1' });
    expect(option).not.toHaveAttribute('readonly');
    fireEvent.change(option, { target: { value: '直接询问' } });
    fireEvent.click(screen.getByRole('button', { name: '写回 Markdown' }));
    expect(callbacks.onChange).toHaveBeenCalledWith(text.replace('[先问]', '[直接询问]'));
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('groups glued fragments under one display number and shows one explicit continue boundary', async () => {
    const text = '# 对话\n\n```ink\n=== start ===\n# on: start\n邻居：前半句<>\n后半句。\n周渡：我知道了。\n* [追问]\n    回答。\n    -> DONE\n```\n';
    const callbacks = props(parseStoryDocument(text)); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.click(view.container.querySelector('.react-flow__node[data-id="start"]')!);
    expect(screen.getByRole('textbox', { name: '第 1 次显示 · 内容 1' })).toHaveValue('邻居：前半句');
    expect(screen.getByRole('textbox', { name: '第 1 次显示 · 内容 2' })).toHaveValue('后半句。');
    expect(screen.getByRole('textbox', { name: '第 2 次显示' })).toHaveValue('周渡：我知道了。');
    expect(screen.getAllByText('玩家点击继续')).toHaveLength(1);
    expect(screen.getByText('以下内容同时显示')).toBeVisible();
    expect(callbacks.onChange).not.toHaveBeenCalled();
  });
  it('sends sequential continuation routes and the final real options to ReactFlow without rewriting Ink', async () => {
    observed.current = undefined;
    const callbacks = props(); render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.change(screen.getByRole('combobox', { name: '顺序对话显示' }), { target: { value: 'split' } });
    await waitFor(() => expect(observed.current?.nodes).toHaveLength(8));
    expect(observed.current!.edges).toHaveLength(7);
    const continued = observed.current!.edges!.filter(edge => edge.id.includes('::continue::'));
    expect(continued).toHaveLength(3);
    for (const edge of continued) {
      const from = observed.current!.nodes!.find(node => node.id === edge.source)!;
      const to = observed.current!.nodes!.find(node => node.id === edge.target)!;
      expect(to.position.x).toBeGreaterThan(from.position.x + from.data.shape.width);
      expect(edge.sourceHandle).toBe('next');
      expect(edge.markerEnd).toBeTruthy();
    }
    const choices = observed.current!.edges!.filter(edge => edge.sourceHandle?.startsWith('choice-'));
    expect(choices).toHaveLength(2);
    expect(choices.every(edge => edge.source === 'start::step-3')).toBe(true);
    for (const edge of choices) {
      const handle = document.querySelector('.react-flow__node[data-id="' + edge.source + '"] .react-flow__handle[data-handleid="' + edge.sourceHandle + '"]')!;
      expect(handle.closest('.node-option')).toHaveAttribute('data-port-id', edge.sourceHandle);
    }
    expect(callbacks.onChange).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('allows movement during dragging and snaps blank-space releases to canonical positions without changing source', async () => {
    observed.current = undefined;
    const callbacks = props(); render(<StoryGraph {...callbacks} />); await graphReady();
    const node = observed.current!.nodes!.find(n => n.data.block.text === '回答一。')!;
    const original = { ...node.position };
    act(() => observed.current!.onNodeDragStart!(new MouseEvent('mousedown'), node, [node]));
    act(() => observed.current!.onNodesChange!([{ id: node.id, type: 'position', position: { x: 9000, y: 7000 }, dragging: true }]));
    expect(observed.current!.nodes!.find(n => n.id === node.id)!.position).toEqual({ x: 9000, y: 7000 });
    act(() => observed.current!.onNodeDragStop!(new MouseEvent('mouseup', { clientX: -9000, clientY: -9000 }), { ...node, position: { x: 9000, y: 7000 } }, [node]));
    expect(observed.current!.nodes!.find(n => n.id === node.id)!.position).toEqual(original);
    expect(callbacks.onChange).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    // Keyboard position events outside a structural gesture cannot leave a
    // node floating either.
    act(() => observed.current!.onNodesChange!([{ id: node.id, type: 'position', position: { x: 1, y: 2 } }]));
    expect(observed.current!.nodes!.find(n => n.id === node.id)!.position).toEqual(original);
  });
  it('highlights a sibling drop, writes complete option order, and recomputes canonical positions', async () => {
    observed.current = undefined;
    const callbacks = props(); const view = render(<StoryGraph {...callbacks} />); await graphReady();
    const moving = observed.current!.nodes!.find(n => n.data.block.text === '回答一。')!;
    const target = observed.current!.nodes!.find(n => n.data.block.text === '回答二。')!;
    const event = new MouseEvent('mouseup', { clientX: target.position.x + 100, clientY: target.position.y + 60 });
    act(() => observed.current!.onNodeDragStart!(event, moving, [moving]));
    act(() => observed.current!.onNodeDrag!(event, moving, [moving]));
    expect(view.container.querySelector('.is-drop-target')).not.toBeNull();
    act(() => observed.current!.onNodeDragStop!(event, moving, [moving]));
    const next = callbacks.onChange.mock.calls[0][0] as string;
    expect(next.indexOf('* [复核]')).toBeLessThan(next.indexOf('* [追问]'));
    expect(next).not.toContain('layout:');
    view.rerender(<StoryGraph {...callbacks} document={parseStoryDocument(next)} />);
    await waitFor(() => expect(observed.current?.nodes?.find(n => n.id === 'start')?.data.block.ports[0].label).toBe('复核'));
    const a = observed.current!.nodes!.find(n => n.data.block.text === '回答一。')!;
    const b = observed.current!.nodes!.find(n => n.data.block.text === '回答二。')!;
    expect(b.position.y).toBeLessThan(a.position.y);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
  it('accepts a precise successor slot and writes new jump targets instead of canvas coordinates', async () => {
    observed.current = undefined;
    const text = '# 对话\n\n```ink\n=== start ===\n# on: start\n出发。\n* [甲]\n    -> a\n* [乙]\n    -> b\n=== a ===\n甲的答案\n-> END\n=== b ===\n乙的答案\n-> END\n```\n';
    const callbacks = props(parseStoryDocument(text)); render(<StoryGraph {...callbacks} />); await graphReady();
    fireEvent.change(screen.getByRole('combobox', { name: '剧情图段落' }), { target: { value: '__all' } });
    await waitFor(() => expect(observed.current?.nodes?.some(n => n.id === 'a')).toBe(true));
    const moving = observed.current!.nodes!.find(n => n.id === 'a')!;
    const parent = observed.current!.nodes!.find(n => n.id === 'start')!;
    const port = parent.data.shape.ports[1];
    const event = new MouseEvent('mouseup', { clientX: parent.position.x + port.x, clientY: parent.position.y + port.y });
    act(() => observed.current!.onNodeDragStart!(event, moving, [moving]));
    act(() => observed.current!.onNodeDrag!(event, moving, [moving]));
    expect(document.querySelector('.is-drop-port')).not.toBeNull();
    act(() => observed.current!.onNodeDragStop!(event, moving, [moving]));
    const changed = callbacks.onChange.mock.calls[0][0] as string;
    expect(changed).toContain('* [甲]\n    -> b');
    expect(changed).toContain('* [乙]\n    -> a');
    expect(changed).not.toContain('layout:');
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});
