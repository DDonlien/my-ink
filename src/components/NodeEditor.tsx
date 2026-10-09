import { ArrowDown, ArrowDownRight, ArrowUp, Check, GitBranch, X } from '../design/icons';
import type { StoryBlock } from '../graph/model';
import { canEditContent, draftChanged, editableChoices, type BlockDraft } from '../graph/content';
import { StateChangeCard } from './StateChangeCard';
import { conditionDisplay, formatCondition, formatExpression, type ConditionTarget, type StateOrigin } from '../graph/semantics';
import { conditionTargets } from '../graph/conditions';

interface Props {
  source: string; block: StoryBlock; draft: BlockDraft;
  onDraft(draft: BlockDraft): void; onClose(): void; onSave(): void;
  onOrigin?(origin: StateOrigin): void; onCondition?(target: ConditionTarget): void;
  order?: { label: string; index: number; total: number; onMove(direction: number): void };
}

export function NodeEditor({ source, block, draft, onDraft, onClose, onSave, order, onOrigin, onCondition }: Props) {
  const choices = editableChoices(block), editable = canEditContent(block);
  const inspection = !!block.stateChanges?.length || block.kind === 'condition';
  const title = editable ? '编辑' : block.stateChanges?.length ? '状态结果' : block.kind === 'condition' ? '查验' : '查看';
  const setPart = (group: 'steps' | 'choices', index: number, part: number, text: string) => onDraft({
    ...draft, [group]: draft[group].map((values, i) => i === index ? values.map((value, j) => j === part ? text : value) : values),
  });
  return <section className={'node-editor ' + (!editable && inspection ? 'node-inspector' : '')} aria-label={(editable ? '编辑节点' : '查看节点') + ' · ' + block.title}>
    <div className="node-editor-heading"><span><ArrowDownRight size={15} />{title} · {block.title}</span><button className="icon-button" title="关闭节点面板" onClick={onClose}><X size={16} /></button></div>
    {order && order.total > 1 && <div className="node-branch-controls"><span>选项：{order.label}</span><button className="button small" aria-label="选项上移" disabled={order.index <= 0} onClick={() => order.onMove(-1)}><ArrowUp size={12} />上移</button><button className="button small" aria-label="选项下移" disabled={order.index < 0 || order.index >= order.total - 1} onClick={() => order.onMove(1)}><ArrowDown size={12} />下移</button></div>}
    <div className={'node-editor-body ' + (choices.length ? 'has-choices' : '')}>
      <div className="dialogue-fields">
        {block.sequence?.length ? <>
          <h3>对白与点击顺序</h3>
          <p className="node-editor-help">每个编号是一次显示；文字自动换行不会增加点击。</p>
          {block.sequence.map((step, index) => {
            const number = (block.sequencePart?.index || 0) + index + 1;
            const fragments = step.fragments?.length ? step.fragments : [{ text: step.text }];
            return <div className="dialogue-editor-step" key={index}>
              {number > 1 && <div className="dialogue-click-boundary"><ArrowDown size={12} aria-hidden="true" /><span>玩家点击继续</span></div>}
              {block.stateChanges?.filter(change => change.beforeStep === index).map(change => <StateChangeCard change={change} onOrigin={onOrigin} key={change.range.start} />)}
              <div className="dialogue-step-heading"><span className="dialogue-step-number">{number}</span><span>第 {number} 次显示</span>{number === 1 && <small>进入时显示</small>}{fragments.length > 1 && <small>以下内容同时显示</small>}</div>
              {fragments.map((fragment, part) => <label className="dialogue-fragment" key={part}>
                {fragments.length > 1 && <span>内容 {part + 1}</span>}
                <textarea aria-label={'第 ' + number + ' 次显示' + (fragments.length > 1 ? ' · 内容 ' + (part + 1) : '')}
                  rows={Math.max(2, Math.min(4, Math.ceil(fragment.text.length / 65)))} spellCheck={false}
                  readOnly={!step.editable || !step.fragments?.length}
                  value={draft.steps[index][part]} onChange={event => setPart('steps', index, part, event.target.value)} />
              </label>)}
              {(!step.editable || !step.fragments?.length) && <p className="node-editor-help">含动态或共用内容，点击框名可在原文中编辑。</p>}
            </div>;
          })}
          {block.stateChanges?.filter(change => change.beforeStep >= block.sequence!.length).map(change => <StateChangeCard change={change} onOrigin={onOrigin} key={change.range.start} />)}
          {choices.length > 0 && <div className="dialogue-choice-boundary"><GitBranch size={13} aria-hidden="true" />读完后，玩家作出选择</div>}
          {block.sequencePart && block.ports.some(port => port.id === 'next' && port.label === '继续') && <div className="dialogue-click-boundary"><ArrowDown size={12} aria-hidden="true" /><span>玩家点击继续，进入下一个框</span></div>}
        </> : <>
          {block.stateChanges?.map(change => <StateChangeCard change={change} onOrigin={onOrigin} key={change.range.start} />)}
          {block.kind === 'condition' && <div className="node-editor-condition">
            {block.conditionMode === 'multiple' ? <p>按下面的顺序查验，进入第一个满足条件的分支。</p> : block.predicate && <>
              <span className="condition-caption">{block.conditionMode === 'match' ? '匹配条目' : conditionDisplay(block.predicate).caption}</span>
              {block.conditionMode === 'match' ? <p>{formatExpression(block.predicate)}</p> : conditionDisplay(block.predicate).clauses.map((clause, index) => <p key={index}>{clause}</p>)}
            </>}
            <div className="condition-inspector-branches">{block.ports.map(port => <div key={port.id}><span>{port.label}</span>{port.conditionTarget && onCondition && <button className="button small" onClick={() => onCondition(port.conditionTarget!)}>修改此项</button>}</div>)}</div>
            {block.conditionTarget && onCondition && <button className="button small" onClick={() => onCondition(block.conditionTarget!)}>修改条件</button>}
          </div>}
          {!inspection && <><h3>{block.editable ? '节点内容' : '内容'}</h3>
            <textarea aria-label="节点内容" className="raw-node-content" readOnly={!block.editable} value={draft.raw} onChange={event => onDraft({ ...draft, raw: event.target.value })} spellCheck={false} rows={4} /></>}
          {block.kind === 'condition' && !conditionTargets(block).length && <p className="node-editor-help">此条目保留原有判断。</p>}
        </>}
      </div>
      {choices.length > 0 && <div className="choice-fields">
        <h3>玩家选项</h3><p className="node-editor-help">直接修改玩家看到的选项文字。</p>
        {choices.map((port, index) => <div className="choice-editor-item" key={port.id}>
          <div className="choice-editor-heading"><GitBranch size={12} aria-hidden="true" /><span>选项 {index + 1}</span></div>
          {port.choice!.fragments.length ? port.choice!.fragments.map((fragment, part) => <label key={part}>
            {port.choice!.fragments.length > 1 && <span className="choice-part-label">{fragment.shared ? '共用文字' : '仅选项文字'}</span>}
            <input aria-label={'选项 ' + (index + 1) + (port.choice!.fragments.length > 1 ? ' · ' + (fragment.shared ? '共用文字' : '仅选项文字') : '')}
              value={draft.choices[index][part]} onChange={event => setPart('choices', index, part, event.target.value)} spellCheck={false} />
            {fragment.shared && <small className="node-editor-help">这部分也会在选中后显示。</small>}
          </label>) : <><input aria-label={'选项 ' + (index + 1)} value={port.label} readOnly /><p className="node-editor-help">含动态内容，点击框名可在原文中编辑。</p></>}
          {port.condition && <div className="choice-editor-condition"><p>出现条件：{port.predicate ? formatCondition(port.predicate) : port.condition}</p>{port.conditionTarget && onCondition && <button className="button small" aria-label={'修改选项 ' + (index + 1) + ' 的出现条件'} onClick={() => onCondition(port.conditionTarget!)}>修改出现条件</button>}</div>}
        </div>)}
      </div>}
    </div>
    {editable && <div className="node-editor-footer"><span>对白与选项一起写回，保留点击顺序和分支去向。</span><button className="button primary small" disabled={!draftChanged(source, block, draft)} onClick={onSave}><Check size={13} />写回 Markdown</button></div>}
  </section>;
}
