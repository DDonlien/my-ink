import { Compiler, CompilerOptions } from 'inkjs/full';
import { parse as parseYaml } from 'yaml';
import { fingerprint } from '../core/document';
import type { Knot, SourceRange, StoryDocument } from '../core/types';
import { expressionView, stateChange, formatCondition, formatExpression, type ConditionTarget, type ExpressionAst, type ExpressionView, type StateChange } from './semantics';

export type BlockKind = 'dialogue' | 'condition' | 'action' | 'call' | 'logic' | 'end' | 'portal';
export type SequentialDialogueMode = 'merged' | 'split';
export interface TextFragment { text: string; range: SourceRange }
export interface DialogueStep { text: string; range?: SourceRange; editable: boolean; fragments?: TextFragment[] }
export interface BranchSource { group: string; range: SourceRange; label: string }
export interface ChoiceTextFragment extends TextFragment { shared: boolean }
export interface GraphPort { id: string; label: string; condition?: string; predicate?: ExpressionView; conditionTarget?: ConditionTarget; choice?: { fragments: ChoiceTextFragment[] } }
export interface StoryBlock {
  id: string; knot: string; knotId: string; title: string; text: string; kind: BlockKind;
  range?: SourceRange; editable: boolean; address?: string; reference?: string;
  event?: string; when?: string; ports: GraphPort[];
  sequence?: DialogueStep[];
  sequencePart?: { index: number; total: number };
  stateChanges?: StateChange[]; predicate?: ExpressionView;
  conditionMode?: 'match' | 'multiple';
  conditionTarget?: ConditionTarget;
}
export interface StoryLink {
  id: string; source: string; target: string; port: string;
  kind: 'next' | 'jump' | 'event';
  jump?: { range: SourceRange; target: string };
  branch?: BranchSource;
  sequential?: boolean;
}
export interface GraphScene { id: string; title: string; knots: string[] }
export interface StoryStructure { blocks: StoryBlock[]; links: StoryLink[]; scenes: GraphScene[] }

// Compiler AST type names are stable Ink strings, including in the production
// minified bundle. Constructor names and instanceof across bundles are not.
interface Ast extends ExpressionAst {
  typeName: string; content?: Ast[]; name?: string; text?: string;
  debugMetadata?: { startLineNumber: number; endLineNumber: number; startCharacterNumber: number; endCharacterNumber: number };
  condition?: Ast; initialCondition?: Ast; branches?: Ast[];
  ownExpression?: Ast; isElse?: boolean; isInline?: boolean; matchingEquality?: boolean;
  startContent?: Ast; choiceOnlyContent?: Ast; innerContent?: Ast;
  isTunnel?: boolean; isThread?: boolean; isFunctionCall?: boolean; isEnd?: boolean; isDone?: boolean;
  target?: { dotSeparatedComponents: string }; toString(): string;
  isStart?: boolean;
}
interface Exit { block: string; port: string; label?: string; condition?: string; predicate?: ExpressionView; conditionTarget?: ConditionTarget; choice?: GraphPort['choice']; branch?: BranchSource; kind?: StoryLink['kind']; jump?: StoryLink['jump'] }

