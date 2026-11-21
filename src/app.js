import { upperHull, support, supportSlope, hullHeight, schematicPoints, numericalPoints,
  cleanBlock, factorText, shortInteger, statesAtEpsilon } from './math.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
const axisFmt = n => Number(n).toLocaleString('en-US', { maximumSignificantDigits: 3, notation: 'compact' });
const colour = { teal: '#5ee0c2', gold: '#eac978', coral: '#ff939b', muted: '#899bb8', violet: '#b9a4f7' };
const state = { scene: 'contacts', mode: 'schematic', alpha: 0.5, k: 1, count: 30, turn: 260,
  epsilon: 0.11, primes: 4, pinned: true, gaps: true, selected: null };
let data, current, timer = null, lastWidth = 0;

function restore() {
  const p = new URLSearchParams(location.search);
  if (['switches', 'contacts', 'block'].includes(p.get('scene'))) state.scene = p.get('scene');
  if (['schematic', 'numerical'].includes(p.get('mode'))) state.mode = p.get('mode');
  const bounds = { alpha: [0.1, 0.95], k: [1, 4], count: [12, 80], turn: [0, 1000], epsilon: [0.07, 0.24], primes: [2, 8] };
  for (const [key, [lo, hi]] of Object.entries(bounds)) if (p.has(key)) {
    const n = Number(p.get(key));
    if (Number.isFinite(n) && n >= lo && n <= hi && (!['k', 'count', 'turn', 'primes'].includes(key) || Number.isInteger(n))) state[key] = n;
  }
  if (![12, 30, 60, 80].includes(state.count)) state.count = 30;
}

function sceneData() {
  if (state.scene === 'switches') {
    const points = data.states.slice(0, 12).map(s => ({ ...s, id: s.n, x: s.logN, y: s.logRho, label: s.n }));
    points.push({ id: '24', x: Math.log(24), y: Math.log(2.5), label: '24', nonCA: true });
    points.sort((a, b) => a.x - b.x);
    return { points, lambda: state.epsilon, xLabel: 'ln n', yLabel: 'ln ρ(n)' };
  }
  if (state.scene === 'block') return { ...cleanBlock(state.primes), lambda: 0.5, xLabel: 'X · schematic', yLabel: 'Y · schematic' };
  const points = state.mode === 'schematic' ? schematicPoints() : numericalPoints(data.states, state.alpha, state.k, state.count);
  const hull = upperHull(points), maxSlope = Math.max(supportSlope(hull, 0), 0.01);
  return { points, lambda: maxSlope * state.turn / 1000,
    xLabel: state.mode === 'schematic' ? 'X · schematic' : `X(n) = (ln n)^${state.alpha.toFixed(2)}`,
    yLabel: state.mode === 'schematic' ? 'Y · schematic' : `Y(n) = ρ(n)^${state.k}` };
}

