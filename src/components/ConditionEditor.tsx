import { useState } from 'react';
import { Check, SlidersHorizontal } from '../design/icons';
import { stateLabel, stateValueLabel, stateValueOptions } from '../core/stateLabels';
import { applyCondition, expressionVariables } from '../graph/conditions';
import { formatCondition, formatExpression, type ConditionTarget, type ExpressionView } from '../graph/semantics';
import { Dialog } from './Dialog';

interface FieldsProps { view: ExpressionView; variables: string[]; name: string; context?: string; onChange(view: ExpressionView): void }
const comparisons: Record<string, string> = { '==': '等于', '!=': '不等于', '>': '大于', '>=': '大于或等于', '<': '小于', '<=': '小于或等于', '?': '包含', '!?': '不包含' };
const calculations: Record<string, string> = { '+': '加上', '-': '减去', '*': '乘以', '/': '除以', '%': '取余', '^': '交集' };
const isAnd = (op: string) => ['and', '&&'].includes(op);
const isOr = (op: string) => ['or', '||'].includes(op);
function logicalParts(view: ExpressionView, matches: (op: string) => boolean, path: ('left' | 'right')[] = []): { view: ExpressionView; path: ('left' | 'right')[] }[] {
  return view.kind === 'binary' && matches(view.op) ? [...logicalParts(view.left, matches, [...path, 'left']), ...logicalParts(view.right, matches, [...path, 'right'])] : [{ view, path }];
}
function replacePart(view: ExpressionView, path: ('left' | 'right')[], next: ExpressionView): ExpressionView {
  if (!path.length) return next;
  if (view.kind !== 'binary') return view;
  const [part, ...tail] = path;
  return { ...view, [part]: replacePart(view[part], tail, next) };
}

function VariableField({ view, variables, name, onChange }: FieldsProps & { view: Extract<ExpressionView, { kind: 'variable' }> }) {
  const available = [...new Set([view.name, ...variables])];
  return <label><span>查验条目</span><select aria-label={name + ' · 查验条目'} value={view.name} onChange={event => onChange({ kind: 'variable', name: event.target.value })}>
    {available.map(variable => <option value={variable} key={variable}>{stateLabel(variable)}</option>)}
  </select></label>;
}

function ValueFields({ view, variables, name, context, onChange }: FieldsProps) {
  const [custom, setCustom] = useState(false);
  const options = stateValueOptions(context);
  const type = view.kind === 'literal' ? typeof view.value : view.kind === 'variable' ? 'variable' : 'expression';
  return <div className="condition-value-fields">
    <label><span>结果类型</span><select aria-label={name + ' · 结果类型'} value={type} onChange={event => {
      const type = event.target.value;
      onChange(type === 'variable' ? { kind: 'variable', name: variables[0] || 'value' } : { kind: 'literal', value: type === 'boolean' ? true : type === 'number' ? 0 : '' });
    }}>
      <option value="boolean">是 / 否</option><option value="number">数字</option><option value="string">文字</option><option value="variable" disabled={!variables.length}>另一个条目</option>
      {type === 'expression' && <option value="expression">原有表达式</option>}
    </select></label>
    {view.kind === 'literal' ? typeof view.value === 'boolean'
      ? <label><span>结果</span><select aria-label={name + ' · 结果'} value={String(view.value)} onChange={event => onChange({ kind: 'literal', value: event.target.value === 'true' })}><option value="true">是</option><option value="false">否</option></select></label>
      : typeof view.value === 'string' && options.length ? <div className="condition-enum-result">
        <label><span>结果</span><select aria-label={name + ' · 结果'} value={!custom && options.includes(view.value) ? view.value : '__custom__'} onChange={event => {
          if (event.target.value === '__custom__') setCustom(true);
          else { setCustom(false); onChange({ kind: 'literal', value: event.target.value }); }
        }}>{options.map(value => <option value={value} key={value}>{context === 'cat_path_result' && !value ? '尚无结果' : stateValueLabel(value, context)}</option>)}<option value="__custom__">自定义结果</option></select></label>
        {(custom || !options.includes(view.value)) && <label><span>自定义结果</span><input aria-label={name + ' · 自定义结果'} value={view.value} onChange={event => onChange({ kind: 'literal', value: event.target.value })} /></label>}
      </div> : <label><span>结果</span><input aria-label={name + ' · 结果'} type={typeof view.value === 'number' ? 'number' : 'text'} step="any" value={typeof view.value === 'number' && !Number.isFinite(view.value) ? '' : String(view.value)}
        onChange={event => onChange({ kind: 'literal', value: typeof view.value === 'number' ? event.target.value === '' ? NaN : Number(event.target.value) : event.target.value })} /></label>
      : view.kind === 'variable' ? <VariableField {...{ view, variables, name, onChange }} />
      : <span className="condition-retained-expression">{formatExpression(view)}</span>}
  </div>;
}

