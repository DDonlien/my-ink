import { stateLabel, stateValueLabel } from '../core/stateLabels';
import type { SourceRange, WorldValue } from '../core/types';

export interface ExpressionAst {
  typeName: string; content?: ExpressionAst[]; text?: string; value?: WorldValue;
  pathIdentifiers?: { name: string }[]; op?: string; opName?: string;
  leftExpression?: ExpressionAst; rightExpression?: ExpressionAst; innerExpression?: ExpressionAst;
  expression?: ExpressionAst; variableIdentifier?: { name: string }; varIdentifier?: { name: string };
  isInc?: boolean; isNewTemporaryDeclaration?: boolean;
}
export type ExpressionView = { kind: 'literal'; value: WorldValue } | { kind: 'variable'; name: string }
  | { kind: 'binary'; op: string; left: ExpressionView; right: ExpressionView }
  | { kind: 'unary'; op: string; child: ExpressionView } | { kind: 'source'; text: string };
export interface StateChange {
  variable: string; operation: 'set' | 'increase' | 'decrease'; value: ExpressionView;
  temporary: boolean; range: SourceRange; beforeStep: number;
  origins?: StateOrigin[];
}
export interface StateOrigin {
  kind: 'dialogue' | 'action' | 'event' | 'story'; label: string;
  blockId?: string; portId?: string; stepIndex?: number;
}
export interface ConditionTarget {
  id: string; label: string; expression: ExpressionView; range: SourceRange; original: string;
  mode?: 'value';
}

// Read compiler nodes without evaluating any expression or touching the live
// world. Unsupported constructs retain their exact source instead of guessing.
export function expressionView(ast: ExpressionAst, source: (ast: ExpressionAst) => string): ExpressionView {
  if (ast.typeName === 'Number' && ast.value !== undefined) return { kind: 'literal', value: ast.value };
  if (ast.typeName === 'String' && ast.content?.every(part => part.typeName === 'Text')) return { kind: 'literal', value: ast.content.map(part => part.text || '').join('') };
  if (ast.typeName === 'ref' && ast.pathIdentifiers?.length) return { kind: 'variable', name: ast.pathIdentifiers.map(part => part.name).join('.') };
  if (ast.typeName === 'BinaryExpression' && ast.leftExpression && ast.rightExpression) return { kind: 'binary', op: ast.opName || '?', left: expressionView(ast.leftExpression, source), right: expressionView(ast.rightExpression, source) };
  if (ast.typeName === 'UnaryExpression' && ast.innerExpression) return { kind: 'unary', op: ast.op || '?', child: expressionView(ast.innerExpression, source) };
  return { kind: 'source', text: source(ast) || '在原文中查看表达式' };
}
export function stateChange(ast: ExpressionAst, range: SourceRange, source: (ast: ExpressionAst) => string): StateChange | undefined {
  const increment = ast.typeName === 'IncDecExpression';
  if (!increment && !['variable assignment', 'temp'].includes(ast.typeName)) return;
  const variable = increment ? ast.varIdentifier?.name : ast.variableIdentifier?.name;
  if (!variable) return;
  return {
    variable, operation: increment ? ast.isInc ? 'increase' : 'decrease' : 'set',
    value: ast.expression ? expressionView(ast.expression, source) : { kind: 'literal', value: 1 },
    temporary: Boolean(ast.isNewTemporaryDeclaration), range, beforeStep: 0,
  };
}
const logicalAnd = (op: string) => ['and', '&&'].includes(op);
const logicalOr = (op: string) => ['or', '||'].includes(op);
export function formatExpression(view: ExpressionView, context?: string): string {
  if (view.kind === 'literal') return stateValueLabel(view.value, context);
  if (view.kind === 'variable') return stateLabel(view.name);
  if (view.kind === 'source') return view.text;
  if (view.kind === 'unary') return ['not', '!'].includes(view.op) ? '并非（' + formatCondition(view.child) + '）' : view.op + '（' + formatExpression(view.child) + '）';
  if (logicalAnd(view.op) || logicalOr(view.op)) return '（' + formatCondition(view.left) + '）' + (logicalAnd(view.op) ? '且' : '或') + '（' + formatCondition(view.right) + '）';
  const operator = ({ '==': '等于', '!=': '不等于', '>': '大于', '<': '小于', '>=': '大于等于', '<=': '小于等于', '?': '包含', '!?': '不包含', '*': '×', '/': '÷', mod: '取余' } as Record<string, string>)[view.op] || view.op;
  const leftContext = view.right.kind === 'variable' ? view.right.name : undefined;
  const rightContext = view.left.kind === 'variable' ? view.left.name : undefined;
  return '（' + formatExpression(view.left, leftContext) + ' ' + operator + ' ' + formatExpression(view.right, rightContext) + '）';
}
export function formatCondition(view: ExpressionView): string {
  if (view.kind === 'variable') return stateLabel(view.name) + ' 为是';
  if (view.kind === 'unary' && ['not', '!'].includes(view.op) && view.child.kind === 'variable') return stateLabel(view.child.name) + ' 为否';
  return formatExpression(view);
}
export function conditionDisplay(view: ExpressionView): { caption: string; clauses: string[] } {
  if (view.kind === 'binary' && (logicalAnd(view.op) || logicalOr(view.op))) {
    const matching = logicalAnd(view.op) ? logicalAnd : logicalOr;
    const flatten = (child: ExpressionView): ExpressionView[] => child.kind === 'binary' && matching(child.op) ? [...flatten(child.left), ...flatten(child.right)] : [child];
    return { caption: logicalAnd(view.op) ? '全部满足' : '任一满足', clauses: flatten(view).map(formatCondition) };
  }
  return { caption: '判断是否', clauses: [formatCondition(view)] };
}
export function changeDisplay(change: StateChange) {
  const value = formatExpression(change.value, change.variable);
  return { label: stateLabel(change.variable), value: change.operation === 'set' ? value : '原值 ' + (change.operation === 'increase' ? '+' : '−') + ' ' + value };
}