function plot(scene) {
  const { points, lambda } = scene, hull = upperHull(points), line = support(points, lambda);
  // Reflow the drawing instead of shrinking a desktop SVG's text to a few pixels.
  const W = Math.max(300, Math.round($('plot').getBoundingClientRect().width) || 920);
  const mobile = W < 560, H = mobile ? 440 : 530;
  const left = mobile ? 52 : 78, right = mobile ? 22 : 45, top = 48, bottom = 66;
  lastWidth = W;
  $('plot').setAttribute('viewBox', `0 0 ${W} ${H}`);
  const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y));
  const dx = maxX - minX || 1, dy = maxY - minY || 1;
  const x0 = minX - dx * .08, x1 = maxX + dx * .07, y0 = minY - dy * .13, y1 = maxY + dy * .25;
  const px = x => left + (x - x0) / (x1 - x0) * (W - left - right);
  const py = y => H - bottom - (y - y0) / (y1 - y0) * (H - top - bottom);
  const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(2)},${py(p.y).toFixed(2)}`).join(' ');
  const hullIds = new Set(hull.map(p => p.id));
  let svg = `<title id="svg-title">${escape($('plot-title').textContent)}</title><desc id="svg-description">${escape($('scope-note').textContent)} Circles mark points on the finite upper boundary; crosses lie below it. Use the labelled controls or focus a point for its details.</desc><defs><clipPath id="chart-clip"><rect x="${left}" y="${top - 10}" width="${W-left-right}" height="${H-top-bottom+10}"/></clipPath></defs>`;
  for (let i = 0; i <= 4; i++) {
    const x = minX + dx * i / 4, y = minY + dy * i / 4;
    svg += `<path d="M${px(x)},${top}V${H-bottom} M${left},${py(y)}H${W-right}" stroke="#26354c" stroke-dasharray="2 7"/><text x="${px(x)}" y="${H-bottom+27}" fill="${colour.muted}" font-size="14" text-anchor="middle">${axisFmt(x)}</text><text x="${left-10}" y="${py(y)+4}" fill="${colour.muted}" font-size="14" text-anchor="end">${axisFmt(y)}</text>`;
  }
  svg += `<text x="${W-right}" y="${H-13}" fill="#afbed5" font-size="14" text-anchor="end">${escape(scene.xLabel)}</text><text x="${left}" y="24" fill="#afbed5" font-size="14">${escape(scene.yLabel)}</text><path d="M${left},${top}V${H-bottom}H${W-right}" fill="none" stroke="#52617b"/>`;
  svg += '<g clip-path="url(#chart-clip)">';
  if (state.scene === 'block') {
    const inner = points.filter(p => p.block);
    svg += `<path d="${path(inner)}" fill="none" stroke="${colour.gold}" stroke-width="2.2"/><path d="${path([inner[0], inner.at(-1)])}" stroke="${colour.gold}" stroke-dasharray="6 5" opacity=".6"/>`;
    svg += `<text x="${px(3)}" y="${py(3.35)}" text-anchor="middle" fill="${colour.gold}" font-size="16">s₁ &lt; s₂ &lt; ⋯ &lt; sᵣ</text>`;
  } else svg += `<path d="${path(points)}" fill="none" stroke="#60738f" stroke-width="1.3" opacity=".45"/>`;
  svg += `<path d="${path(hull)}" fill="none" stroke="${colour.teal}" stroke-width="1.6" opacity=".3"/>`;
  const addLine = (l, color, opacity, width, dash = '') => `<path d="M${px(x0)},${py(l.lambda*x0+l.intercept)}L${px(x1)},${py(l.lambda*x1+l.intercept)}" fill="none" stroke="${color}" opacity="${opacity}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  if (state.scene !== 'switches' && state.pinned) {
    const indices = [...new Set([0, Math.floor(hull.length / 2), hull.length - 1])];
    indices.forEach((i, j) => { svg += addLine(support(points, supportSlope(hull, i)), [colour.gold, colour.violet, colour.coral][j], .65, 1.6, '7 6'); });
  }
  svg += addLine(line, colour.teal, .96, 2.7);
  if (state.gaps && state.scene !== 'switches') for (const p of points) {
    if (hullIds.has(p.id)) continue;
    const h = hullHeight(hull, p.x);
    if (h !== null && py(p.y) - py(h) > 8) svg += `<path d="M${px(p.x)},${py(h)+4}V${py(p.y)-8}" stroke="${colour.coral}" opacity=".55" stroke-dasharray="3 5"/><path d="M${px(p.x)-4},${py(h)}H${px(p.x)+4}" stroke="${colour.coral}" opacity=".7"/>`;
  }
  svg += '</g>';
  for (const [i, p] of points.entries()) {
    const x = px(p.x), y = py(p.y), boundary = hullIds.has(p.id), touching = line.touching.includes(p), selected = state.selected === p.id;
    const c = p.reference ? colour.gold : boundary ? colour.teal : colour.coral;
    const description = p.reference ? 'reference competitor, excluded from contacts' : boundary ? (p.schematic ? 'supporting contact in this schematic' : 'finite-sample boundary candidate, not globally certified') : 'skipped point below the finite upper boundary';
    svg += `<g data-point="${escape(p.id)}" tabindex="0" role="button" aria-label="${escape(p.label)}: ${description}" ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}><title>${escape(p.label)} — ${description}</title><circle class="point-hit" cx="${x}" cy="${y}" r="15" fill="transparent"/>`;
    if (touching) svg += `<circle cx="${x}" cy="${y}" r="13" fill="${c}" opacity=".11"/><circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${c}" opacity=".45"/>`;
    svg += `<circle class="selection-halo" cx="${x}" cy="${y}" r="12" fill="none" stroke="${c}" stroke-width="2" opacity="${selected ? .8 : 0}"/>`;
    if (p.reference) svg += `<path d="M${x},${y-6}l6 6-6 6-6-6Z" fill="#0d1626" stroke="${c}" stroke-width="2"/>`;
    else if (boundary) svg += `<circle cx="${x}" cy="${y}" r="5.7" fill="#0d1626" stroke="${c}" stroke-width="2.4"/>`;
    else svg += `<path d="m${x-4.5},${y-4.5} 9 9m-9 0 9-9" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
    if (points.length <= 14 || selected || touching || i === 0 || i === points.length - 1) {
      const label = p.schematic ? p.label : shortInteger(p.label);
      const labelWidth = label.length * 7.5;
      const labelX = Math.max(labelWidth / 2 + 3, Math.min(W-labelWidth / 2-3, x));
      svg += `<text x="${labelX}" y="${y+(boundary ? -19 : 25)}" fill="${c}" font-size="14" text-anchor="middle">${escape(label)}</text>`;
    }
    svg += '</g>';
  }
  $('plot').innerHTML = svg;
  current = { ...scene, hull, line };
}

function headings() {
  const contact = state.scene === 'contacts', numerical = contact && state.mode === 'numerical';
  $('contact-controls').hidden = !contact; $('switch-controls').hidden = state.scene !== 'switches'; $('block-controls').hidden = state.scene !== 'block';
  $('numerical-controls').hidden = !numerical;
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === state.scene));
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  $('scene-index').textContent = `${state.scene === 'switches' ? '01' : contact ? '02' : '03'} / 03`;
  if (contact) {
    $('plot-kind').textContent = numerical ? 'FINITE NUMERICAL SAMPLE · GLOBAL CONTACTS NOT CERTIFIED' : 'SCHEMATIC · THE GEOMETRIC IDEA';
    $('plot-title').textContent = numerical ? 'Real numbers. A finite window.' : 'A line can touch. A point can miss.';
    $('formula').innerHTML = '<span>X(n) = (ln n)<sup>α</sup></span><span>Y(n) = ρ(n)<sup>k</sup></span><span>maximise Y − λX</span>';
    $('scope-note').textContent = numerical ? `First ${state.count} numerical CA states from 55440. Lines support only this plotted sample; later CA states may invalidate them. The gold diamond is the excluded reference competitor. Rounded values are not certificates.` : 'Schematic geometry. These positions are chosen to explain the idea, not to represent numerical CA values.';
    $('guide-label').textContent = numerical ? 'A FINITE PICTURE HAS LIMITS' : 'LOOK FOR THE GAP';
    $('guide-text').textContent = numerical ? 'Try changing α or k. The finite upper boundary changes, but a global contact must survive comparison with every later CA integer too.' : 'The crosses sit strictly below the upper boundary. A line supporting all points must pass above each cross. The dashed lines touch three different boundary points.';
    $('contact-legend').textContent = numerical ? 'finite-sample candidate' : 'supporting contact';
  } else if (state.scene === 'switches') {
    $('plot-kind').textContent = 'SMALL INTEGER EXAMPLES · NUMERICAL THRESHOLDS';
    $('plot-title').textContent = 'One parameter. Many prime switches.';
    $('formula').innerHTML = '<span>x = ln n</span><span>y = ln ρ(n)</span><span>maximise y − εx</span>';
    $('scope-note').textContent = 'A finite classical-envelope illustration. Integer values and factorisations are exact; logarithms and tie locations are numerical. The red cross at 24 illustrates a number that is not CA.';
    $('guide-label').textContent = 'PAUSE ON A TIE';
    $('guide-text').textContent = 'At the 12–60 threshold, both neighbours maximise the objective. A little below it, 5 has entered. At the next switch, the exponent of 2 increases: 60 becomes 120.';
    $('contact-legend').textContent = 'classical envelope state';
  } else {
    $('plot-kind').textContent = 'SCHEMATIC · A CLEAN BLOCK AND ITS BRACKETING CONTACTS';
    $('plot-title').textContent = 'The primes enter. The contacts skip.';
    $('formula').innerHTML = '<span>Nᵢ = N₀p₁⋯pᵢ</span><span>s₁ &lt; ⋯ &lt; sᵣ</span><span>p₁⋯pᵣ ∣ bⱼ₊₁ / bⱼ</span>';
    $('scope-note').textContent = 'Schematic clean-block geometry and illustrative prime labels, not a computed clean cluster. Both block endpoints lie below the bracketing chord here; neither is claimed to be a contact.';
    $('guide-label').textContent = 'THE BLOCK ENDPOINTS NEED NOT BE CONTACTS';
    $('guide-text').textContent = 'Increasing slopes exclude the interior CA states. The argument brackets the whole block with consecutive contacts; divisibility carries every fresh prime into their quotient.';
    $('contact-legend').textContent = 'bracketing contact';
    const block = cleanBlock(state.primes);
    $('prime-tokens').innerHTML = block.primes.map(p => `<span>${p}</span>`).join('');
    $('prime-product').textContent = block.product.toLocaleString('en-US');
  }
}

function inspector() {
  const p = current.points.find(p => p.id === state.selected) || current.line.touching[0];
  const boundary = current.hull.includes(p), h = hullHeight(current.hull, p.x);
  let html;
  if (state.scene === 'switches') {
    const states = statesAtEpsilon(data.states, state.epsilon);
    html = `<p class="eyebrow">${states.length > 1 ? 'BOTH CHOICES AT THE SWITCH' : 'CLASSICAL STATE AT THIS ε'}</p><h3>${states.map(s => shortInteger(s.n)).join(' &amp; ')}</h3>${states.map(s => `<p class="number">${escape(factorText(s.factors))}</p>`).join('')}<p>Lower ε to admit more factors. Tie buttons set the floating-point threshold directly.</p>`;
    if (p.nonCA) html += '<p><strong>24 is not CA:</strong> beating 12 requires ε ≤ 0.09954, while beating 60 requires ε ≥ 0.12368. These conditions cannot overlap.</p>';
  } else if (state.scene === 'block') {
    html = `<p class="eyebrow">THE QUOTIENT INHERITS THE PRIMES</p><h3>ω(bⱼ₊₁ / bⱼ) ≥ ${state.primes}</h3><p>The bracketing contacts absorb all ${state.primes} distinct fresh primes. There may be additional prime factors.</p><p class="number">bⱼ ∣ N₀ ∣ Nᵣ ∣ bⱼ₊₁</p><p>Adding points in this scene illustrates the mechanism; the theorem's unbounded conclusion needs its full argument.</p>`;
  } else {
    const title = p.reference ? 'Reference competitor' : boundary ? (p.schematic ? 'A supporting contact' : 'Finite-sample candidate') : 'A skipped point';
    html = `<p class="eyebrow">CLICK ANY POINT TO INSPECT</p><h3>${title}</h3><p class="number">${p.schematic ? escape(p.label) : escape(shortInteger(p.n))}</p>`;
    if (p.reference) html += '<p>55440 participates in every comparison, but is excluded from the theorem’s contact set.</p>';
    else if (!boundary) html += `<p>Gap to the finite upper boundary: <strong>${fmt(h-p.y)}</strong>. This point cannot touch a line majorising even this finite set.</p>`;
    else html += `<p>${p.schematic ? 'One of three points touched by the pinned supports. Move λ to change which point the current line touches.' : 'This point supports a line within the plotted sample. That does not certify comparison with all CA integers.'}</p>`;
    if (p.factors) html += `<details><summary>Exact integer and factorisation</summary><code>${escape(p.n)}<br>${escape(factorText(p.factors))}</code></details>`;
    const names = current.line.touching.map(q => q.schematic ? q.label : shortInteger(q.n));
    html += `<p>Current line touches ${names.map(escape).join(', ')}${current.line.touching.some(q => q.reference) ? ' (reference excluded)' : ''}.</p>`;
  }
  if ($('inspector').innerHTML !== html) $('inspector').innerHTML = html;
}