function ExpressionFields({ view, variables, name, onChange }: FieldsProps) {
  if (view.kind === 'binary' && (isAnd(view.op) || isOr(view.op))) {
    const parts = logicalParts(view, isAnd(view.op) ? isAnd : isOr);
    return <fieldset className="condition-group">
    <legend>组合查验</legend>
    <label className="condition-join"><span>通过方式</span><select aria-label={name + ' · 通过方式'} value={isAnd(view.op) ? 'and' : 'or'} onChange={event => onChange(parts.map(part => part.view).reduce((left, right) => ({ kind: 'binary', op: event.target.value, left, right })))}><option value="and">全部满足</option><option value="or">任一满足</option></select></label>
    {parts.map((part, index) => <ExpressionFields key={index} view={part.view} variables={variables} name={name + ' · 第 ' + (index + 1) + ' 项'} onChange={next => onChange(replacePart(view, part.path, next))} />)}
  </fieldset>;
  }
  const booleanVariable = view.kind === 'variable' ? view : view.kind === 'unary' && ['!', 'not'].includes(view.op) && view.child.kind === 'variable' ? view.child : undefined;
  if (booleanVariable) return <div className="condition-row boolean-check">
    <VariableField view={booleanVariable} variables={variables} name={name} onChange={next => onChange(view.kind === 'unary' ? { ...view, child: next } : next)} />
    <span className="condition-colon">：</span>
    <label><span>结果</span><select aria-label={name + ' · 结果'} value={view.kind === 'unary' ? 'false' : 'true'} onChange={event => onChange(event.target.value === 'true' ? booleanVariable : { kind: 'unary', op: 'not', child: booleanVariable })}><option value="true">是</option><option value="false">否</option></select></label>
  </div>;
  if (view.kind === 'binary') {
    const operators = calculations[view.op] ? calculations : comparisons;
    const caption = calculations[view.op] ? '计算方式' : '比较方式';
    return <div className="condition-comparison">
    <div className="condition-row">
      {view.left.kind === 'variable' ? <VariableField view={view.left} variables={variables} name={name} onChange={left => onChange({ ...view, left })} />
        : <ValueFields view={view.left} variables={variables} name={name + ' · 左侧'} onChange={left => onChange({ ...view, left })} />}
      <label><span>{caption}</span><select aria-label={name + ' · ' + caption} value={view.op} onChange={event => onChange({ ...view, op: event.target.value })}>
        {!operators[view.op] && <option value={view.op}>{view.op}</option>}{Object.entries(operators).map(([op, label]) => <option value={op} key={op}>{label}</option>)}
      </select></label>
    </div>
    <ValueFields view={view.right} variables={variables} name={name} context={view.left.kind === 'variable' ? view.left.name : undefined} onChange={right => onChange({ ...view, right })} />
  </div>;
  }
  if (view.kind === 'unary') return <fieldset className="condition-group"><legend>{['!', 'not'].includes(view.op) ? '以下条件不成立' : '原有运算：' + view.op}</legend><ExpressionFields view={view.child} variables={variables} name={name + ' · 内部'} onChange={child => onChange({ ...view, child })} /></fieldset>;
  return <ValueFields {...{ view, variables, name, onChange }} />;
}

export function ConditionEditor({ source, target, variables, onClose, onApply }: { source: string; target: ConditionTarget; variables: string[]; onClose(): void; onApply(source: string): void }) {
  const [expression, setExpression] = useState(target.expression), [error, setError] = useState('');
  const available = [...new Set([...variables, ...expressionVariables(target.expression)])];
  const changed = JSON.stringify(expression) !== JSON.stringify(target.expression);
  return <Dialog title={'修改条件 · ' + target.label} className="condition-dialog" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); try { const next = applyCondition(source, target, expression); onApply(next); onClose(); } catch (error) { setError(error instanceof Error ? error.message : String(error)); } }}>
      <div className="condition-form-fields">
        {target.mode === 'value' ? expression.kind === 'variable' ? <VariableField view={expression} variables={available} name="匹配条目" onChange={setExpression} /> : <ValueFields view={expression} variables={available} name="匹配结果" onChange={setExpression} />
          : <ExpressionFields view={expression} variables={available} name="条件" onChange={setExpression} />}
      </div>
      <div className="condition-preview"><SlidersHorizontal size={15} /><span>{target.mode === 'value' ? formatExpression(expression) : formatCondition(expression)}</span></div>
      {error && <p className="condition-form-error" role="alert">{error}</p>}
      <div className="condition-form-actions"><button className="button" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit" disabled={!changed}><Check size={15} />应用条件</button></div>
    </form>
  </Dialog>;
}
