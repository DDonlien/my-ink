import manCatCase from '../examples/man-cat-case-01.md?raw';
import { parse as parseYaml } from 'yaml';
import { fingerprint } from './core/document';

export { manCatCase };

// Match the untouched previous template while ignoring retired canvas layout.
// Edited prose, Ink, or other metadata always remains the user's document.
export function templateKey(source: string): string {
  const normal = source.replace(/\r\n/g, '\n');
  const front = normal.match(/^---\n([\s\S]*?)\n---/);
  if (!front) return fingerprint(normal);
  try {
    const properties = parseYaml(front[1]);
    delete properties.layout;
    const ordered = Object.fromEntries(Object.keys(properties).sort().map(key => [key, properties[key]]));
    return fingerprint(JSON.stringify(ordered) + '\n' + normal.slice(front[0].length));
  } catch { return fingerprint(normal); }
}

export const samples = [
  { id: 'man-cat', title: '无人接听的房间', description: '二重证言 · man-cat 第一案', filename: '无人接听的房间.md', source: manCatCase },
];
