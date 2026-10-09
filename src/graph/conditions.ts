import { compileDocument } from '../core/document';
import type { StoryBlock } from './model';
import type { ConditionTarget, ExpressionView } from './semantics';

export function conditionTargets(block: StoryBlock): ConditionTarget[] {
  return [block.conditionTarget, ...block.ports.map(port => port.conditionTarget)].filter((target): target is ConditionTarget => !!target);
}

export function expressionVariables(view: ExpressionView): string[] {
  if (view.kind === 'variable') return [view.name];
  if (view.kind === 'binary') return [...expressionVariables(view.left), ...expressionVariables(view.right)];
  if (view.kind === 'unary') return expressionVariables(view.child);
  return [];
}

// Fields produce an expression, never arbitrary Markdown or branch syntax.
// Parentheses preserve every nested all/any relationship. Uneditable functions
// are retained as authored and are never evaluated by the condition editor.
export function inkExpression(view: ExpressionView): string {
  if (view.kind === 'literal') {
    if (typeof view.value === 'number') {
      if (!Number.isFinite(view.value)) throw new Error('请输入有效的数字。');
      return String(view.value);
    }
    if (typeof view.value === 'boolean') return view.value ? 'true' : 'false';
    if (/[\r\n]/.test(view.value)) throw new Error('文字结果请写在一行内。');
    return '"' + view.value.replace(/[\\"{}|#<>\[\]]/g, '\\$&') + '"';
  }
  if (view.kind === 'variable') {
    if (!/^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/.test(view.name)) throw new Error('请选择有效的查验条目。');
    return view.name;
  }
  if (view.kind === 'source') return view.text;
  // Ink reads (name) as a list literal, and a leading ! inside braces as a
  // sequence marker. Put the unary operator inside the grouping parentheses.
  if (view.kind === 'unary') return '(' + (['!', 'not'].includes(view.op) ? 'not ' : view.op) + inkExpression(view.child) + ')';
  const op = ({ '&&': 'and', '||': 'or' } as Record<string, string>)[view.op] || view.op;
  return '(' + inkExpression(view.left) + ' ' + op + ' ' + inkExpression(view.right) + ')';
}

export function applyCondition(source: string, target: ConditionTarget, expression: ExpressionView): string {
  const { start, end } = target.range;
  if (start < 0 || end <= start || end > source.length || source.slice(start, end) !== target.original) throw new Error('条件已发生变化，请重新打开条件面板。');
  const next = source.slice(0, start) + inkExpression(expression) + source.slice(end);
  compileDocument(next);
  return next;
}
