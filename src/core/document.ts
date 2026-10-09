import { fromMarkdown } from 'mdast-util-from-markdown';
import { parseDocument as parseYaml, isMap } from 'yaml';
import { Compiler, CompilerOptions, Story } from 'inkjs/full';
import type { CompiledDocument, Diagnostic, Knot, StoryDocument } from './types';

export class DocumentError extends Error {
  constructor(public diagnostics: Diagnostic[]) {
    super(diagnostics.map(d => (d.line ? '第 ' + d.line + ' 行：' : '') + d.message).join('\n'));
  }
}

export function fingerprint(source: string): string {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function linesOf(text: string, start: number, startLine: number) {
  let offset = start;
  return text.split('\n').map((raw, index) => {
    const record = { text: raw.replace(/\r$/, ''), start: offset, end: offset + raw.length, line: startLine + index };
    offset += raw.length + 1;
    return record;
  });
}

export function parseStoryDocument(source: string): StoryDocument {
  const diagnostics: Diagnostic[] = [];
  const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  let meta: Record<string, unknown> = {};
  if (front) {
    const yaml = parseYaml(front[1]);
    if (yaml.errors.length) diagnostics.push({ severity: 'error', line: 2, message: yaml.errors[0].message });
    else if (isMap(yaml.contents)) meta = yaml.toJS() as Record<string, unknown>;
    else diagnostics.push({ severity: 'error', line: 2, message: '文档属性需要是 YAML 键值结构。' });
    if (meta.schema !== undefined && meta.schema !== 1) diagnostics.push({ severity: 'error', line: 2, message: '当前支持 schema: 1。' });
  }
  const knots: Knot[] = [];
  const commands: StoryDocument['commands'] = [];
  const variables: string[] = [];
  const generated: string[] = ['EXTERNAL __loom_barrier()'];
  const lineMap = [1];
  const tree = fromMarkdown(source);
  const blocks = tree.children.filter(node => node.type === 'code' && node.lang === 'ink');
  if (!blocks.length) diagnostics.push({ severity: 'error', message: '请在 Markdown 中添加一个顶层 ink 代码块。' });
  let current: Knot | undefined;
  const addLine = (text: string, line: number) => { generated.push(text); lineMap.push(line); };
  for (const block of blocks) {
    if (block.type !== 'code' || !block.position) continue;
    const start = block.position.start.offset!;
    const end = block.position.end.offset!;
    const raw = source.slice(start, end);
    const openingEnd = raw.indexOf('\n');
    const closingStart = raw.lastIndexOf('\n');
    if (openingEnd < 0 || closingStart === openingEnd || !/^\s*(?:\x60{3,}|~{3,})\s*$/.test(raw.slice(closingStart + 1))) {
      diagnostics.push({ severity: 'error', line: block.position.start.line, message: '请完整关闭 ink 代码块。' });
      continue;
    }
    const contentStart = start + openingEnd + 1;
    const contentEnd = start + closingStart + 1;
    const lines = linesOf(source.slice(contentStart, contentEnd), contentStart, block.position.start.line + 1);
    current = undefined;
    for (const line of lines) {
      if (line.start >= contentEnd) continue;
      const header = line.text.match(/^\s*={2,}\s*([A-Za-z_][\w]*)\s*(?:={2,})?\s*$/);
      if (header) {
        if (current) { current.range.end = line.start; current.body.end = line.start; }
        current = {
          id: header[1], name: header[1], title: header[1],
          range: { start: line.start, end: contentEnd, line: line.line },
          body: { start: line.end + 1, end: contentEnd, line: line.line + 1 },
          text: '', jumps: [],
        };
        knots.push(current);
      }
      const metadata = line.text.match(/^\s*#\s*(id|title|on|when|once)\s*:\s*(.*?)\s*$/);
      if (metadata && current) {
        const [, key, value] = metadata;
        if (key === 'id') current.id = value;
        if (key === 'title') current.title = value;
        if (key === 'on') current.on = value;
        if (key === 'when') { current.when = value; current.whenLine = line.line; }
        if (key === 'once') {
          if (value === 'save' || value === 'session') current.once = value;
          else diagnostics.push({ severity: 'error', line: line.line, message: 'once 只支持 save 或 session。' });
        }
        addLine('', line.line);
        continue;
      }
      const declaration = line.text.match(/^\s*VAR\s+([A-Za-z_]\w*)\s*=/);
      if (declaration) variables.push(declaration[1]);
      if (/^\s*INCLUDE\b/.test(line.text)) diagnostics.push({ severity: 'error', line: line.line, message: '此版本以单份 Markdown 为源，请把所需 Ink 放入同一文档的代码块。' });
      const command = line.text.match(/^(\s*)>>>\s*(.+)$/);
      if (command) {
        const id = 'c' + commands.length;
        commands.push({ id, text: command[2], line: line.line, knot: current?.name || '' });
        // The non-lookahead-safe external after each command is a real Ink
        // evaluation boundary. Merely stopping the host after a text line is
        // insufficient: Ink can evaluate later assignments while looking ahead.
        addLine(command[1] + '>>> __loom_' + id + ' ' + command[2], line.line);
        addLine(command[1] + '~ __loom_barrier()', line.line);
      } else addLine(line.text, line.line);
      if (current) {
        for (const jump of line.text.matchAll(/->\s*([A-Za-z_][\w.]*)/g)) {
          const targetStart = line.start + jump.index! + jump[0].indexOf(jump[1]);
          current.jumps.push({ target: jump[1], range: { start: targetStart, end: targetStart + jump[1].length, line: line.line } });
        }
      }
    }
    if (current) { current.range.end = contentEnd; current.body.end = contentEnd; }
    addLine('', block.position.end.line);
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const knot of knots) {
    knot.text = source.slice(knot.body.start, knot.body.end);
    if (!/^[A-Za-z_][\w.-]*$/.test(knot.id)) diagnostics.push({ severity: 'error', line: knot.range.line, message: '节点 id 请使用字母、数字、下划线、点或短横线。' });
    if (ids.has(knot.id) || names.has(knot.name)) diagnostics.push({ severity: 'error', line: knot.range.line, message: '剧情节点的 id 和名称需要唯一。' });
    ids.add(knot.id); names.add(knot.name);
    if (knot.when) {
      addLine('=== function __loom_when_' + knot.name + '() ===', knot.range.line);
      addLine('~ return ' + knot.when, knot.whenLine || knot.range.line);
    }
  }
  const layout: StoryDocument['layout'] = {};
  if (meta.layout && typeof meta.layout === 'object') {
    for (const [id, pos] of Object.entries(meta.layout)) {
      if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) layout[id] = { x: Number(pos.x), y: Number(pos.y) };
    }
  }
  const heading = source.match(/^#\s+(.+)$/m)?.[1];
  return {
    source, fingerprint: fingerprint(source), title: String(meta.title || heading || '未命名故事'),
    id: String(meta.id || 'untitled'), knots, commands, variables: [...new Set(variables)],
    layout, generatedInk: generated.join('\n'), lineMap, diagnostics,
  };
}

export function compileDocument(source: string): CompiledDocument {
  const document = parseStoryDocument(source);
  if (document.diagnostics.some(d => d.severity === 'error')) throw new DocumentError(document.diagnostics);
  const diagnostics = [...document.diagnostics];
  const compiler = new Compiler(document.generatedInk, new CompilerOptions('story.ink', [], false, (message, type) => {
    const inkLine = Number(message.match(/line\s+(\d+)/i)?.[1]);
    diagnostics.push({
      message: message.replace(/^(ERROR|WARNING):\s*/i, '').replace(/'story\.ink'\s*line\s+\d+:\s*/, ''),
      line: inkLine ? document.lineMap[inkLine - 1] : undefined,
      severity: type === 2 ? 'error' : 'warning',
    });
  }, {
    ResolveInkFilename: filename => filename,
    LoadInkFileContents: () => { throw new Error('此版本不加载外部 INCLUDE 文件。'); },
  }));
  let story: Story;
  try { story = compiler.Compile(); }
  catch (error) {
    if (!diagnostics.some(d => d.severity === 'error')) diagnostics.push({ severity: 'error', message: String(error) });
    throw new DocumentError(diagnostics);
  }
  if (diagnostics.some(d => d.severity === 'error') || !story) throw new DocumentError(diagnostics);
  const json = story.ToJson() as string;
  return { ...document, diagnostics, json, createStory: () => new Story(json) };
}

export function replaceKnotBody(source: string, knotId: string, text: string): string {
  const knot = parseStoryDocument(source).knots.find(k => k.id === knotId);
  if (!knot) throw new Error('找不到要修改的剧情节点。');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const body = text.replace(/\r?\n/g, eol).replace(/(?:\r?\n)*$/, '') + eol + eol;
  return source.slice(0, knot.body.start) + body + source.slice(knot.body.end);
}

export function replaceJump(source: string, knotId: string, jumpIndex: number, target: string): string {
  const document = parseStoryDocument(source);
  const knot = document.knots.find(k => k.id === knotId);
  const jump = knot?.jumps[jumpIndex];
  if (!jump || !document.knots.some(k => k.name === target)) throw new Error('找不到跳转或目标节点。');
  return source.slice(0, jump.range.start) + target + source.slice(jump.range.end);
}

export function writeLayout(source: string, id: string, position: { x: number; y: number }): string {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('布局坐标无效。');
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const front = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const pos = { x: Math.round(position.x), y: Math.round(position.y) };
  if (!front) return '---' + eol + 'schema: 1' + eol + 'layout:' + eol + '  ' + id + ': { x: ' + pos.x + ', y: ' + pos.y + ' }' + eol + '---' + eol + source;
  const yaml = parseYaml(front[1]);
  if (yaml.errors.length || !isMap(yaml.contents)) throw new Error('请先修正文档属性。');
  yaml.setIn(['layout', id], pos);
  return '---' + eol + yaml.toString().replace(/\n/g, eol) + '---' + eol + source.slice(front[0].length);
}
