export const REFERENCE = '55440';

export function upperHull(points) {
  const hull = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('Non-finite point');
    if (hull.length && p.x <= hull.at(-1).x) throw new Error('Points must have strictly increasing x');
    while (hull.length > 1) {
      const [a, b] = hull.slice(-2);
      const cross = (b.x - a.x) * (p.y - b.y) - (b.y - a.y) * (p.x - b.x);
      // Retain collinear boundary points: a supporting face can have ties.
      if (cross > 0) hull.pop(); else break;
    }
    hull.push(p);
  }
  return hull;
}

export function support(points, lambda) {
  if (!points.length || !Number.isFinite(lambda) || lambda < 0) throw new Error('Invalid support input');
  const intercept = Math.max(...points.map(p => p.y - lambda * p.x));
  const scale = Math.max(1, ...points.map(p => Math.abs(p.y)), Math.abs(intercept));
  const touching = points.filter(p => Math.abs(p.y - lambda * p.x - intercept) < 1e-10 * scale);
  return { lambda, intercept, touching };
}

export function supportSlope(hull, i) {
  if (hull.length < 2) return 0;
  const slope = (a, b) => (b.y - a.y) / (b.x - a.x);
  if (i === 0) return Math.max(0, slope(hull[0], hull[1]) * 1.35);
  if (i === hull.length - 1) return Math.max(0, slope(hull.at(-2), hull.at(-1)) * 0.55);
  return Math.max(0, (slope(hull[i - 1], hull[i]) + slope(hull[i], hull[i + 1])) / 2);
}

export function hullHeight(hull, x) {
  for (let i = 1; i < hull.length; i++) {
    const a = hull[i - 1], b = hull[i];
    if (x >= a.x && x <= b.x) return a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  }
  return null;
}

// Subtract the finite, piecewise-linear upper boundary. This is a labelled
// diagnostic projection, never an alteration of the original CA coordinates.
export function boundaryGaps(points) {
  const hull = upperHull(points), boundary = new Set(hull);
  return points.map(p => ({ ...p, originalY: p.y,
    y: boundary.has(p) ? 0 : p.y - hullHeight(hull, p.x) }));
}

// Zoom only the viewport. Supports and boundary classification must still be
// calculated from the complete sample by the caller, before using this window.
export function coordinateWindow(points, zoom = 1, center = null) {
  if (points.length < 2 || !Number.isFinite(zoom) || zoom < 1 || zoom > 32
      || (center !== null && !Number.isFinite(center))) throw new Error('Invalid viewport');
  const min = points[0].x, max = points.at(-1).x, half = (max - min) / (2 * zoom);
  if (zoom === 1) return { minX: min, maxX: max, center: (min + max) / 2, visible: [...points] };
  let middle = Math.max(min + half, Math.min(max - half, center ?? (min + max) / 2));
  let visible = points.filter(p => p.x >= middle - half && p.x <= middle + half);
  if (!visible.length) {
    const nearest = points.reduce((a, b) => Math.abs(a.x-middle) < Math.abs(b.x-middle) ? a : b);
    middle = Math.max(min + half, Math.min(max - half, nearest.x));
    visible = points.filter(p => p.x >= middle - half && p.x <= middle + half);
  }
  return { minX: middle - half, maxX: middle + half, center: middle, visible };
}

export function schematicPoints() {
  return [[1, 1], [2, 1.6], [3, 2.0], [4, 4.6], [5, 3.8], [6, 4], [7, 4.5], [8, 4.8], [9, 5.4]]
    .map(([x, y], i) => ({ id: `s${i}`, x, y, label: `P${i + 1}`, schematic: true }));
}

export function numericalPoints(states, alpha, k, count) {
  if (!(alpha > 0 && alpha < 1) || !Number.isInteger(k) || k < 1) throw new Error('Invalid theorem parameters');
  const referenceIndex = states.findIndex(s => s.n === REFERENCE);
  if (referenceIndex < 0) throw new Error('Reference missing from data');
  return states.slice(referenceIndex, referenceIndex + count).map(s => ({
    ...s, id: s.n, x: s.logN ** alpha, y: Math.exp(k * s.logRho), label: s.n,
    reference: s.n === REFERENCE,
  }));
}

export function cleanBlock(count) {
  if (!Number.isInteger(count) || count < 2 || count > 8) throw new Error('Invalid block size');
  const points = [{ id: 'left', x: 0, y: 0.9, label: 'bⱼ', schematic: true }];
  for (let i = 0; i <= count; i++) points.push({
    id: `n${i}`, x: 1 + 4 * i / count, y: 1.4 + 1.5 * (i / count) ** 2,
    label: i === count ? 'Nᵣ' : `N${'₀₁₂₃₄₅₆₇₈'[i]}`, block: true, index: i, schematic: true,
  });
  points.push({ id: 'right', x: 6, y: 5.2, label: 'bⱼ₊₁', schematic: true });
  return { points, labels: Array.from({ length: count }, (_, i) => `p_{${i+1}}`) };
}

export function factorText(factors) {
  return factors.map(([p, a]) => a === 1 ? `${p}` : `${p}^${a}`).join(' × ');
}

export function shortInteger(s) {
  s = String(s);
  return s.length <= 12 ? BigInt(s).toLocaleString('en-US') : `${s[0]}.${s.slice(1, 4)}… × 10^${s.length - 1}`;
}

export function statesAtEpsilon(states, epsilon) {
  return states.filter(s => (s.epsilonUpper === null || epsilon <= s.epsilonUpper + 1e-12)
    && epsilon >= s.epsilonLower - 1e-12);
}
