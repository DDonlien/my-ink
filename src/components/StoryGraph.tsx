import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BaseEdge, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, getSmoothStepPath, useNodesState, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import { ArrowDown, ChevronDown, GitBranch, Maximize2, MessageSquare, Minimize2, Route, SlidersHorizontal, Zap } from '../design/icons';
import type { StoryDocument } from '../core/types';
import { sceneStructure, sequentialStructure, storyStructure, type SequentialDialogueMode, type StoryBlock, type StoryStructure } from '../graph/model';
import { BLOCK_BORDER, BLOCK_CONTENT_TOP, PROSE_LINE_HEIGHT, OPTION_INSET, layoutStructure, type BlockGeometry, type GraphLayout } from '../graph/layout';
import { applyStructuralDrop, structuralDrop, type StructuralDrop } from '../graph/edits';
import { blockDraft, draftChanged, writeBlockDraft, type BlockDraft } from '../graph/content';
import { NodeEditor } from './NodeEditor';
import { StateChangeCard } from './StateChangeCard';
import { ConditionEditor } from './ConditionEditor';
import { withStateOrigins } from '../graph/origins';
import type { ConditionTarget, StateOrigin } from '../graph/semantics';
import '@xyflow/react/dist/style.css';

type StoryNode = Node<{ block: StoryBlock; shape: BlockGeometry; active: boolean; drop?: string; origin?: StateOrigin; sourceLine: number; onSource(line: number): void; onOrigin(origin: StateOrigin): void }, 'story'>;
const kindLabel: Record<StoryBlock['kind'], string> = { dialogue: '对白', condition: '条件判断', action: '行动与等待', call: '调用对话', logic: '逻辑与汇合', end: '对话结束', portal: '继续 / 返回' };
function BlockNode({ data, selected }: NodeProps<StoryNode>) {
  const { block, shape } = data;
  const stateOnly = !!block.stateChanges?.length && !block.sequence;
  const Icon = stateOnly ? SlidersHorizontal : block.kind === 'action' ? Route : block.kind === 'condition' ? GitBranch : block.event ? Zap : MessageSquare;
  const label = stateOnly ? (block.ports.some(port => port.choice) ? '状态结果 → 选择' : '状态结果') : kindLabel[block.kind];
  return <div className={'knot-node ' + (selected ? 'is-selected ' : '') + (data.origin ? 'is-origin ' : '') + (data.active ? 'is-active ' : '') + (data.drop === 'order' ? 'is-drop-target' : '')} style={{ width: shape.width, height: shape.height }}>
    <Handle id="in" type="target" position={Position.Left} isConnectable={false} style={{ top: shape.height / 2 - BLOCK_BORDER, left: -BLOCK_BORDER }} />
    <div className="knot-node-top"><span className={'node-icon ' + (stateOnly ? 'state' : block.kind)}><Icon size={14} /></span><span>{!stateOnly && block.event ? '事件入口 · ' + block.event : label}</span>{data.active && <span className="live-dot" />}</div>
    <strong><a className="node-title-link nodrag nopan" href={'#document-L' + data.sourceLine} title="查看对应原文" aria-label={'查看原文 · ' + block.title + ' · 第 ' + data.sourceLine + ' 行'} onClick={event => { event.preventDefault(); event.stopPropagation(); data.onSource(data.sourceLine); }}>{block.title}</a></strong>
    <div className="node-name">{block.range ? 'L' + block.range.line + ' · ' : ''}{block.knot}</div>
    {!stateOnly && !shape.condition && <div className="node-prose" style={{ top: BLOCK_CONTENT_TOP - BLOCK_BORDER }}>{shape.steps ? shape.steps.map((step, index) => <div className="node-sequence-part" key={index} style={{ top: step.top - BLOCK_CONTENT_TOP, height: step.lines.length * PROSE_LINE_HEIGHT }}>
      {step.separator !== undefined && <span className="node-sequence-divider" style={{ top: step.separator - step.top }}><span role="img" aria-label="玩家点击继续下一句" title="玩家点击继续下一句"><ArrowDown size={10} />点击继续</span></span>}
      {step.lines.map((line, i) => <div key={i}>{line || '\u00a0'}</div>)}
    </div>) : shape.lines.map((line, i) => <div key={i}>{line || '\u00a0'}</div>)}</div>}
    {shape.stateChanges?.map(geometry => <StateChangeCard key={geometry.index} change={block.stateChanges![geometry.index]} geometry={geometry} onOrigin={data.onOrigin} />)}
    {shape.condition && <div className="node-condition-card" style={{ top: shape.condition.top - BLOCK_BORDER, height: shape.condition.height }}>
      <div className="condition-caption">{shape.condition.caption}</div>
      <div className="condition-clauses">{shape.condition.clauses.map((clause, index) => <div className="condition-clause" key={index}>{clause.map((line, i) => <div key={i}>{line}</div>)}</div>)}</div>
    </div>}
    {shape.ports.map(port => port.height > 0
      ? <div key={port.id} className={'node-option ' + (data.origin?.portId === port.id ? 'is-origin-option' : '')} data-port-id={port.id} style={{ top: port.top - BLOCK_BORDER, height: port.height, left: OPTION_INSET - BLOCK_BORDER, right: shape.width - port.x - BLOCK_BORDER }}>
        {port.lines.map((line, i) => <div className="node-option-label" key={i}>{i === 0 ? '↗ ' : '\u00a0\u00a0 '}{line}</div>)}
        {port.condition.map((line, i) => <div className="node-option-condition" key={i}>{i === 0 ? '条件：' : ''}{line}</div>)}
        <span className={'node-option-connector ' + (data.drop === port.id ? 'is-drop-connector' : '')} aria-hidden="true" style={{ top: port.y - port.top - BLOCK_BORDER, width: shape.width - port.x }} />
        <Handle id={port.id} type="source" position={Position.Right} isConnectable={false} style={{ top: port.y - port.top - BLOCK_BORDER }} className={data.drop === port.id ? 'is-drop-port' : ''} />
      </div>
      : <Handle key={port.id} id={port.id} type="source" position={Position.Right} isConnectable={false} style={{ top: port.y - BLOCK_BORDER, right: -BLOCK_BORDER }} className={data.drop === port.id ? 'is-drop-port' : ''} />)}
    {data.drop === 'order' && <div className="node-drop-label">松手交换这两组选项的顺序</div>}
  </div>;
}
type StoryEdge = Edge<{ points?: { x: number; y: number }[]; temporary: boolean; highlighted: boolean }, 'story'>;
function RoutedEdge(props: EdgeProps<StoryEdge>) {
  const points = props.data?.points;
  const path = points?.length && !props.data?.temporary
    ? points.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' ')
    : getSmoothStepPath({ sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY, sourcePosition: Position.Right, targetPosition: Position.Left })[0];
  return <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={{ ...props.style, ...(props.data?.highlighted ? { stroke: 'var(--md-sys-color-primary)', strokeWidth: 3 } : {}) }} />;
}
const nodeTypes = { story: BlockNode }, edgeTypes = { story: RoutedEdge };
interface Props {
  document: StoryDocument; activeKnots: string[];
  dialogueMode?: SequentialDialogueMode; onDialogueModeChange?(mode: SequentialDialogueMode): void;
  onChange(source: string): void; onJump(line: number): void; onError(message: string): void;
}
function GraphCanvas({ document, activeKnots, dialogueMode, onDialogueModeChange, onChange, onJump, onError }: Props) {
  const [localMode, setLocalMode] = useState<SequentialDialogueMode>('merged');
  const mode = dialogueMode || localMode;
  const built = useMemo(() => {
    try { return { structure: storyStructure(document), error: '' }; }
    catch { return { structure: { blocks: [], links: [], scenes: [] }, error: '修正源码中的编译错误后，剧情图会自动更新。' }; }
  }, [document]);
  const structure = useMemo(() => withStateOrigins(sequentialStructure(built.structure, mode)), [built.structure, mode]);
  const [sceneId, setSceneId] = useState('');
  const currentSceneId = structure.scenes.some(s => s.id === sceneId) || sceneId === '__all' ? sceneId : structure.scenes[0]?.id || '';
  const scene = useMemo(() => sceneStructure(structure, currentSceneId), [structure, currentSceneId]);
  const [laidOut, setLaidOut] = useState<{ scene: StoryStructure; result: GraphLayout }>();
  const geometry = laidOut?.scene === scene ? laidOut.result : undefined;
  const [layoutError, setLayoutError] = useState('');
  const [selected, setSelected] = useState<string>();
  const [draftDocument, setDraftDocument] = useState('');
  const [draft, setDraft] = useState<BlockDraft>({ steps: [], choices: [], raw: '' });
  const [expanded, setExpanded] = useState(false);
  const [drop, setDrop] = useState<{ plan: StructuralDrop; node: string; port?: string }>();
  const [dragging, setDragging] = useState(false);
  const dragId = useRef<string | undefined>(undefined);
  const suppressClick = useRef(false);
  const [hint, setHint] = useState('拖到同组选项交换顺序；拖到高亮出口交换后继；空白处归位。');
  const graphElement = useRef<HTMLDivElement>(null);
  const pendingOrigin = useRef<StateOrigin | undefined>(undefined);
  const [originFocus, setOriginFocus] = useState<StateOrigin>();
  const [conditionEdit, setConditionEdit] = useState<ConditionTarget>();
  const { screenToFlowPosition, setViewport, fitView } = useReactFlow();
  const selectedBlock = draftDocument === document.fingerprint ? scene.blocks.find(b => b.id === selected) : undefined;
  const focusOrigin = useCallback((at: BlockGeometry, origin: StateOrigin) => {
    const bounds = graphElement.current?.querySelector('.react-flow')?.getBoundingClientRect();
    const zoom = Math.max(0.15, Math.min(0.82, bounds?.height ? (bounds.height - 44) / at.height : 0.82, bounds?.width ? (bounds.width - 56) / at.width : 0.82));
    void setViewport({ x: 28 - at.x * zoom, y: 22 - at.y * zoom, zoom }, { duration: 250 });
    setOriginFocus(origin);
  }, [setViewport]);
  const goToOrigin = useCallback((origin: StateOrigin) => {
    if (selectedBlock && draftChanged(document.source, selectedBlock, draft)) {
      onError('请先保存或关闭当前对白改稿，再定位来源。'); return;
    }
    const target = structure.blocks.find(block => block.id === origin.blockId);
    if (!target) return;
    setSelected(undefined);
    if (geometry?.blocks[target.id]) focusOrigin(geometry.blocks[target.id], origin);
    else {
      pendingOrigin.current = origin;
      const scope = structure.scenes.find(scope => scope.knots.includes(target.knot));
      setSceneId(scope?.id || '__all');
    }
    setHint('已定位来源：' + origin.label);
  }, [selectedBlock, document.source, draft, structure, geometry, focusOrigin, onError]);
  useEffect(() => {
    let cancelled = false; setLaidOut(undefined); setLayoutError(''); setSelected(undefined); setDrop(undefined);
    dragId.current = undefined; setDragging(false);
    layoutStructure(scene).then(result => {
      if (cancelled) return;
      setLaidOut({ scene, result });
      const origin = pendingOrigin.current, target = origin?.blockId && result.blocks[origin.blockId];
      if (origin && target) { pendingOrigin.current = undefined; focusOrigin(target, origin); return; }
      setOriginFocus(undefined);
      const first = scene.blocks[0] && result.blocks[scene.blocks[0].id];
      if (first) void setViewport({ x: 28 - first.x * 0.82, y: 22 - first.y * 0.82, zoom: 0.82 });
    }).catch(error => { if (!cancelled) setLayoutError('排布失败：' + String(error)); });
    return () => { cancelled = true; };
  }, [scene, setViewport, focusOrigin]);
  const canonical = useMemo<StoryNode[]>(() => geometry ? scene.blocks.map(block => ({
    id: block.id, type: 'story', position: { x: geometry.blocks[block.id].x, y: geometry.blocks[block.id].y },
    initialWidth: geometry.blocks[block.id].width, initialHeight: geometry.blocks[block.id].height,
    style: { width: geometry.blocks[block.id].width, height: geometry.blocks[block.id].height },
    data: { block, shape: geometry.blocks[block.id], active: activeKnots.includes(block.knot), sourceLine: block.range?.line || document.knots.find(knot => knot.id === block.knotId)?.range.line || 1, onSource: onJump, onOrigin: goToOrigin },
  })) : [], [scene, geometry, activeKnots.join(','), document, onJump, goToOrigin]);
  const [nodes, setNodes, onNodesChange] = useNodesState<StoryNode>([]);
  useEffect(() => { if (!dragId.current) setNodes(canonical); }, [canonical, setNodes]);
  const shownNodes = useMemo(() => nodes.map(node => ({ ...node, data: { ...node.data, origin: originFocus?.blockId === node.id ? originFocus : undefined, drop: drop?.node === node.id ? drop.port || 'order' : undefined } })), [nodes, drop, originFocus]);
  const edges = useMemo<StoryEdge[]>(() => geometry ? scene.links.map(edge => ({
    id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.port, targetHandle: 'in', type: 'story',
    markerEnd: { type: MarkerType.ArrowClosed, color: edge.kind === 'event' ? 'var(--md-sys-color-secondary)' : 'var(--ink-color-graph-line)' },
    style: { stroke: edge.kind === 'event' ? 'var(--md-sys-color-secondary)' : 'var(--ink-color-graph-line)', strokeWidth: 2, strokeDasharray: edge.kind === 'event' ? '5 4' : undefined },
    data: { points: geometry.routes[edge.id], temporary: dragging, highlighted: drop?.plan.target.id === edge.id },
  })) : [], [scene, geometry, dragging, drop]);
  const incoming = scene.links.filter(e => e.target === selected && e.branch);
  const siblings = incoming.length === 1 ? scene.links.filter(e => e.branch?.group === incoming[0].branch?.group) : [];
  const siblingIndex = siblings.findIndex(e => e.id === incoming[0]?.id);
  const reorder = (direction: number) => {
    if (selectedBlock && draftChanged(document.source, selectedBlock, draft)) {
      onError('请先写回或关闭当前节点改稿，再调整选项顺序。'); return;
    }
    const target = siblings[siblingIndex + direction];
    if (!selected || !target) return;
    const plan = structuralDrop(structure, scene, selected, target.target);
    if (plan) try { onChange(applyStructuralDrop(document.source, plan)); setHint('选项顺序已写回，按结构重新排布。'); } catch (error) { onError(String(error)); }
  };
  const findDrop = (event: MouseEvent | TouchEvent, movingId: string) => {
    const cursor = 'clientX' in event ? event : event.changedTouches[0];
    if (!cursor || !geometry) return;
    const point = screenToFlowPosition({ x: cursor.clientX, y: cursor.clientY });
    // Exit slots take priority over the box beneath them.
    for (const target of canonical.filter(node => node.id !== movingId)) {
      const shape = target.data.shape;
      for (const port of shape.ports) {
        if (Math.abs(point.x - (shape.x + port.x)) > 46 || Math.abs(point.y - (shape.y + port.y)) > 27) continue;
        const plan = structuralDrop(structure, scene, movingId, target.id, port.id);
        if (plan) return { plan, node: target.id, port: port.id };
      }
    }
    for (const target of canonical.filter(node => node.id !== movingId)) {
      const shape = target.data.shape;
      if (point.x < shape.x || point.x > shape.x + shape.width || point.y < shape.y || point.y > shape.y + shape.height) continue;
      const plan = structuralDrop(structure, scene, movingId, target.id);
      if (plan) return { plan, node: target.id };
    }
  };
  const openBlock = (block: StoryBlock) => {
    if (selectedBlock?.id === block.id) return;
    if (selectedBlock && draftChanged(document.source, selectedBlock, draft)) {
      onError('请先写回或关闭当前节点改稿，再编辑其他节点。'); return;
    }
    if (block.reference) {
      const target = structure.blocks.find(b => b.address === block.reference || b.knot === block.reference);
      const scope = target && structure.scenes.find(s => s.knots.includes(target.knot));
      if (target && scope) {
        if (scope.id === currentSceneId && geometry?.blocks[target.id]) {
          const at = geometry.blocks[target.id]; void setViewport({ x: 28 - at.x * 0.82, y: 22 - at.y * 0.82, zoom: 0.82 });
        } else setSceneId(scope.id);
        setSelected(undefined); return;
      }
    }
    setSelected(block.id);
    setOriginFocus(undefined);
    setDraftDocument(document.fingerprint);
    setDraft(blockDraft(document.source, block));
  };
  return <div ref={graphElement} className={'graph-container ' + (expanded ? 'is-expanded' : '')}>
    <div className="graph-caption">
      <label>段落<select aria-label="剧情图段落" value={currentSceneId} onChange={event => {
        if (selectedBlock && draftChanged(document.source, selectedBlock, draft)) {
          onError('请先写回或关闭当前节点改稿，再切换段落。'); return;
        }
        setHint('拖到同组选项交换顺序；拖到高亮出口交换后继；空白处归位。');
        setSceneId(event.target.value);
      }}>{structure.scenes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}<option value="__all">全篇结构</option></select><ChevronDown size={18} className="graph-select-chevron" /></label>
      <label className="sequential-mode"><select aria-label="顺序对话显示" value={mode} onChange={event => {
        if (selectedBlock && draftChanged(document.source, selectedBlock, draft)) {
          onError('请先写回或关闭当前节点改稿，再切换顺序对话的显示方式。'); return;
        }
        const next = event.target.value as SequentialDialogueMode;
        setHint('拖到同组选项交换顺序；拖到高亮出口交换后继；空白处归位。');
        if (onDialogueModeChange) onDialogueModeChange(next); else setLocalMode(next);
      }}><option value="merged">合并顺序对话</option><option value="split">分解顺序对话</option></select><ChevronDown size={18} className="graph-select-chevron" /></label>
      <span className="graph-toolbar"><span>{scene.blocks.filter(b => b.kind !== 'portal').length} 框 · 左 → 右</span><button className="icon-button" title="查看整个段落" onClick={() => void fitView({ padding: 0.2, maxZoom: 0.85 })}><GitBranch size={15} /></button><button className="icon-button" title={expanded ? '退出大图' : '展开剧情图'} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></span>
    </div>
    <ReactFlow nodes={shownNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodesChange={changes => onNodesChange(changes.filter(change => change.type !== 'position' || !!dragId.current))}
      minZoom={0.08} maxZoom={1.6} deleteKeyCode={null} nodesConnectable={false} edgesReconnectable={false} nodeDragThreshold={5}
      onNodeClick={(_, node) => { if (suppressClick.current) return; openBlock(node.data.block); }}
      onPaneClick={() => setSelected(undefined)}
      onNodeDragStart={(_, node) => { dragId.current = node.id; suppressClick.current = true; setDragging(true); setSelected(undefined); setOriginFocus(undefined); }}
      onNodeDrag={(event, node) => setDrop(findDrop(event, node.id))}
      onNodeDragStop={(event, node) => {
        const result = findDrop(event, node.id);
        dragId.current = undefined; setDragging(false); setDrop(undefined); setNodes(canonical);
        if (result) {
          try { onChange(applyStructuralDrop(document.source, result.plan)); setHint(result.plan.kind === 'order' ? '选项顺序已写回，按结构重新排布。' : '后继连接已交换，按结构重新排布。'); }
          catch (error) { onError(error instanceof Error ? error.message : String(error)); }
        } else setHint('结构没有改变，节点已归位。');
        window.setTimeout(() => { suppressClick.current = false; }, 0);
      }}
      proOptions={{ hideAttribution: true }}
    ><Background gap={24} size={1.2} color="var(--ink-color-graph-dot)" /><Controls position="bottom-right" showInteractive={false} /></ReactFlow>
    {(!geometry || !scene.blocks.length || built.error || layoutError) && <div className="graph-empty">{built.error || layoutError || (!scene.blocks.length ? '添加 Ink 对话后，剧情结构会显示在这里。' : '正在按分支结构排布…')}</div>}
    {selectedBlock && <NodeEditor source={document.source} block={selectedBlock} draft={draft} onDraft={setDraft} onClose={() => setSelected(undefined)}
      onOrigin={goToOrigin} onCondition={target => {
        if (draftChanged(document.source, selectedBlock, draft)) { onError('请先保存或关闭当前对白改稿，再修改条件。'); return; }
        setConditionEdit(target);
      }}
      order={siblings.length > 1 ? { label: incoming[0].branch!.label, index: siblingIndex, total: siblings.length, onMove: reorder } : undefined}
      onSave={() => {
        try { onChange(writeBlockDraft(document.source, selectedBlock, draft)); setSelected(undefined); }
        catch (error) { onError(error instanceof Error ? error.message : String(error)); }
      }} />}
    {conditionEdit && <ConditionEditor key={conditionEdit.id} source={document.source} target={conditionEdit} variables={document.variables} onClose={() => setConditionEdit(undefined)} onApply={onChange} />}
    <div className="graph-legend"><span>{drop ? drop.plan.kind === 'order' ? '松手交换选项顺序' : '松手交换后继连接' : hint}</span></div>
  </div>;
}
export function StoryGraph(props: Props) { return <ReactFlowProvider><GraphCanvas {...props} /></ReactFlowProvider>; }
