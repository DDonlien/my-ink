import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock3, Download, FileCode2, FilePlus2, FileText, FolderOpen, Import, MoreHorizontal, Network, Play, RotateCcw, Save, X } from './design/icons';
import { compileDocument, DocumentError, parseStoryDocument } from './core/document';
import { formatTime } from './core/actions';
import { StoryRunner } from './core/runtime';
import type { CompiledDocument, Diagnostic } from './core/types';
import { samples, templateKey } from './samples';
import { version as appVersion } from '../package.json';
const SourceEditor = lazy(() => import('./components/SourceEditor').then(module => ({ default: module.SourceEditor })));
import { Preview } from './components/Preview';
const StoryGraph = lazy(() => import('./components/StoryGraph').then(module => ({ default: module.StoryGraph })));
import { Inspector } from './components/Inspector';
import { Dialog } from './components/Dialog';
import { Tutorial, type TutorialTopic } from './components/Tutorial';
import { TutorialMenu } from './components/TutorialMenu';
import { WorkspaceTabs, type WorkspaceView } from './components/WorkspaceTabs';
import type { SequentialDialogueMode } from './graph/model';
import { installTransientScrollbars } from './scrollbars';
import './styles.css';

const WORKSPACE_KEY = 'inkloom.workspace.v1';
const SAVE_KEY = 'inkloom.progress.v1';
const DRAFT_INDEX_KEY = 'inkloom.draft-index.v1';
const PREFERENCES_KEY = 'inkloom.preferences.v1';
const displayVersion = appVersion.replace(/\.0$/, '');
interface WorkspacePreferences { autoExpandDialogue: boolean; dialogueMode: SequentialDialogueMode }
interface DraftEntry { filename: string; saved: number }
function stored(key: string) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function initialPreferences(): WorkspacePreferences {
  const saved = stored(PREFERENCES_KEY);
  return { autoExpandDialogue: saved?.autoExpandDialogue === true, dialogueMode: saved?.dialogueMode === 'split' ? 'split' : 'merged' };
}
function initialWorkspace() {
  const saved = stored(WORKSPACE_KEY);
  const next = { source: samples[0].source, filename: samples[0].filename };
  if (saved?.schema !== 1 || typeof saved.source !== 'string' || typeof saved.filename !== 'string') return next;
  if (saved.filename === samples[0].filename && templateKey(saved.source) === '7df62e34') {
    try {
      rememberDraft('无人接听的房间·更新前.md', saved.source);
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ schema: 1, ...next }));
      return next;
    } catch { /* Preserve the original if its backup cannot be stored. */ }
  }
  if (saved.filename === '商路的另一端.md' && /^id:\s*["']?merchant_relocation["']?\s*$/m.test(saved.source)) {
    try {
      // Keep any edits to the retired template before selecting the requested case.
      rememberDraft(saved.filename, saved.source);
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ schema: 1, ...next }));
      return next;
    } catch { /* Keep the current document if its backup cannot be stored. */ }
  }
  return { source: saved.source, filename: saved.filename };
}
function draftIndex(): DraftEntry[] {
  const index = stored(DRAFT_INDEX_KEY);
  return Array.isArray(index) ? index.filter(item => typeof item?.filename === 'string' && typeof item.saved === 'number') : [];
}
function rememberDraft(filename: string, source: string) {
  localStorage.setItem('inkloom.draft.' + filename, source);
  const index = [{ filename, saved: Date.now() }, ...draftIndex().filter(item => item.filename !== filename)].slice(0, 20);
  localStorage.setItem(DRAFT_INDEX_KEY, JSON.stringify(index));
  return index;
}
function download(filename: string, content: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  useEffect(installTransientScrollbars, []);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [initial] = useState(initialWorkspace);
  const [source, setSource] = useState(initial.source);
  const [filename, setFilename] = useState(initial.filename);
  const [initialCompiled] = useState(() => { try { return compileDocument(initial.source); } catch { return null; } });
  const [compiled, setCompiled] = useState<CompiledDocument | null>(initialCompiled);
  const [runner, setRunner] = useState<StoryRunner | null>(() => initialCompiled ? new StoryRunner(initialCompiled, undefined, true, preferences) : null);
  const runnerRef = useRef(runner);
  runnerRef.current = runner;
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(initialCompiled?.diagnostics || []);
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<WorkspaceView>('preview');
  const [graphOpened, setGraphOpened] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [tutorial, setTutorial] = useState<TutorialTopic>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [jump, setJump] = useState<{ line: number; serial: number }>();
  const [toast, setToast] = useState<{ text: string; error: boolean }>();
  const [hasSave, setHasSave] = useState(Boolean(stored(SAVE_KEY)));
  const [recentDrafts, setRecentDrafts] = useState<DraftEntry[]>(draftIndex);
  const fileInput = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseStoryDocument(source), [source]);
  const stale = checking || !compiled || compiled.source !== source || !runner || runner.halted || StoryRunner.executionKey(compiled) !== StoryRunner.executionKey(runner.document);
  const errors = diagnostics.filter(d => d.severity === 'error');
  const notify = useCallback((text: string, error = false) => setToast({ text, error }), []);
  useEffect(() => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); }
    catch { notify('显示偏好未能保存，当前设置仍可继续使用。', true); }
  }, [preferences, notify]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(undefined), toast.error ? 7000 : 3200); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    setChecking(true);
    const timer = setTimeout(() => {
      try {
        const document = compileDocument(source);
        setCompiled(document); setDiagnostics(document.diagnostics);
        const active = runnerRef.current;
        if (active && StoryRunner.executionKey(active.document) === StoryRunner.executionKey(document)) {
          active.rebaseDocument(document); setRevision(r => r + 1);
        }
      } catch (error) {
        setCompiled(null);
        setDiagnostics(error instanceof DocumentError ? error.diagnostics : [{ severity: 'error', message: String(error) }]);
      }
      setChecking(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [source]);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ schema: 1, source, filename }));
        setRecentDrafts(rememberDraft(filename, source));
      } catch { notify('浏览器存储空间不足，请导出 Markdown 保存文档。', true); }
    }, 450);
    return () => clearTimeout(timer);
  }, [source, filename, notify]);
  const jumpTo = useCallback((line: number) => {
    setTutorial(undefined); setSourceOpen(true);
    setJump(previous => ({ line, serial: (previous?.serial || 0) + 1 }));
  }, []);
  const changeView = (next: WorkspaceView) => {
    if (next === 'graph') setGraphOpened(true);
    setView(next); setLibraryOpen(false); setExportOpen(false);
  };
  const operate = (action: (runner: StoryRunner) => void) => {
    if (!runner || stale) { notify('剧情内容已修改，请先点击“从头预演”。'); return; }
    try { action(runner); setRevision(r => r + 1); }
    catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  };
  const restart = () => {
    try {
      const document = compileDocument(source);
      setCompiled(document); setDiagnostics(document.diagnostics); setRunner(new StoryRunner(document, undefined, true, preferences)); setRevision(r => r + 1);
      setChecking(false); notify('已从头开始预演。');
    } catch (error) {
      setDiagnostics(error instanceof DocumentError ? error.diagnostics : [{ severity: 'error', message: String(error) }]);
      notify('请先修正文档中的编译错误。', true);
    }
  };
  const openDocument = (next: { filename: string; source: string }) => {
    try { setRecentDrafts(rememberDraft(filename, source)); } catch { notify('请先导出当前文档，浏览器存储空间不足。', true); return; }
    setSource(next.source); setFilename(next.filename); setLibraryOpen(false); setSourceOpen(false);
    try {
      const document = compileDocument(next.source);
      setCompiled(document); setDiagnostics(document.diagnostics); setRunner(new StoryRunner(document, undefined, true, preferences)); setRevision(r => r + 1);
    } catch (error) {
      setRunner(null); setCompiled(null); setDiagnostics(error instanceof DocumentError ? error.diagnostics : [{ severity: 'error', message: String(error) }]);
    }
  };
  const exportMarkdown = () => { download(filename, source); notify('Markdown 已导出。'); };
  const save = () => operate(active => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ schema: 1, source, filename, snapshot: active.snapshot() }));
    setHasSave(true); notify('进度已保存，包含世界状态和未完成的行为。');
  });
  const restore = () => {
    try {
      const saved = stored(SAVE_KEY);
      if (saved?.schema !== 1 || typeof saved.source !== 'string' || typeof saved.filename !== 'string') throw new Error('没有可恢复的有效进度。');
      const document = compileDocument(saved.source);
      const active = StoryRunner.restore(document, saved.snapshot);
      if (saved.snapshot?.autoExpandDialogue === undefined) active.setAutoExpandDialogue(preferences.autoExpandDialogue);
      setPreferences(value => ({ ...value, autoExpandDialogue: active.autoExpandDialogue }));
      if (source !== saved.source) {
        const backupName = filename.replace(/\.md$/i, '') + ' · 恢复前草稿 ' + Date.now() + '.md';
        setRecentDrafts(rememberDraft(backupName, source));
      }
      setSource(saved.source); setFilename(saved.filename); setCompiled(document); setDiagnostics(document.diagnostics);
      setRunner(active); setRevision(r => r + 1); notify('进度已恢复。世界从保存的时间继续。');
    } catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  };
  const exportBundle = () => {
    try {
      const document = compileDocument(source);
      const bundle = { schema: 1, protocol: 'inkloom/1', documentId: document.id, ink: JSON.parse(document.json),
        entries: document.knots.filter(k => k.on).map(k => ({ id: k.id, path: k.name, on: k.on, whenFunction: k.when ? '__loom_when_' + k.name : null, once: k.once })),
        commands: document.commands, lineMap: document.lineMap };
      download(filename.replace(/\.md$/i, '') + '.story.json', JSON.stringify(bundle, null, 2), 'application/json');
      setExportOpen(false); notify('运行包已导出。接入引擎时需要实现墨线行为协议。');
    } catch (error) { notify(String(error), true); }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (tutorial) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === 'Enter') { event.preventDefault(); restart(); }
      if (event.key.toLowerCase() === 's') { event.preventDefault(); exportMarkdown(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [source, filename, tutorial, preferences]);
  return <><div className="app-shell" inert={sourceOpen || !!tutorial}>
    <header className="app-header">
      <div className="brand"><div className="brand-mark"><Network size={20} strokeWidth={1.7} /></div><span>墨线<small>INK LOOM</small></span><span className="brand-divider" /><span className="workspace-tag">叙事工作台</span></div>
      <WorkspaceTabs view={view} onChange={changeView} />
      <div className="header-right"><TutorialMenu onOpen={topic => { setSourceOpen(false); setTutorial(topic); setLibraryOpen(false); setExportOpen(false); }} /><span className="local-label"><span className="live-dot" />本地工作区</span><span className="version" aria-label={'版本 ' + appVersion} title={'版本 ' + appVersion}><span className="version-prefix">v</span><span className="version-number">{displayVersion}</span></span></div>
    </header>
    <div className="app-body">
      <main className="main-workspace">
        <div className="workspace-toolbar">
          <div className="project-identity"><div className="project-icon"><FileCode2 size={19} /></div>
            <div className="breadcrumbs">工作区 <ChevronRight size={11} /> <button aria-label="案件模板与文档" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>{parsed.title}<ChevronDown size={12} /></button></div>
          </div>
          <div className="toolbar-actions">
            <button className="button" onClick={() => fileInput.current?.click()}><Import size={14} />打开 Markdown</button>
            <div className="export-group"><button className="button" onClick={exportMarkdown}><Download size={14} />导出 Markdown</button><button className="button more-button" title="更多导出选项" onClick={() => setExportOpen(!exportOpen)}><MoreHorizontal size={16} /></button>
              {exportOpen && <div className="export-menu"><button onClick={exportBundle}>导出编译运行包</button><button onClick={() => { if (runner) download('预演记录.json', JSON.stringify(runner.logs, null, 2), 'application/json'); setExportOpen(false); }}>导出事件记录</button></div>}
            </div>
            <button className="button primary" onClick={restart}><Play size={13} fill="currentColor" />从头预演</button>
          </div>
          <input ref={fileInput} type="file" accept=".md,.markdown,text/markdown,text/plain" aria-label="导入 Markdown 文件" className="hidden"
            onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { if (file.size > 1024 * 1024) throw new Error('请打开小于 1 MB 的 Markdown 文档。'); openDocument({ filename: file.name, source: await file.text() }); notify('已打开 ' + file.name); } catch (error) { notify(String(error), true); } event.target.value = ''; }} />
        </div>
        <div className="workspace-content">
          {stale && !checking && !errors.length && <div className="stale-banner"><RotateCcw size={13} />{runner?.halted ? '检测到可能的剧情循环，请修正后从头预演。' : '剧情已修改，点击“从头预演”应用新的内容。'}</div>}
          <section id="page-preview" role="tabpanel" aria-labelledby="tab-preview" className="workspace-page" hidden={view !== 'preview'}>
            <Preview runner={runner} disabled={stale} revision={revision} onChoose={(id, index) => operate(active => active.choose(id, index))}
              onContinue={id => operate(active => active.continueDialogue(id))} onAutoExpand={enabled => operate(active => {
                active.setAutoExpandDialogue(enabled); setPreferences(value => ({ ...value, autoExpandDialogue: enabled }));
              })} onJump={jumpTo} />
          </section>
          <section id="page-graph" role="tabpanel" aria-labelledby="tab-graph" className="workspace-page" hidden={view !== 'graph'}>
            {graphOpened && <Suspense fallback={<div className="stage-empty">正在展开剧情图…</div>}><StoryGraph document={parsed} activeKnots={runner?.instances.filter(i => ['running', 'continue', 'waiting', 'choices'].includes(i.status)).map(i => i.knot) || []}
              dialogueMode={preferences.dialogueMode} onDialogueModeChange={dialogueMode => setPreferences(value => ({ ...value, dialogueMode }))}
              onChange={setSource} onJump={jumpTo} onError={text => notify(text, true)} /></Suspense>}
          </section>
          {(['world', 'log'] as const).map(tab => <section key={tab} id={'page-' + tab} role="tabpanel" aria-labelledby={'tab-' + tab} className="workspace-page" hidden={view !== tab}>
            {view === tab && <Inspector runner={runner} disabled={stale} tab={tab}
              onWorld={(name, value) => operate(active => active.setWorld(name, value))} onEvent={event => operate(active => active.dispatch(event))}
              onComplete={(id, status) => operate(active => active.completeAction(id, status))} onJump={jumpTo} />}
          </section>)}
          {view !== 'graph' && <div className="runtime-toolbar" aria-label="演绎控制">
            <div className="clock-display"><Clock3 size={15} /><div><span>世界时间</span><strong data-testid="world-time">{formatTime(runner?.time || 8)}</strong></div></div>
              <div className="advance-controls"><span>推进</span>{[{ hours: 5 / 60, label: '5m', name: '5 分钟' }, { hours: 1, label: '1h', name: '1 小时' }, { hours: 3, label: '3h', name: '3 小时' }].map(step => <button key={step.label} disabled={stale} aria-label={'推进 ' + step.name} onClick={() => operate(active => active.advance(step.hours))}>+{step.label}</button>)}</div>
            <div className="progress-controls"><span>{hasSave ? '已有本地存档' : '预演进度'}</span><button className="button small" disabled={stale || !runner} onClick={save}><Save size={13} />保存进度</button><button className="button small" disabled={!hasSave} onClick={restore}><RotateCcw size={13} />恢复</button></div>
          </div>}
        </div>
        {!!errors.length && <div className="diagnostics" role="alert">{errors.map((error, index) => <button key={index} onClick={() => jumpTo(error.line || 1)}><X size={13} />{error.line && <strong>第 {error.line} 行</strong>}<span>{error.message}</span></button>)}</div>}
        <footer className="workspace-status"><span><span className={'runtime-status ' + (stale ? 'pending' : '')} data-testid="runtime-status"><span className="live-dot" />{checking ? '正在检查' : errors.length ? '等待修正' : stale ? '内容已更新' : runner?.continuations.length ? '等待继续' : runner?.actions.some(a => a.status === 'running') ? '等待行为' : '预演就绪'}</span><span className="status-separator">/</span>文档自动保存于此浏览器<span className="status-separator">/</span>{parsed.knots.length} 个脚本段落</span><span>⌘ / Ctrl + Enter 预演<span className="status-separator">·</span>⌘ / Ctrl + S 导出</span></footer>
      </main>
    </div>
    {libraryOpen && <><button className="menu-backdrop" aria-label="关闭文档菜单" onClick={() => setLibraryOpen(false)} /><div className="library-menu">
      <div className="library-heading"><span>案件模板与文档</span><button className="icon-button" title="关闭文档菜单" onClick={() => setLibraryOpen(false)}><X size={14} /></button></div>
      {samples.map(sample => <button className="sample-item" key={sample.id} onClick={() => {
        const draft = localStorage.getItem('inkloom.draft.' + sample.filename);
        openDocument({ filename: sample.filename, source: draft || sample.source });
      }}><span className={'sample-icon ' + sample.id}><FileText size={18} /></span><span><strong>{sample.title}</strong><small>{sample.description}</small></span>{filename === sample.filename && <Check size={14} />}</button>)}
      <button className="template-refresh" onClick={() => {
        const sample = samples[0];
        try {
          const previous = filename === sample.filename ? source : localStorage.getItem('inkloom.draft.' + sample.filename);
          if (previous && previous !== sample.source) rememberDraft('无人接听的房间·模板切换前-' + Date.now() + '.md', previous);
        } catch { notify('备份未能保存，请先导出案件文档。', true); return; }
        openDocument({ filename: sample.filename, source: sample.source });
      }}>载入新版模板<small>自动保留已有的案件改稿</small></button>
      {recentDrafts.some(d => !samples.some(s => s.filename === d.filename)) && <div className="recent-drafts"><small>最近文档与恢复前草稿</small>{recentDrafts.filter(d => !samples.some(s => s.filename === d.filename)).slice(0, 6).map(draft => <button key={draft.filename} onClick={() => {
        const content = localStorage.getItem('inkloom.draft.' + draft.filename);
        if (content !== null) openDocument({ filename: draft.filename, source: content });
      }}><FileText size={12} /><span>{draft.filename}</span></button>)}</div>}
      <div className="library-footer"><button onClick={() => openDocument({ filename: '未命名故事-' + Date.now() + '.md', source: ['---', 'id: new_story', 'title: 新的故事', 'schema: 1', '---', '', '# 新的故事', '', '在这里记录你的设计想法。', '', '~~~ink', '=== opening ===', '# id: opening', '# title: 开场', '# on: start', '', '故事从这里开始。', '* [继续]', '    写下你的第一句台词。', '    -> DONE', '~~~', ''].join('\n') })}><FilePlus2 size={14} />新建文档</button><button onClick={() => { setLibraryOpen(false); fileInput.current?.click(); }}><FolderOpen size={14} />打开文件</button></div>
    </div></>}
    {toast && <div className={'toast ' + (toast.error ? 'error' : '')} role="status">{toast.error ? <X size={16} /> : <Check size={16} />}<span>{toast.text}</span><button className="icon-button" aria-label="关闭提示" onClick={() => setToast(undefined)}><X size={13} /></button></div>}
  </div>
    {sourceOpen && <Dialog title={'原文 · ' + filename} className="source-dialog" onClose={() => setSourceOpen(false)}>
      <Suspense fallback={<div className="stage-empty">正在打开原文…</div>}><SourceEditor source={source} filename={filename} document={parsed} diagnostics={diagnostics} onChange={setSource} jump={jump} /></Suspense>
    </Dialog>}
    {tutorial && <Dialog title={tutorial === 'syntax' ? '语法速查' : '快速开始'} className="tutorial-dialog" onClose={() => setTutorial(undefined)}><Tutorial topic={tutorial} /></Dialog>}
  </>;
}