function syncControls() {
  $('alpha').value = state.alpha; $('alpha-value').value = state.alpha.toFixed(2);
  $('power').value = state.k; $('sample-count').value = state.count;
  $('slope').value = state.turn; $('slope-value').value = fmt(current.lambda);
  $('slope').setAttribute('aria-valuetext', `Supporting-line slope lambda ${fmt(current.lambda)}`);
  $('epsilon').value = state.epsilon; $('epsilon-value').value = state.epsilon.toFixed(5);
  $('prime-count').value = state.primes; $('prime-count-value').value = state.primes;
  $('pinned').checked = state.pinned; $('gaps').checked = state.gaps;
}

function render() { headings(); plot(sceneData()); syncControls(); inspector(); }
function selectPoint(id) {
  state.selected = id;
  // Update the existing nodes so keyboard focus stays on the selected point.
  for (const group of $('plot').querySelectorAll('[data-point]')) {
    const selected = group.dataset.point === id;
    group.setAttribute('aria-pressed', String(selected));
    group.querySelector('.selection-halo').setAttribute('opacity', selected ? '.8' : '0');
  }
  inspector();
}
function stop() { if (timer) clearInterval(timer); timer = null; $('animate').textContent = 'Play the sweep'; }
function changeScene(scene) { stop(); state.scene = scene; state.selected = null; render(); }

