import { cp, mkdir, rm, readFile } from 'node:fs/promises';

// All browser URLs are relative, including module imports and the data URL.
// The same artifact works at a domain root or under a GitHub Pages repo path.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await cp(new URL('../src/', import.meta.url), new URL('../dist/', import.meta.url), { recursive: true });
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
if (!html.includes('id="plot"') || !html.includes('type="module"')) throw new Error('Incomplete app entry point');
console.log('Static app built in dist/; mathematical fonts and renderer are served locally.');
