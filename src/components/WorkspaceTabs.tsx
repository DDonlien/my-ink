import { GitBranch, ListFilter, SlidersHorizontal, Sparkles } from '../design/icons';

export type WorkspaceView = 'preview' | 'graph' | 'world' | 'log';
const tabs = [
  { id: 'preview', label: '演绎', icon: Sparkles },
  { id: 'graph', label: '分支', icon: GitBranch },
  { id: 'world', label: '世界状态', icon: SlidersHorizontal },
  { id: 'log', label: '事件记录', icon: ListFilter },
] as const;

export function WorkspaceTabs({ view, onChange }: { view: WorkspaceView; onChange(view: WorkspaceView): void }) {
  return <nav className="workspace-tabs" role="tablist" aria-label="工作区功能" onKeyDown={event => {
    const index = tabs.findIndex(tab => tab.id === view);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onChange(tabs[next].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }}>
    {tabs.map(({ id, label, icon: Icon }) => <button key={id} id={'tab-' + id} role="tab" aria-selected={view === id}
      aria-controls={'page-' + id} tabIndex={view === id ? 0 : -1} onClick={() => onChange(id)}><Icon size={15} />{label}</button>)}
  </nav>;
}
