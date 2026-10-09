import { ArrowUpRight } from '../design/icons';
import { changeDisplay, type StateChange, type StateOrigin } from '../graph/semantics';
import type { StateGeometry } from '../graph/layout';
import { originLabel } from '../graph/origins';

export function StateChangeCard({ change, geometry, onOrigin }: { change: StateChange; geometry?: StateGeometry; onOrigin?(origin: StateOrigin): void }) {
  const display = changeDisplay(change);
  const boolean = change.operation === 'set' && change.value.kind === 'literal' && typeof change.value.value === 'boolean' ? change.value.value ? 'yes' : 'no' : '';
  const label = geometry?.label || [display.label], value = geometry?.value || [display.value];
  return <div className={'state-change-card ' + (geometry ? 'on-graph' : '')} data-variable={change.variable}
    style={geometry ? { top: geometry.top - 1, height: geometry.height } : undefined}>
    <div className={'state-change-row ' + (geometry && !geometry.inline ? 'is-stacked' : '')}>
      <span className="state-change-target" title={change.variable}>{label.map((line, index) => <span key={index}>{line}{index === label.length - 1 ? '：' : ''}</span>)}</span>
      <strong className={'state-change-value ' + boolean}>{value.map((line, index) => <span key={index}>{line}</span>)}</strong>
    </div>
    {change.temporary && <span className="state-temporary-label">临时条目</span>}
    <div className="state-change-origins">
      {change.origins?.map((origin, index) => origin.blockId && onOrigin
        ? <button key={index} type="button" className="state-origin-link nodrag nopan" title={originLabel(origin, change.origins!.length > 1)}
          aria-label={'定位原始' + { dialogue: '对话', action: '行为', event: '事件', story: '剧情' }[origin.kind] + ' · ' + origin.label}
          onClick={event => { event.stopPropagation(); onOrigin(origin); }}><ArrowUpRight size={12} /><span>{originLabel(origin, change.origins!.length > 1)}</span></button>
        : <span className="state-origin-label" key={index}>{originLabel(origin, change.origins!.length > 1)}</span>)}
    </div>
  </div>;
}
