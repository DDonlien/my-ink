/** Reveal only the container that is scrolling, including editors and portals. */
export function installTransientScrollbars() {
  const pending = new Map<Element, ReturnType<typeof setTimeout>>();
  const reveal = (event: Event) => {
    const target = event.target === document ? document.scrollingElement : event.target;
    if (!(target instanceof Element)) return;
    const previous = pending.get(target);
    if (previous !== undefined) clearTimeout(previous);
    target.setAttribute('data-scrollbar-visible', '');
    pending.set(target, setTimeout(() => {
      target.removeAttribute('data-scrollbar-visible');
      pending.delete(target);
    }, 650));
  };
  // Element scroll events do not bubble; capture also covers lazily opened panels.
  document.addEventListener('scroll', reveal, { capture: true, passive: true });
  return () => {
    document.removeEventListener('scroll', reveal, true);
    for (const [target, timer] of pending) {
      clearTimeout(timer);
      target.removeAttribute('data-scrollbar-visible');
    }
    pending.clear();
  };
}