export function storyStructure(document: StoryDocument): StoryStructure {
  const errors: string[] = [];
  const compiler = new Compiler(document.generatedInk, new CompilerOptions('graph.ink', [], false, (message, kind) => { if (kind === 2) errors.push(message); }, {
    ResolveInkFilename: filename => filename,
    LoadInkFileContents: () => { throw new Error('此版本不加载外部 INCLUDE 文件。'); },
  }));
  const compiled = compiler.Compile();
  if (errors.length || !compiled) throw new Error(errors.join('\n') || '无法读取剧情结构');
  const parsed = compiler.parsedStory as unknown as Ast;
  const sourceLines: { start: number; end: number; text: string }[] = [];
  let offset = 0;
  for (const text of document.source.split('\n')) {
    sourceLines.push({ start: offset, end: offset + text.length + 1, text: text.replace(/\r$/, '') });
    offset += text.length + 1;
  }
  const blocks: StoryBlock[] = [], links: StoryLink[] = [];
  const addresses = new Map<string, string>();
  const pending: { exits: Exit[]; target: string; knot: string }[] = [];
  const counters = new Map<string, number>();
  const lineNumber = (ast: Ast) => document.lineMap[(ast.debugMetadata?.startLineNumber || 1) - 1] || 1;
  const line = (ast: Ast) => sourceLines[lineNumber(ast) - 1];
  const expressionRange = (item: ExpressionAst): SourceRange | undefined => {
    const ast = item as Ast, meta = ast.debugMetadata;
    if (!meta) return;
    const first = line(ast), lastLine = document.lineMap[meta.endLineNumber - 1];
    const last = sourceLines[(lastLine || lineNumber(ast)) - 1];
    // Ink may include the surrounding choice braces or conditional colon in
    // an expression's metadata. They are syntax, rather than part of its value.
    let start = first.start + meta.startCharacterNumber - 1, end = last.start + meta.endCharacterNumber - 1;
    const trim = () => { while (/\s/.test(document.source[start] || '') && start < end) start++; while (/\s/.test(document.source[end - 1] || '') && end > start) end--; };
    trim();
    if (document.source[end - 1] === ':') { end--; trim(); }
    if (document.source[start] === '{' && document.source[end - 1] === '}') { start++; end--; trim(); }
    return end > start ? { start, end, line: lineNumber(ast) } : undefined;
  };
  const expressionSource = (ast: ExpressionAst): string => {
    const range = expressionRange(ast); return range ? document.source.slice(range.start, range.end) : '';
  };
  const conditionTarget = (ast: Ast, label: string, mode?: 'value'): ConditionTarget | undefined => {
    const range = expressionRange(ast);
    return range ? { id: 'condition-' + range.start, label, expression: expressionView(ast, expressionSource), range, original: document.source.slice(range.start, range.end), mode } : undefined;
  };
  const flat = (items: Ast[]): Ast[] => items.flatMap(item => item.typeName === 'ContentList' ? flat(item.content || []) : [item]);
  const significant = (ast: Ast) => ast.typeName !== 'Text' || Boolean(ast.text?.trim());
  const rangeOf = (items: Ast[]): SourceRange | undefined => {
    const intervals = items.filter(significant).flatMap(ast => {
      if (ast.typeName === 'Weave') return (ast.content || []).map(child => rangeOf([child])).filter((r): r is SourceRange => !!r);
      const meta = ast.debugMetadata;
      if (!meta) return [];
      const startLine = lineNumber(ast);
      const lastGenerated = meta.endLineNumber > meta.startLineNumber && meta.endCharacterNumber <= 1 ? meta.endLineNumber - 1 : meta.endLineNumber;
      const endLine = document.lineMap[lastGenerated - 1] || startLine;
      return [{ start: sourceLines[startLine - 1].start, end: Math.min(sourceLines[Math.max(startLine, endLine) - 1].end, document.source.length), line: startLine }];
    });
    if (!intervals.length) return undefined;
    return { start: Math.min(...intervals.map(r => r.start)), end: Math.max(...intervals.map(r => r.end)), line: Math.min(...intervals.map(r => r.line)) };
  };
  const textOf = (items: Ast[]): string => items.map(ast => {
    if (ast.typeName === 'Text') return ast.text || '';
    const meta = ast.debugMetadata, original = line(ast)?.text;
    if (meta && original && meta.startLineNumber === meta.endLineNumber) {
      const start = meta.startCharacterNumber - 1, end = meta.endCharacterNumber - 1;
      if (original[start - 1] === '{' && original[end] === '}') return '{' + original.slice(start, end) + '}';
    }
    return ast.content ? textOf(ast.content) : '';
  }).join('');
  // Exact text spans leave indentation, tags, glue, assignments and branch
  // headers outside a prose edit. AST text has already decoded Ink escapes.
  const textFragments = (items: Ast[]): TextFragment[] => {
    const fragments: TextFragment[] = [];
    for (const ast of items) {
      const meta = ast.debugMetadata;
      if (ast.typeName !== 'Text' || !ast.text?.trim() || !meta || meta.startLineNumber !== meta.endLineNumber) continue;
      const row = line(ast), raw = row.text.slice(meta.startCharacterNumber - 1, meta.endCharacterNumber - 1);
      const start = row.start + meta.startCharacterNumber - 1 + raw.length - raw.trimStart().length;
      const end = row.start + meta.endCharacterNumber - 1 - (raw.length - raw.trimEnd().length);
      if (end > start && !fragments.some(fragment => fragment.range.start === start && fragment.range.end === end)) {
        fragments.push({ text: ast.text.trim(), range: { start, end, line: lineNumber(ast) } });
      }
    }
    return fragments;
  };
  const choiceText = (ast: Ast): GraphPort['choice'] => {
    const contents = [ast.startContent, ast.choiceOnlyContent].filter((part): part is Ast => !!part);
    // Dynamic labels stay in the source editor. Do not replace expressions or
    // tags with the rendered result when editing literal choice text.
    if (contents.some(content => (content.content || []).some(part => part.typeName !== 'Text'))) return { fragments: [] };
    return { fragments: contents.flatMap(content => textFragments(content.content || []).map(fragment => ({ ...fragment, shared: content === ast.startContent }))) };
  };
  const stepsOf = (items: Ast[]): DialogueStep[] => {
    const steps: { text: string; parts: Ast[] }[] = [];
    let text = '', parts: Ast[] = [], glued = false;
    const finish = () => {
      if (text.trim()) steps.push({ text: text.trim(), parts });
      text = ''; parts = [];
    };
    for (const ast of items) {
      if (/^\s*~/.test(line(ast)?.text || '') || ['VAR', 'CONST', 'LIST'].includes(ast.typeName)) continue;
      if (ast.typeName === 'Glue') {
        if (!text.trim() && steps.length) {
          const previous = steps.pop()!;
          text = previous.text; parts = [...previous.parts, ...parts];
        }
        text = text.trimEnd(); parts.push(ast); glued = true; continue;
      }
      const output = textOf([ast]);
      if (!output) continue;
      for (const piece of output.split(/(\n)/)) {
        if (!piece) continue;
        if (piece === '\n') { if (!glued) finish(); }
        else {
          const content = glued ? piece.trimStart() : piece;
          if (content) { text += content; parts.push(ast); glued = false; }
        }
      }
    }
    finish();
    return steps.map(step => ({ text: step.text, range: rangeOf(step.parts), editable: false, fragments: textFragments(step.parts) }));
  };
  const byId = (id: string) => blocks.find(b => b.id === id)!;
  const link = (exits: Exit[], target: string) => exits.forEach(exit => {
    const source = byId(exit.block);
    if (!source.ports.some(p => p.id === exit.port)) source.ports.push({ id: exit.port, label: exit.label || '', condition: exit.condition, predicate: exit.predicate, conditionTarget: exit.conditionTarget, choice: exit.choice });
    links.push({ id: exit.block + '::' + exit.port + '::' + target, source: exit.block, target, port: exit.port, kind: exit.kind || 'next', jump: exit.jump, branch: exit.branch });
  });
  function make(knot: Knot, path: string, kind: BlockKind, text: string, range?: SourceRange, title?: string): StoryBlock {
    const key = knot.id + '::' + path;
    const count = counters.get(key) || 0;
    counters.set(key, count + 1);
    const first = !blocks.some(b => b.knotId === knot.id);
    const block: StoryBlock = {
      id: first ? knot.id : key + '::' + count, knot: knot.name, knotId: knot.id,
      title: title || knot.title, text: text.trim(), kind, range,
      editable: !!range && ['dialogue', 'logic', 'action'].includes(kind), ports: [],
      ...(first ? { address: knot.name, event: knot.on, when: knot.when } : {}),
    };
    blocks.push(block);
    if (first) addresses.set(knot.name, block.id);
    return block;
  }
  const next = (block: StoryBlock): Exit[] => [{ block: block.id, port: 'next' }];
  function sequence(objects: Ast[], incoming: Exit[], knot: Knot, path: string, inline = false): Exit[] {
    const items = flat(objects);
    let exits = incoming;
    let buffer: Ast[] = [];
    let insideTag = false;
    const flush = () => {
      const significantItems = buffer.filter(significant);
      if (!significantItems.length) { buffer = []; return; }
      const range = rangeOf(significantItems);
      const steps = stepsOf(buffer);
      const prose = steps.map(step => step.text).join('\n');
      const original = range ? document.source.slice(range.start, range.end) : '';
      const text = prose || original.trim() || '继续';
      const node = make(knot, path, prose ? 'dialogue' : 'logic', text, range);
      const changes = buffer.flatMap(ast => {
        const range = /^\s*~/.test(line(ast)?.text || '') ? rangeOf([ast]) : undefined;
        const change = range && stateChange(ast, range, expressionSource);
        if (!change) return [];
        const index = steps.findIndex(step => step.range && change.range.start < step.range.end);
        return [{ ...change, beforeStep: index < 0 ? steps.length : index }];
      });
      if (changes.length) node.stateChanges = changes;
      // Inline branches share a source line with other boxes. Only the full
      // source editor may replace that line; a fragment must not erase siblings.
      node.editable = node.editable && !!prose && !inline && !(/[{}]|^[ \t]*[*+]|->/m.test(original));
      if (prose) node.sequence = steps.map(step => ({ ...step, editable: node.editable && !!step.range }));
      link(exits, node.id); exits = next(node); buffer = [];
    };
    for (let index = 0; index < items.length; index++) {
      const ast = items[index];
      if (ast.typeName === 'Tag') { insideTag = ast.isStart === true; continue; }
      if (insideTag) continue;
      if (!significant(ast)) { if (buffer.length) buffer.push(ast); continue; }
      const raw = line(ast)?.text.trim() || '';
      // A generated external boundary maps to its command's original line.
      if (raw.startsWith('>>>') && ast.typeName !== 'Text') continue;
      if (ast.typeName === 'Weave') {
        flush();
        exits = sequence(ast.content || [], exits, knot, path, inline);
      } else if (ast.typeName === 'Choice') {
        flush();
        let end = index + 1;
        while (end < items.length && items[end].typeName !== 'Gather') end++;
        const section = items.slice(index, end);
        const starts = section.flatMap((item, i) => item.typeName === 'Choice' ? [i] : []);
        const owner = exits.length === 1 && !byId(exits[0].block).ports.length && ['dialogue', 'logic'].includes(byId(exits[0].block).kind)
          ? byId(exits[0].block) : make(knot, path, 'dialogue', '选择下一步');
        if (exits[0]?.block !== owner.id || exits.length !== 1) link(exits, owner.id);
        // Choices are optional exits of a dialogue, not a separate box type.
        owner.kind = 'dialogue';
        const outputs: Exit[] = [];
        const repeated = new Map<string, number>();
        for (let branchIndex = 0; branchIndex < starts.length; branchIndex++) {
          const choice = section[starts[branchIndex]];
          const body = section.slice(starts[branchIndex] + 1, starts[branchIndex + 1] ?? section.length);
          const label = (textOf([choice.startContent!, choice.choiceOnlyContent!].filter(Boolean)).trim() || line(choice)?.text.trim() || '继续');
          const token = fingerprint(label), occurrence = repeated.get(token) || 0;
          repeated.set(token, occurrence + 1);
          const branchPath = path + '/choice-' + token + '-' + occurrence;
          const range = rangeOf([choice, ...body])!;
          // A weave's inherited metadata can extend into the next option. A
          // branch owns exactly its header and body, never the next header.
          const nextChoice = section[starts[branchIndex + 1]];
          if (nextChoice) range.end = Math.min(range.end, line(nextChoice).start);
          const branch = { group: owner.id + '/choices', range, label };
          const condition = choice.condition ? expressionSource(choice.condition) || choice.condition.toString() : undefined;
          const out: Exit = { block: owner.id, port: 'choice-' + token + '-' + occurrence, label, condition, predicate: choice.condition ? expressionView(choice.condition, expressionSource) : undefined, conditionTarget: choice.condition ? conditionTarget(choice.condition, '选项出现条件 · ' + label) : undefined, branch, choice: choiceText(choice) };
          const tail = sequence([...(choice.innerContent?.content || []), ...body], [out], knot, branchPath, inline);
          outputs.push(...tail);
        }
        exits = outputs; index = end - 1;
      } else if (ast.typeName === 'Conditional') {
        flush();
        const predicate = ast.initialCondition ? expressionSource(ast.initialCondition) || ast.initialCondition.toString() : raw.match(/\{([^{}]*?):/)?.[1] || '按条件选择内容';
        const node = make(knot, path, 'condition', predicate, rangeOf([ast]), '条件分支');
        if (ast.initialCondition) node.predicate = expressionView(ast.initialCondition, expressionSource);
        if (ast.branches?.some(branch => branch.matchingEquality)) node.conditionMode = 'match';
        else if (!ast.initialCondition) node.conditionMode = 'multiple';
        if (ast.initialCondition) node.conditionTarget = conditionTarget(ast.initialCondition, node.conditionMode === 'match' ? '匹配条目' : '查验条件', node.conditionMode === 'match' ? 'value' : undefined);
        link(exits, node.id);
        const outputs: Exit[] = [];
        for (let branchIndex = 0; branchIndex < (ast.branches || []).length; branchIndex++) {
          const branch = ast.branches![branchIndex];
          const label = branch.isElse ? node.conditionMode === 'match' ? '都不匹配' : ast.branches!.length > 2 || node.conditionMode === 'multiple' ? '此前条件均不成立' : '条件不成立'
            : branch.matchingEquality && branch.ownExpression ? '等于 ' + formatExpression(expressionView(branch.ownExpression, expressionSource), node.predicate?.kind === 'variable' ? node.predicate.name : undefined)
            : branch.ownExpression ? formatCondition(expressionView(branch.ownExpression, expressionSource)) : branchIndex === 0 ? '条件成立' : '分支 ' + (branchIndex + 1);
          outputs.push(...sequence(branch.content || [], [{ block: node.id, port: 'when-' + branchIndex, label, conditionTarget: branch.ownExpression && !branch.isElse ? conditionTarget(branch.ownExpression, '分支 ' + (branchIndex + 1) + (branch.matchingEquality ? ' · 匹配结果' : ' · 查验条件'), branch.matchingEquality ? 'value' : undefined) : undefined }], knot, path + '/when-' + fingerprint(predicate) + '-' + branchIndex, inline || Boolean(branch.isInline)));
        }
        if (!(ast.branches || []).some(branch => branch.isElse)) outputs.push({ block: node.id, port: 'otherwise', label: node.conditionMode ? '均不成立，继续' : '条件不成立，继续' });
        exits = outputs;
      } else if (ast.typeName === 'Divert') {
        flush();
        const target = ast.target?.dotSeparatedComponents || '';
        if (ast.isTunnel || ast.isThread || ast.isFunctionCall) {
          const node = make(knot, path, 'call', target, rangeOf([ast]), ast.isThread ? '并行子段' : '调用子段');
          node.reference = target;
          link(exits, node.id); exits = [{ block: node.id, port: 'next', label: ast.isTunnel ? '返回后继续' : '继续' }];
        } else if (ast.isEnd || ast.isDone) {
          const node = make(knot, path, 'end', ast.isEnd ? '故事结束' : '这段对话结束', rangeOf([ast]), '结束');
          link(exits, node.id); exits = [];
        } else {
          if (!exits.length) exits = next(make(knot, path, 'logic', '继续到 ' + target));
          const jump = knot.jumps.find(j => j.range.line === lineNumber(ast) && j.target === target);
          pending.push({ exits: exits.map(exit => ({ ...exit, kind: 'jump', ...(jump ? { jump } : {}) })), target, knot: knot.name });
          exits = [];
        }
      } else if (ast.typeName === 'TunnelOnwards') {
        flush();
        const node = make(knot, path, 'end', '返回调用这段对话的位置', rangeOf([ast]), '对话结束 · 返回');
        link(exits, node.id); exits = [];
      } else if (ast.typeName === 'Gather') {
        flush();
        if (ast.name) {
          const node = make(knot, path, 'logic', '汇合', rangeOf([ast]), '汇合');
          node.address = knot.name + '.' + ast.name; node.editable = false;
          addresses.set(node.address, node.id); link(exits, node.id); exits = next(node);
        }
      } else if (raw.startsWith('>>>') && ast.typeName === 'Text') {
        flush();
        const node = make(knot, path, 'action', raw.slice(4), { start: line(ast).start, end: line(ast).end, line: lineNumber(ast) }, raw.startsWith('>>> emit') ? '发出事件' : '行动与等待');
        link(exits, node.id); exits = next(node);
        const emitted = raw.match(/^>>>\s+emit\s+event=(?:"([^"\n]+)"|([^\s]+))/);
        if (emitted) for (const listener of document.knots.filter(k => k.on === (emitted[1] || emitted[2]))) pending.push({ exits: [{ block: node.id, port: 'event-' + listener.id, label: '事件 ' + listener.on, kind: 'event' }], target: listener.name, knot: knot.name });
      } else if (ast.typeName === 'Tag' || ast.typeName === 'ExternalDeclaration') {
        continue;
      } else if (raw.startsWith('~') && !stateChange(ast, rangeOf([ast])!, expressionSource)) {
        // Keep unsupported automatic statements visible in their own source
        // box; a neighboring readable update must never conceal a call.
        flush(); buffer.push(ast); flush();
      } else {
        buffer.push(ast);
      }
    }
    flush(); return exits;
  }
  for (const knot of document.knots) {
    const ast = (parsed.content || []).find(o => o.name === knot.name);
    if (!ast) continue;
    sequence(ast.content || [], [], knot, 'body');
    if (!blocks.some(b => b.knotId === knot.id)) make(knot, 'body', 'logic', '等待事件');
  }
  for (const jump of pending) {
    const target = addresses.get(jump.target) || addresses.get(jump.knot + '.' + jump.target);
    if (target) link(jump.exits, target);
    else {
      const knot = document.knots.find(k => k.name === jump.knot)!;
      const node = make(knot, 'reference-' + fingerprint(jump.target), 'portal', jump.target, undefined, '跳转 · 在源码中查看');
      node.reference = jump.target; link(jump.exits, node.id);
    }
  }
  const front = document.source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const configured = front ? parseYaml(front[1])?.graph_scenes : undefined;
  const scenes: GraphScene[] = Array.isArray(configured) ? configured.filter(s => typeof s?.id === 'string' && typeof s.title === 'string' && Array.isArray(s.knots)).map(s => ({ id: s.id, title: s.title, knots: s.knots.filter((name: unknown) => typeof name === 'string') })) : [];
  if (!scenes.length) scenes.push(...document.knots.map(k => ({ id: k.id, title: k.title, knots: [k.name] })));
  return { blocks, links, scenes };
}

// This is a view of the same Ink structure. It never rewrites dialogue or
// invents a choice: only the last sequential line owns the real branch exits.
export function sequentialStructure(structure: StoryStructure, mode: SequentialDialogueMode): StoryStructure {
  if (mode === 'merged') return structure;
  const blocks: StoryBlock[] = [], links: StoryLink[] = [];
  const tails = new Map<string, string>();
  for (const block of structure.blocks) {
    if (!block.sequence || block.sequence.length < 2) { blocks.push(block); continue; }
    const ids = block.sequence.map((_, index) => index === 0 ? block.id : block.id + '::step-' + index);
    tails.set(block.id, ids.at(-1)!);
    block.sequence.forEach((step, index) => {
      const last = index === block.sequence!.length - 1;
      blocks.push({
        ...block, id: ids[index], title: block.title + ' · ' + (index + 1), text: step.text,
        kind: last ? block.kind : 'dialogue', range: step.range, editable: step.editable,
        address: index === 0 ? block.address : undefined,
        event: index === 0 ? block.event : undefined, when: index === 0 ? block.when : undefined,
        ports: last ? block.ports : [{ id: 'next', label: '继续' }],
        sequence: [step], sequencePart: { index, total: ids.length },
        stateChanges: block.stateChanges?.filter(change => change.beforeStep === index || (last && change.beforeStep >= ids.length)).map(change => ({ ...change, beforeStep: change.beforeStep >= ids.length ? 1 : 0 })),
      });
      if (!last) links.push({ id: ids[index] + '::continue::' + ids[index + 1], source: ids[index], target: ids[index + 1], port: 'next', kind: 'next', sequential: true });
    });
  }
  for (const edge of structure.links) {
    const source = tails.get(edge.source) || edge.source;
    links.push({ ...edge, source, id: source === edge.source ? edge.id : edge.id + '::split' });
  }
  return { ...structure, blocks, links };
}

export function sceneStructure(structure: StoryStructure, sceneId: string): StoryStructure {
  const scene = structure.scenes.find(s => s.id === sceneId);
  const included = structure.blocks.filter(b => !scene || scene.knots.includes(b.knot));
  const ids = new Set(included.map(b => b.id));
  const blocks = included.map(block => ({ ...block, ports: [...block.ports] }));
  const links: StoryLink[] = [];
  const ancestors = new Set<string>(), visited = new Set<string>(), feedback = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id); ancestors.add(id);
    for (const edge of structure.links.filter(e => e.source === id && ids.has(e.target))) {
      if (ancestors.has(edge.target)) feedback.add(edge.id);
      else visit(edge.target);
    }
    ancestors.delete(id);
  };
  included.forEach(b => visit(b.id));
  for (const edge of structure.links.filter(e => ids.has(e.source))) {
    if (ids.has(edge.target) && !feedback.has(edge.id)) { links.push(edge); continue; }
    const target = structure.blocks.find(b => b.id === edge.target)!;
    const id = 'portal::' + edge.id;
    blocks.push({ id, knot: target.knot, knotId: target.knotId, title: (feedback.has(edge.id) ? '返回 · ' : '继续 · ') + target.title, text: feedback.has(edge.id) ? '回到前面的调查位置' : '在对应段落继续', kind: 'portal', editable: false, reference: target.knot, range: target.range, ports: [] });
    links.push({ ...edge, target: id });
  }
  return { ...structure, blocks, links };
}
