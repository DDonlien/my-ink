import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowRight, Check, Clock3, MessageCircle, Route, Sparkles } from '../design/icons';
import { actorLabel, formatTime, placeLabel } from '../core/actions';
import type { StoryRunner } from '../core/runtime';

interface Props {
  runner: StoryRunner | null; disabled: boolean; revision: number;
  onChoose(instance: string, index: number): void; onContinue(instance: string): void; onAutoExpand(enabled: boolean): void; onJump(line: number): void;
}
export function Preview({ runner, disabled, revision, onChoose, onContinue, onAutoExpand, onJump }: Props) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, [revision]);
  if (!runner) return <div className="stage-empty"><Sparkles size={32} /><h2>让故事开始。</h2><p>点击错误信息打开原文，修正后从头预演。</p></div>;
  const choices = runner.choices;
  const continuations = runner.continuations;
  const running = runner.actions.filter(action => action.status === 'running');
  const errored = runner.instances.filter(instance => instance.status === 'error');
  return <><div className="preview-options"><span>{runner.autoExpandDialogue ? '快速测试' : '逐次点击演绎'}</span><label><input type="checkbox" checked={runner.autoExpandDialogue} disabled={disabled} onChange={event => onAutoExpand(event.target.checked)} />自动展开顺序对话</label></div>
  <div className="preview-scroll" data-testid="preview">
    <div className="story-intro">
      <div className="eyebrow"><span className="live-dot" />INTERACTIVE PREVIEW</div>
      <h1>{runner.document.title}</h1>
      <p>两种证言，一份仍待核验的真相。</p>
      <div className="intro-rule"><span /> <Sparkles size={13} /> <span /></div>
    </div>
    <div className="transcript">
      {runner.transcript.map(entry => {
        if (entry.kind === 'narration') return <p className="narration" key={entry.id} onDoubleClick={() => entry.line && onJump(entry.line)}>{entry.text}</p>;
        if (entry.kind === 'choice') return <div className="chosen-line" key={entry.id}><Check size={13} /><span>{entry.text}</span></div>;
        if (entry.kind === 'continue') return <div className="continued-line" key={entry.id} data-testid="continue-click"><span /><ArrowDown size={11} /><small>点击继续</small><span /></div>;
        if (entry.kind === 'action') return <button className="action-line" key={entry.id} onClick={() => entry.line && onJump(entry.line)}><Route size={14} /><span>{entry.text}</span></button>;
        return <div className="dialogue" key={entry.id} onDoubleClick={() => entry.line && onJump(entry.line)}>
          <div className={'avatar ' + (entry.speaker === '周渡' ? 'protagonist' : '')}>{entry.speaker?.slice(0, 1) || '人'}</div>
          <div className="dialogue-body"><div className="speaker">{entry.speaker}<span>对话</span></div><p>{entry.text}</p></div>
        </div>;
      })}
      {continuations.map(instance => <div className="continue-controls" key={instance.id}>
        <button className="continue-button" disabled={disabled} aria-label={'继续对话 · ' + instance.title} onClick={() => onContinue(instance.id)}>继续<ArrowDown size={14} /></button>
        <span>{continuations.length > 1 ? instance.title + ' · ' : ''}点击后显示下一句</span>
      </div>)}
      {choices.map(group => <div className="choice-group" key={group.instanceId}>
        <div className="choice-heading"><MessageCircle size={13} />接下来，你会怎么做？</div>
        {group.choices.map((choice, index) => <button className="choice-button" disabled={disabled} key={choice.index} onClick={() => onChoose(group.instanceId, choice.index)}>
          <span className="choice-number">{String(index + 1).padStart(2, '0')}</span><span>{choice.text}</span><ArrowRight size={16} />
        </button>)}
      </div>)}
      {running.map(action => {
        const percent = Math.min(100, Math.max(0, (runner.time - action.started) / (action.due - action.started) * 100));
        return <div className="waiting-card" key={action.id}>
          <div className="waiting-heading"><div className="waiting-icon"><Route size={18} /></div><div><strong>{actorLabel(action.actor)}正在前往{placeLabel(action.destination)}</strong><p>世界继续运转，这段剧情等待行为结果。</p></div><span className="pill amber"><Clock3 size={11} />等待中</span></div>
          <div className="travel-route"><span>出发地</span><div className="travel-track"><i style={{ width: percent + '%' }} /></div><span>{placeLabel(action.destination)}</span></div>
          <div className="travel-time"><span>已推进 {Math.round((runner.time - action.started) * 60) / 60} / {Math.round((action.due - action.started) * 60) / 60} 小时</span><span>预计 {formatTime(action.due)}</span></div>
        </div>;
      })}
      {errored.length > 0 && <div className="preview-error">有 {errored.length} 段剧情因错误暂停。请在顶栏“事件记录”中查看原因，修正后重新预演。</div>}
      {!choices.length && !continuations.length && !running.length && !errored.length && <div className="chapter-end"><span /><span>这一段暂告一段落</span><span /></div>}
      {!choices.length && !continuations.length && !running.length && runner.events.length > 0 && <p className="stage-hint">可以在顶栏“世界状态”中触发交互，探索后续剧情。</p>}
    </div>
    <div ref={bottom} />
  </div></>;
}
