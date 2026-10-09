import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, Route, SlidersHorizontal, Sparkles, XCircle, Zap } from '../design/icons';
import { actorLabel, formatTime, placeLabel, statusLabel } from '../core/actions';
import type { StoryRunner } from '../core/runtime';
import type { ActionStatus, WorldValue } from '../core/types';
import { stateLabel } from '../core/stateLabels';
const eventLabels: Record<string, string> = { 'question.neighbor': '等待期间询问邻居', 'question.restaurant': '等待期间询问老板娘', 'case.reported': '报告提交后的世界回应' };
const logIcons = { state: SlidersHorizontal, event: Zap, story: Sparkles, action: Route, error: XCircle };

function ValueInput({ name, value, disabled, onChange }: { name: string; value: WorldValue; disabled: boolean; onChange(value: WorldValue): void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  if (typeof value === 'boolean') return <button className={'toggle ' + (value ? 'on' : '')} role="switch" aria-checked={value} aria-label={name} disabled={disabled} onClick={() => onChange(!value)}><i /></button>;
  const commit = () => { setFocused(false); if (draft !== String(value)) onChange(typeof value === 'number' ? Number(draft) : draft); };
  return <input className="value-input" aria-label={name} disabled={disabled} type={typeof value === 'number' ? 'number' : 'text'}
    value={focused ? draft : String(value)} placeholder="—" onFocus={() => { setDraft(String(value)); setFocused(true); }}
    onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}
interface Props {
  runner: StoryRunner | null; disabled: boolean; tab: 'world' | 'log';
  onWorld(name: string, value: WorldValue): void; onEvent(event: string): void; onComplete(id: string, status: Exclude<ActionStatus, 'running'>): void;
  onJump(line: number): void;
}
export function Inspector({ runner, disabled, tab, onWorld, onEvent, onComplete, onJump }: Props) {
  const world = runner?.world || {};
  const actions = runner?.actions.filter(a => a.status === 'running') || [];
  return <div className="state-scroll">
    <div className="state-content">
      {tab === 'world' ? <>
        <div className="state-section"><div className="section-heading"><h2>世界状态</h2><span>{Object.keys(world).length} 个变量</span></div>
          <p className="section-description">修改事实，观察剧情如何回应。</p>
          <div className="variables">{Object.entries(world).map(([name, value]) => <div className="variable-row" key={name}>
            <div><span>{stateLabel(name)}</span><code>{name}</code></div>
            <ValueInput name={name} value={value} disabled={disabled} onChange={next => onWorld(name, next)} />
          </div>)}</div>
          {!Object.keys(world).length && <p className="empty-description">用 VAR 声明变量，它们会出现在这里。</p>}
        </div>
        <div className="state-section"><div className="section-heading"><h3>触发交互</h3><Zap size={14} /></div>
          <div className="event-buttons">{runner?.events.map(event => <button key={event} className="event-button" disabled={disabled} onClick={() => onEvent(event)}>
            <span><strong>{eventLabels[event] || event}</strong><code>{event}</code></span><ArrowUpRight size={16} />
          </button>)}</div>
          {!runner?.events.length && <p className="empty-description">为节点添加 # on: 事件名即可从这里触发。</p>}
        </div>
        <div className="state-section"><div className="section-heading"><h3>行为模拟</h3><span className={'pill ' + (actions.length ? 'amber' : 'quiet')}>{actions.length} 进行中</span></div>
          {!actions.length && <div className="empty-actions"><CheckCircle2 size={20} /><p>当前没有等待中的行为</p><span>剧情发出动作后，可在这里模拟结果。</span></div>}
          {actions.map(action => <div className="action-control" key={action.id}>
            <div className="action-control-heading"><Route size={15} /><strong>{actorLabel(action.actor)} → {placeLabel(action.destination)}</strong></div>
            <code>{action.type}</code><div className="action-due"><Clock3 size={11} />{formatTime(action.due)}</div>
            <div className="action-results"><button disabled={disabled} onClick={() => onComplete(action.id, 'completed')}>完成</button><button disabled={disabled} onClick={() => onComplete(action.id, 'blocked')}>受阻</button><button disabled={disabled} onClick={() => onComplete(action.id, 'cancelled')}>取消</button></div>
          </div>)}
          {!!runner?.actions.filter(a => a.status !== 'running').length && <div className="completed-actions">
            {runner.actions.filter(a => a.status !== 'running').slice(-3).map(action => <div key={action.id}><CheckCircle2 size={12} /><span>{actorLabel(action.actor)} → {placeLabel(action.destination)}</span><span>{statusLabel(action.status)}</span></div>)}
          </div>}
        </div>
      </> : <div className="log-list">
        <div className="log-intro"><h2>事件记录</h2><p>点击记录，回到触发它的原文。</p></div>
        {[...(runner?.logs || [])].reverse().map(entry => {
          const Icon = logIcons[entry.kind];
          return <button className={'log-entry ' + entry.kind} key={entry.id} onClick={() => entry.line && onJump(entry.line)} disabled={!entry.line}>
            <span className="log-icon"><Icon size={13} /></span><span className="log-body"><small>{formatTime(entry.time)}</small><strong>{entry.title}</strong>{entry.detail && <span>{entry.detail}</span>}{entry.line && <em>第 {entry.line} 行 <ArrowUpRight size={10} /></em>}</span>
          </button>;
        })}
      </div>}
    </div>
  </div>;
}