document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => changeScene(b.dataset.scene)));
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { stop(); state.mode = b.dataset.mode; state.selected = null; render(); }));
const inputs = { alpha: 'alpha', power: 'k', 'sample-count': 'count', slope: 'turn', epsilon: 'epsilon', 'prime-count': 'primes' };
for (const [id, key] of Object.entries(inputs)) $(id).addEventListener('input', e => {
  stop(); state[key] = Number(e.target.value); state.selected = null; render();
});
for (const key of ['pinned', 'gaps']) $(key).addEventListener('change', e => { state[key] = e.target.checked; render(); });
$('tie-five').addEventListener('click', () => { state.epsilon = Math.log(6/5) / Math.log(5); render(); });
$('tie-two').addEventListener('click', () => { state.epsilon = Math.log(15/14) / Math.log(2); render(); });
$('plot').addEventListener('click', e => { const p = e.target.closest('[data-point]'); if (p) selectPoint(p.dataset.point); });
$('plot').addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key) && e.target.closest('[data-point]')) { e.preventDefault(); selectPoint(e.target.closest('[data-point]').dataset.point); } });
$('animate').addEventListener('click', () => {
  if (timer) return stop();
  $('animate').textContent = 'Pause the sweep';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  timer = setInterval(() => { state.turn = (state.turn + (reduced ? 90 : 7)) % 1001; state.selected = null; render(); }, reduced ? 1000 : 65);
});
$('reset').addEventListener('click', () => { stop(); Object.assign(state, { mode: 'schematic', alpha: .5, k: 1, count: 30, turn: 260, epsilon: .11, primes: 4, pinned: true, gaps: true, selected: null }); render(); });
$('next-chapter').addEventListener('click', () => { const scenes = ['switches', 'contacts', 'block']; changeScene(scenes[(scenes.indexOf(state.scene)+1)%3]); });
$('share').addEventListener('click', async () => {
  const url = new URL(location.href); url.search = '';
  for (const key of ['scene', 'mode', 'alpha', 'k', 'count', 'turn', 'epsilon', 'primes']) url.searchParams.set(key, state[key]);
  try { await navigator.clipboard.writeText(url.href); $('utility-status').textContent = 'Link copied with your current parameters.'; }
  catch { $('utility-status').textContent = `Copy this address: ${url.href}`; }
});
$('download').addEventListener('click', () => {
  const svg = $('plot').cloneNode(true); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(svg.viewBox.baseVal.width)); bg.setAttribute('height', String(svg.viewBox.baseVal.height)); bg.setAttribute('fill', '#0d1626'); svg.insertBefore(bg, svg.firstChild);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const a = document.createElement('a'); a.href = url; a.download = `ca-${state.scene}-${state.mode}.svg`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); $('utility-status').textContent = 'Plot saved. Its SVG description includes the illustration’s scope.';
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
new ResizeObserver(() => {
  const width = Math.max(300, Math.round($('plot').getBoundingClientRect().width));
  if (data && width !== lastWidth) render();
}).observe($('plot').parentElement);

try {
  const response = await fetch(new URL('./data/ca-states.json', import.meta.url));
  if (!response.ok) throw new Error(`Data request returned ${response.status}`);
  data = await response.json(); restore(); render();
} catch (error) {
  console.error(error); data = null; stop(); $('load-error').hidden = false;
  $('plot').setAttribute('hidden', '');
  $('load-error').textContent = 'The interactive data could not be loaded. Please reload or serve the site over HTTP. The explanation below remains available.';
  document.querySelectorAll('.playground button, .playground input, .playground select').forEach(el => { el.disabled = true; });
}
