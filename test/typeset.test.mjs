import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { math } from '../src/typeset.js';

test('all static LaTeX and symbolic mechanism formulas render without parse errors', () => {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const tex = [...html.matchAll(/data-tex="([^"]+)"/g)].map(m => m[1]
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&'));
  tex.push(String.raw`X(n)=(\log n)^\alpha`, String.raw`Y(n)=\rho(n)^k`,
    String.raw`N_i=N_{i-1}p_i`, String.raw`p_1\cdots p_r\mid\frac{b_{j+1}}{b_j}`,
    String.raw`\omega\!\left(\frac{b_{j+1}}{b_j}\right)\ge 8`);
  for (const value of tex) {
    const result = math(value);
    assert.ok(result.includes('katex-mathml'), value);
    assert.ok(!result.includes('katex-error'), value);
  }
});
