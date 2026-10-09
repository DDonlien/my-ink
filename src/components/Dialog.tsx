import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../design/icons';

interface Props { title: string; className?: string; onClose(): void; children: ReactNode }
export function Dialog({ title, className = '', onClose, children }: Props) {
  const id = useId(), panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const root = panel.current!;
    if (!root.contains(document.activeElement)) root.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"], [contenteditable="true"]')).filter(node => !node.hidden);
      if (!targets.length) { event.preventDefault(); root.focus(); return; }
      const first = targets[0], last = targets[targets.length - 1], active = document.activeElement;
      if (event.shiftKey && (active === first || active === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || active === root)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keys, true);
    return () => {
      document.removeEventListener('keydown', keys, true);
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);
  return createPortal(<div className="dialog-overlay" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className={'app-dialog ' + className}>
      <div className="dialog-heading"><h2 id={id}>{title}</h2><button className="icon-button" aria-label={'关闭' + title} onClick={onClose}><X size={18} /></button></div>
      <div className="dialog-body">{children}</div>
    </div>
  </div>, document.body);
}
