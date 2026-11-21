import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { upperHull, support, supportSlope, hullHeight, schematicPoints,
  numericalPoints, cleanBlock, statesAtEpsilon, boundaryGaps, coordinateWindow } from '../src/math.js';

const data = JSON.parse(readFileSync(new URL('../src/data/ca-states.json', import.meta.url)));

test('schematic supports touch three different points and dominate every point', () => {
  const points = schematicPoints(), hull = upperHull(points);
  assert.equal(hull.length, 3);
  for (let i = 0; i < hull.length; i++) {
    const line = support(points, supportSlope(hull, i));
    assert.ok(line.touching.includes(hull[i]));
    for (const p of points) assert.ok(line.lambda * p.x + line.intercept >= p.y - 1e-12);
  }
  for (const p of points.filter(p => !hull.includes(p))) assert.ok(hullHeight(hull, p.x) > p.y + 0.1);
});

test('collinear boundary points are all retained as supporting-line ties', () => {
  const points = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
  assert.equal(upperHull(points).length, 3);
  assert.equal(support(points, 1).touching.length, 3);
});

test('numerical scene supports majorize all plotted points across parameter extremes', () => {
  for (const alpha of [0.1, 0.25, 0.5, 0.8, 0.95]) for (const k of [1, 2, 4]) {
    const points = numericalPoints(data.states, alpha, k, 80), hull = upperHull(points);
    assert.equal(points[0].reference, true);
    for (let i = 0; i < hull.length; i++) {
      const line = support(points, supportSlope(hull, i));
      assert.ok(line.touching.includes(hull[i]));
      for (const p of points) assert.ok(line.lambda * p.x + line.intercept >= p.y - 1e-7);
    }
    for (const p of points) assert.ok(hullHeight(hull, p.x) >= p.y - 1e-7);
  }
});

test('all clean-block slopes strictly increase and every block point is skipped', () => {
  for (let m = 2; m <= 8; m++) {
    const block = cleanBlock(m), hull = upperHull(block.points);
    assert.deepEqual(hull.map(p => p.id), ['left', 'right']);
    const inner = block.points.filter(p => p.block);
    const slopes = inner.slice(1).map((p, i) => (p.y - inner[i].y) / (p.x - inner[i].x));
    for (let i = 1; i < slopes.length; i++) assert.ok(slopes[i] > slopes[i - 1]);
    for (const p of inner) assert.ok(hullHeight(hull, p.x) > p.y);
    assert.equal(new Set(block.primes).size, m);
    for (const p of block.primes) assert.equal(block.product % BigInt(p), 0n);
  }
});

test('classical transitions include both states at threshold and exclude 24', () => {
  assert.deepEqual(statesAtEpsilon(data.states, 0.11).map(s => s.n), ['60']);
  assert.deepEqual(statesAtEpsilon(data.states, Math.log(6 / 5) / Math.log(5)).map(s => s.n), ['12', '60']);
  assert.deepEqual(statesAtEpsilon(data.states, Math.log(15 / 14) / Math.log(2)).map(s => s.n), ['60', '120']);
  assert.ok(!data.states.some(s => s.n === '24'));
});

test('exact integer factorisations and transition quotients agree with stored path', () => {
  for (let i = 0; i < data.states.length; i++) {
    const s = data.states[i];
    const product = s.factors.reduce((n, [p, a]) => n * BigInt(p) ** BigInt(a), 1n);
    assert.equal(product.toString(), s.n);
    if (i) {
      assert.equal(BigInt(s.n) / BigInt(data.states[i - 1].n), BigInt(s.entering[0]));
      assert.equal(s.epsilonUpper, data.states[i - 1].epsilonLower);
    }
  }
});

test('invalid inputs cannot silently change the mathematical domain', () => {
  for (const alpha of [0, 1, -1]) assert.throws(() => numericalPoints(data.states, alpha, 1, 20));
  assert.throws(() => numericalPoints(data.states, 0.5, 1.5, 20));
  assert.throws(() => support([], 1));
  assert.throws(() => support(schematicPoints(), -1));
});

test('gap projection uses actual ordinate differences and leaves original CA coordinates unchanged', () => {
  const points = numericalPoints(data.states, .5, 1, 80);
  const snapshot = JSON.stringify(points), hull = upperHull(points), gaps = boundaryGaps(points);
  assert.equal(gaps.length, points.length);
  for (let i = 0; i < points.length; i++) {
    assert.equal(gaps[i].x, points[i].x);
    assert.equal(gaps[i].originalY, points[i].y);
    assert.ok(gaps[i].y <= 1e-12);
    if (hull.includes(points[i])) assert.equal(gaps[i].y, 0);
    else assert.ok(Math.abs(gaps[i].y - (points[i].y-hullHeight(hull, points[i].x))) < 1e-12);
  }
  assert.equal(JSON.stringify(points), snapshot);
  assert.ok(gaps.some(p => p.y < 0 && p.y > -0.00001), 'Real data has tiny nonzero gaps to expose');
});

test('zoom is a bounded viewport and preserves complete-sample data and supports', () => {
  const points = numericalPoints(data.states, .5, 1, 80), intercept = support(points, .2).intercept;
  assert.equal(coordinateWindow(points).visible.length, points.length);
  for (const zoom of [2, 4, 8, 16, 32]) for (const p of points) {
    const w = coordinateWindow(points, zoom, p.x);
    assert.ok(w.visible.length > 0);
    assert.ok(w.visible.includes(p));
    assert.ok(w.minX >= points[0].x - 1e-12 && w.maxX <= points.at(-1).x + 1e-12);
    assert.equal(support(points, .2).intercept, intercept);
  }
  assert.throws(() => coordinateWindow(points, 0));
  assert.throws(() => coordinateWindow(points, 64));
});
