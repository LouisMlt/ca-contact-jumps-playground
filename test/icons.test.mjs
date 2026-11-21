import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('favicon and header logo put the marked contact on a genuine supporting line', () => {
  for (const [file, prefix] of [['favicon.svg', 'icon'], ['index.html', 'brand']]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    const attributes = suffix => {
      const tag = source.match(new RegExp(`<[^>]+id="${prefix}-${suffix}"[^>]*>`))?.[0];
      assert.ok(tag, `Missing ${prefix}-${suffix}`);
      return Object.fromEntries([...tag.matchAll(/([a-z0-9-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    };
    const line = attributes('support'), dot = attributes('contact');
    const slope = (Number(line.y2) - Number(line.y1)) / (Number(line.x2) - Number(line.x1));
    const lineY = x => Number(line.y1) + slope * (x - Number(line.x1));
    assert.ok(Math.abs(Number(dot.cy) - lineY(Number(dot.cx))) < 1e-12, `${file}: dot must lie on support`);
    for (const pair of attributes('chain').points.split(' ')) {
      const [x, y] = pair.split(',').map(Number);
      // SVG y points downwards, so a graph-majorizing line has smaller SVG y.
      assert.ok(y >= lineY(x) - 1e-12, `${file}: support must lie above every chain point`);
    }
  }
});
