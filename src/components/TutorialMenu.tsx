import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown } from '../design/icons';
import type { TutorialTopic } from './Tutorial';

export function TutorialMenu({ onOpen }: { onOpen(topic: TutorialTopic): void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const dismiss = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open]);
  const choose = (topic: TutorialTopic) => { setOpen(false); trigger.current?.focus(); onOpen(topic); };
  return <div className="system-tutorial">
    <button ref={trigger} className="system-tutorial-button" aria-label="教程菜单" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><BookOpen size={14} />教程<ChevronDown size={11} /></button>
    {open && <><button className="menu-backdrop" aria-label="关闭教程菜单" onClick={dismiss} /><div ref={menu} className="system-tutorial-menu" role="menu" aria-label="教程" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); const items = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      }
    }}><button role="menuitem" onClick={() => choose('start')}>快速开始</button><button role="menuitem" onClick={() => choose('syntax')}>语法速查</button></div></>}
  </div>;
}
