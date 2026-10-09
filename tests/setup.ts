import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const rectangle = () => ({ x: 0, y: 0, width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20, toJSON: () => ({}) });
  Range.prototype.getBoundingClientRect = rectangle;
  Range.prototype.getClientRects = () => [rectangle()] as unknown as DOMRectList;
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 16);
    window.cancelAnimationFrame = id => window.clearTimeout(id);
  }
}
