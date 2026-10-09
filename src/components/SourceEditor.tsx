import { useEffect, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { AlertCircle, Check, FileText, Hash } from '../design/icons';
import type { Diagnostic, StoryDocument } from '../core/types';

const inkLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^#\s*(on|when|once|id|title):/)) return 'meta';
    if (stream.match(/^={2,}.*$/)) return 'heading';
    if (stream.match('>>>') || stream.match('->')) return 'keyword';
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^(VAR|CONST|LIST|EXTERNAL|true|false|and|or|not|else|start|await|emit)\b/)) return 'keyword';
    if (stream.match(/^\d+(?:\.\d+)?[hmd]?\b/)) return 'number';
    stream.next();
    return null;
  },
});
const extensions = [
  markdown({ codeLanguages: info => info === 'ink' ? inkLanguage : null }),
  EditorView.lineWrapping,
  EditorView.theme({
    '&': { height: '100%', backgroundColor: 'var(--md-sys-color-surface-container-lowest)', color: 'var(--md-sys-color-on-surface)', fontSize: '14px' },
    '.cm-scroller': { fontFamily: 'var(--ink-font-code)', lineHeight: '1.85' },
    '.cm-content': { padding: '20px 12px 32px' },
    '.cm-line': { paddingLeft: '7px' },
    '.cm-gutters': { backgroundColor: 'var(--md-sys-color-surface-container-lowest)', borderRight: 'none', color: 'var(--md-sys-color-outline)', paddingLeft: '12px' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--ink-color-dialogue)' },
    '.cm-selectionBackground': { backgroundColor: 'var(--md-sys-color-primary-container) !important' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: 'var(--md-sys-color-primary)' },
  }),
];

function focusLine(view: EditorView, number: number) {
  const line = view.state.doc.line(Math.max(1, Math.min(number, view.state.doc.lines)));
  view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
  view.focus();
}

interface Props {
  source: string;
  filename: string;
  document: StoryDocument;
  diagnostics: Diagnostic[];
  onChange(source: string): void;
  jump?: { line: number; serial: number };
}
export function SourceEditor({ source, filename, document, diagnostics, onChange, jump }: Props) {
  const editor = useRef<ReactCodeMirrorRef>(null);
  useEffect(() => {
    if (!jump) return;
    const view = editor.current?.view;
    if (!view) return;
    focusLine(view, jump.line);
  }, [jump]);
  return <section className="panel source-panel" aria-label="Markdown 编辑器">
    <div className="file-heading"><FileText size={14} /><span>{filename}</span><span className="file-dot" title="自动保存于此浏览器" /></div>
    <CodeMirror ref={editor} value={source} onChange={onChange} extensions={extensions} height="100%" className="source-code" aria-label="Markdown 源码"
      onCreateEditor={view => { if (jump) focusLine(view, jump.line); }}
      basicSetup={{ foldGutter: true, highlightActiveLine: true, lineNumbers: true, autocompletion: false, tabSize: 4 }} />
    <div className="source-footer">
      <span>{diagnostics.some(d => d.severity === 'error') ? <><AlertCircle size={13} />编译未通过</> : <><Check size={13} />Ink 语法有效</>}</span>
      <span><Hash size={12} />{document.knots.length} 个脚本段落 <span className="separator">·</span> {source.split('\n').length} 行</span>
    </div>
  </section>;
}
