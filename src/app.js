import { upperHull, support, supportSlope, hullHeight, schematicPoints, numericalPoints,
  cleanBlock, factorText, shortInteger, statesAtEpsilon, boundaryGaps, coordinateWindow } from './math.js';
import { math, typesetStatic } from './typeset.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 });
const precise = n => n !== 0 && (Math.abs(n) < .001 || Math.abs(n) >= 1e6) ? n.toExponential(5) : Number(n.toPrecision(9)).toString();
const axisFmt = n => n !== 0 && Math.abs(n) < .001 ? n.toExponential(1) : Number(n).toLocaleString('en-US', { maximumSignificantDigits: 3, notation: 'compact' });
const colour = { teal: '#5ee0c2', gold: '#eac978', coral: '#ff939b', muted: '#899bb8', violet: '#b9a4f7' };
const state = { scene: 'contacts', mode: 'numerical', alpha: 0.5, k: 1, count: 30, turn: 260,
  epsilon: 0.11, primes: 4, pinned: true, gaps: true, selected: null,
  projection: 'coordinates', zoom: 1, center: null, blockStep: 1 };
let data, current, timer = null, lastWidth = 0;

function restore() {
  const p = new URLSearchParams(location.search);
  if (['switches', 'contacts', 'block'].includes(p.get('scene'))) state.scene = p.get('scene');
  if (['schematic', 'numerical'].includes(p.get('mode'))) state.mode = p.get('mode');
  if (['coordinates', 'gaps'].includes(p.get('projection'))) state.projection = p.get('projection');
  if (p.has('zoom') && [1, 2, 4, 8, 16, 32].includes(Number(p.get('zoom')))) state.zoom = Number(p.get('zoom'));
  if (p.has('center') && Number.isFinite(Number(p.get('center')))) state.center = Number(p.get('center'));
  for (const key of ['pinned', 'gaps']) if (['true', 'false'].includes(p.get(key))) state[key] = p.get(key) === 'true';
  if (p.has('selected') && p.get('selected').length <= 600) state.selected = p.get('selected');
  if ([1, 2, 3].includes(Number(p.get('blockStep')))) state.blockStep = Number(p.get('blockStep'));
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
  const residual = state.scene === 'contacts' && state.projection === 'gaps';
  const displayed = residual ? boundaryGaps(points) : points;
  const window = coordinateWindow(displayed, state.scene === 'contacts' ? state.zoom : 1, state.center);
  if (state.zoom > 1) state.center = window.center;
  const visible = window.visible.filter(p => state.scene !== 'block' || state.blockStep === 3 || p.block);
  // Reflow the drawing instead of shrinking a desktop SVG's text to a few pixels.
  const W = Math.max(300, Math.round($('plot').getBoundingClientRect().width) || 920);
  const mobile = W < 560, H = mobile ? 440 : 530;
  const left = mobile ? (residual ? 76 : 52) : 88, right = mobile ? 22 : 45, top = 48, bottom = 66;
  lastWidth = W;
  $('plot').setAttribute('viewBox', `0 0 ${W} ${H}`);
  const minX = window.minX, maxX = window.maxX;
  const ys = visible.map(p => p.y);
  if (residual) ys.push(0);
  else for (const x of [minX, maxX]) { const h = hullHeight(hull, x); if (h !== null) ys.push(h); }
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const dx = maxX - minX || 1, dy = maxY - minY || Math.max(.01, Math.abs(maxY) * .05);
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
  const realCoordinates = state.scene === 'contacts' && state.mode === 'numerical';
  const xAxis = realCoordinates ? `X(n) = (ln n)<tspan baseline-shift="super" font-size="10">${state.alpha.toFixed(2)}</tspan>` : escape(scene.xLabel);
  const yAxis = residual ? 'Y − H(X) · actual gap' : realCoordinates ? `Y(n) = ρ(n)<tspan baseline-shift="super" font-size="10">${state.k}</tspan>` : escape(scene.yLabel);
  svg += `<text x="${W-right}" y="${H-13}" fill="#afbed5" font-size="14" text-anchor="end">${xAxis}</text><text x="${left}" y="24" fill="#afbed5" font-size="14">${yAxis}</text><path d="M${left},${top}V${H-bottom}H${W-right}" fill="none" stroke="#52617b"/>`;
  svg += '<g clip-path="url(#chart-clip)">';
  if (state.scene === 'block') {
    const inner = points.filter(p => p.block);
    svg += `<path d="${path(inner)}" fill="none" stroke="${colour.gold}" stroke-width="2.2"/>`;
    if (state.blockStep >= 2) {
      svg += `<path d="${path([inner[0], inner.at(-1)])}" stroke="${colour.gold}" stroke-dasharray="6 5" opacity=".8"/>`;
      svg += `<text x="${px(3)}" y="${py(3.35)}" text-anchor="middle" fill="${colour.gold}" font-size="16">s₁ &lt; s₂ &lt; ⋯ &lt; sᵣ</text>`;
    } else for (let i = 1; i < inner.length; i++) {
      const a = inner[i-1], b = inner[i];
      svg += `<text x="${px((a.x+b.x)/2)}" y="${py((a.y+b.y)/2)-20}" text-anchor="middle" fill="${colour.gold}" font-size="15">×p${'₀₁₂₃₄₅₆₇₈'[i]}</text>`;
    }
  } else if (!residual) svg += `<path d="${path(points)}" fill="none" stroke="#60738f" stroke-width="1.3" opacity=".45"/>`;
  if (!residual && (state.scene !== 'block' || state.blockStep === 3)) svg += `<path d="${path(hull)}" fill="none" stroke="${colour.teal}" stroke-width="1.6" opacity=".6"/>`;
  const addLine = (l, color, opacity, width, dash = '') => `<path d="M${px(x0)},${py(l.lambda*x0+l.intercept)}L${px(x1)},${py(l.lambda*x1+l.intercept)}" fill="none" stroke="${color}" opacity="${opacity}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  if (!residual && state.scene === 'contacts' && state.pinned) {
    const slopes = hull.length === 2 ? [supportSlope(hull, 0),
      (hull[1].y-hull[0].y)/(hull[1].x-hull[0].x), supportSlope(hull, 1)]
      : [...new Set([0, Math.floor(hull.length/2), hull.length-1])].map(i => supportSlope(hull, i));
    slopes.forEach((slope, j) => { svg += addLine(support(points, slope), [colour.gold, colour.violet, colour.coral][j], .65, 1.6, '7 6'); });
  }
  if (state.scene !== 'block') svg += residual ? `<path d="M${px(x0)},${py(0)}H${px(x1)}" stroke="${colour.teal}" stroke-width="2"/>` : addLine(line, colour.teal, .96, 2.7);
  if (residual) for (const p of visible) svg += `<path d="M${px(p.x)},${py(0)}V${py(p.y)}" stroke="${colour.coral}" stroke-dasharray="3 4" opacity=".5"/>`;
  if (!residual && state.gaps && state.scene !== 'switches' && !(state.scene === 'block' && state.blockStep === 1)) for (const p of visible) {
    if (hullIds.has(p.id)) continue;
    const inner = state.scene === 'block' && state.blockStep === 2 ? points.filter(q => q.block) : null;
    const h = inner ? hullHeight([inner[0], inner.at(-1)], p.x) : hullHeight(hull, p.x);
    if (h !== null && py(p.y) - py(h) > 8) svg += `<path d="M${px(p.x)},${py(h)+4}V${py(p.y)-8}" stroke="${colour.coral}" opacity=".55" stroke-dasharray="3 5"/><path d="M${px(p.x)-4},${py(h)}H${px(p.x)+4}" stroke="${colour.coral}" opacity=".7"/>`;
  }
  // Markers outside the viewport are omitted, but never omitted from support calculations.
  for (const [i, p] of visible.entries()) {
    const original = points.find(q => q.id === p.id);
    const x = px(p.x), y = py(p.y), boundary = hullIds.has(p.id), touching = !residual && state.scene !== 'block' && line.touching.includes(original), selected = state.selected === p.id;
    const ordinary = state.scene === 'block' && (state.blockStep === 1 || (state.blockStep === 2 && [0, state.primes].includes(p.index)));
    const c = ordinary ? colour.muted : p.reference ? colour.gold : boundary ? colour.teal : colour.coral;
    const description = ordinary ? 'constructed CA-state illustration, not a claimed contact' : p.reference ? 'reference competitor, excluded from contacts' : boundary ? (p.schematic ? 'finite sketch boundary point, not an asserted global contact' : 'finite-sample boundary candidate, not globally certified') : 'skipped point below the finite upper boundary';
    svg += `<g data-point="${escape(p.id)}" data-boundary="${boundary}" data-x="${original.x}" data-y="${original.y}" data-display-y="${p.y}" tabindex="0" role="button" aria-label="${escape(p.label)}: ${description}" ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}><title>${escape(p.label)} — ${description}</title><circle class="point-hit" cx="${x}" cy="${y}" r="15" fill="transparent"/>`;
    if (touching) svg += `<circle cx="${x}" cy="${y}" r="13" fill="${c}" opacity=".11"/><circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${c}" opacity=".45"/>`;
    svg += `<circle class="selection-halo" cx="${x}" cy="${y}" r="12" fill="none" stroke="${c}" stroke-width="2" opacity="${selected ? .8 : 0}"/>`;
    if (p.reference) svg += `<path d="M${x},${y-6}l6 6-6 6-6-6Z" fill="#0d1626" stroke="${c}" stroke-width="2"/>`;
    else if (boundary || ordinary) svg += `<circle cx="${x}" cy="${y}" r="5.7" fill="${ordinary ? c : '#0d1626'}" stroke="${c}" stroke-width="2.4"/>`;
    else svg += `<path d="m${x-4.5},${y-4.5} 9 9m-9 0 9-9" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
    if (visible.length <= 14 || selected || touching || i === 0 || i === visible.length - 1) {
      const label = p.schematic ? p.label : shortInteger(p.label);
      const labelWidth = label.length * 7.5;
      const labelX = Math.max(labelWidth / 2 + 3, Math.min(W-labelWidth / 2-3, x));
      svg += `<text x="${labelX}" y="${y+(boundary ? -19 : 25)}" fill="${c}" font-size="14" text-anchor="middle">${escape(label)}</text>`;
    }
    svg += '</g>';
  }
  svg += '</g>';
  $('plot').innerHTML = svg;
  $('plot').dataset.projection = residual ? 'gaps' : 'coordinates';
  $('plot').dataset.comparedCount = points.length;
  $('plot').dataset.supportIntercept = line.intercept;
  $('view-note').textContent = residual ? `Showing ${visible.length} of ${points.length} points. H is the finite upper boundary: negative values expose the true gaps; zero is not global certification.` : `Showing ${visible.length} of ${points.length} points. Select a point, then zoom. Supporting lines still compare all ${points.length} points.`;
  current = { ...scene, hull, line, window, residual };
}

function headings() {
  const contact = state.scene === 'contacts', numerical = contact && state.mode === 'numerical';
  const residual = contact && state.projection === 'gaps';
  $('contact-controls').hidden = !contact; $('switch-controls').hidden = state.scene !== 'switches'; $('block-controls').hidden = state.scene !== 'block';
  $('numerical-controls').hidden = !numerical;
  $('view-toolbar').hidden = !contact;
  $('view-note').hidden = !contact;
  $('line-legend').textContent = residual ? 'finite upper boundary (zero)' : 'current support';
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active', b.dataset.scene === state.scene));
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === state.projection); b.setAttribute('aria-pressed', String(b.dataset.view === state.projection)); });
  $('scene-index').textContent = `${state.scene === 'switches' ? '01' : contact ? '02' : '03'} / 03`;
  if (contact) {
    $('plot-kind').textContent = numerical ? 'REAL CA DATA · FINITE SAMPLE · GLOBAL CONTACTS NOT CERTIFIED' : 'CLEAN-BLOCK SKETCH · STRICTLY INCREASING SLOPES · NOT CA DATA';
    $('plot-title').textContent = residual ? 'Make the small gaps visible.' : numerical ? 'Real numbers. A finite window.' : 'A line can touch. A point can miss.';
    $('formula').innerHTML = residual ? `${math(String.raw`g(n)=Y(n)-H(X(n))`)}<span>H = finite upper boundary</span><span>actual gaps</span>` : numerical ? `${math(String.raw`X(n)=(\log n)^\alpha`)}${math(String.raw`Y(n)=\rho(n)^k`)}${math(String.raw`\max\{Y-\lambda X\}`)}` : `<span>Constructed ${math('(X,Y)')} points</span><span>not a CA sequence</span>`;
    const scope = numerical ? `First ${state.count} numerical CA states from 55440; later CA states may invalidate these supports. The gold diamond is the excluded reference. Rounded values are not certificates.` : 'Constructed clean-block sketch: every successive slope strictly increases. These are not computed CA coordinates; the sketch endpoints are not asserted to be global contacts.';
    $('scope-note').textContent = scope + (residual ? ' Diagnostic projection: subtract the finite upper boundary from Y; no global contacts are certified.' : '');
    $('line-controls').hidden = residual;
    $('guide-label').textContent = residual ? 'TRUE GAPS, SEPARATELY SCALED' : numerical ? 'A FINITE PICTURE HAS LIMITS' : 'LOOK FOR THE GAP';
    $('guide-text').textContent = residual ? 'Below zero means a true gap. Return to Coordinates to turn the supporting line.' : numerical ? 'Click a cross, reveal its gap, or zoom in.' : 'Each successive segment is steeper. All interior points lie below the endpoint chord. The middle dashed support touches both endpoints of this finite sketch.';
    $('contact-legend').textContent = numerical ? 'finite-sample candidate' : 'finite sketch boundary';
  } else if (state.scene === 'switches') {
    $('plot-kind').textContent = 'SMALL INTEGER EXAMPLES · NUMERICAL THRESHOLDS';
    $('plot-title').textContent = 'One parameter. Many prime switches.';
    $('formula').innerHTML = `${math(String.raw`x=\log n`)}${math(String.raw`y=\log\rho(n)`)}${math(String.raw`\max\{y-\varepsilon x\}`)}`;
    $('scope-note').textContent = 'A finite classical-envelope illustration. Integer values and factorisations are exact; logarithms and tie locations are numerical. The red cross at 24 illustrates a number that is not CA.';
    $('guide-label').textContent = 'PAUSE ON A TIE';
    $('guide-text').textContent = 'At the 12–60 threshold, both neighbours maximise the objective. A little below it, 5 has entered. At the next switch, the exponent of 2 increases: 60 becomes 120.';
    $('contact-legend').textContent = 'classical envelope state';
  } else {
    $('plot-kind').textContent = `SCHEMATIC MECHANISM · STEP ${state.blockStep} OF 3 · NOT COMPUTED CA DATA`;
    $('plot-title').textContent = ['Each step adds a fresh prime.', 'The slope condition excludes interiors.', 'Contacts bracket the whole block.'][state.blockStep-1];
    $('formula').innerHTML = math([String.raw`N_i=N_0p_1\cdots p_i`,String.raw`s_1<s_2<\cdots<s_r`,String.raw`p_1\cdots p_r\mid\frac{b_{j+1}}{b_j}`][state.blockStep-1]);
    $('scope-note').textContent = 'Schematic deduction, not a computed clean cluster. The positions are constructed and the primes are symbolic; this scene does not establish that such a block exists.';
    $('guide-label').textContent = ['PRIME ENTRY', 'A CONDITION PROVED LATER IN THE ARGUMENT', 'TRANSFER THE PRIME FACTORS'][state.blockStep-1];
    $('guide-text').textContent = ['Start at N₀. Each multiplication introduces one new prime; r is the total number of primes in this block.', 'Under the proof’s sufficiently large clean-block hypotheses, successive slopes increase. The interior points then lie below the block chord.', 'Consecutive contacts absorb the block. Divisibility transfers each of its r fresh primes to the contact quotient.'][state.blockStep-1];
    $('block-step-text').textContent = ['pᵢ names the ith fresh prime. No numerical prime choices are being claimed here.', 'The yellow dashed line is a chord of this block. Its endpoints are not being claimed as contacts.', 'The teal endpoints represent the bracketing contacts; neither block endpoint needs to be a contact.'][state.blockStep-1];
    $('contact-legend').textContent = state.blockStep === 3 ? 'bracketing contact' : 'CA state (schematic)';
    $('line-legend').textContent = state.blockStep === 3 ? 'bracketing chord' : 'block chord';
    const block = cleanBlock(state.primes);
    $('prime-tokens').innerHTML = block.labels.map(p => `<span class="prime-label">${math(p)}</span>`).join('');
    $('prime-product').innerHTML = math(String.raw`p_1\cdots p_r`);
    $('block-product').hidden = state.blockStep !== 3;
    document.querySelectorAll('[data-step]').forEach(b => { b.classList.toggle('active', Number(b.dataset.step) === state.blockStep); b.setAttribute('aria-pressed', String(Number(b.dataset.step) === state.blockStep)); });
  }
  $('next-chapter').textContent = state.scene === 'block' && state.blockStep < 3 ? 'Next step' : 'Next chapter';
  const entering = state.scene === 'block' && state.blockStep === 1;
  $('skipped-legend').hidden = entering;
  $('line-legend-item').hidden = entering;
  $('gap-legend').hidden = state.scene === 'switches' || entering;
  document.querySelector('.legend-contact').style.borderColor = state.scene === 'block' && state.blockStep < 3 ? colour.muted : colour.teal;
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
    html = state.blockStep === 1 ? `<h3>${math(String.raw`N_i=N_{i-1}p_i`)}</h3><p>Each step adds one distinct prime. Here ${math(`r=${state.primes}`)}.</p>` : state.blockStep === 2 ? `<h3>${math(String.raw`s_1<\cdots<s_r`)}</h3><p>The red interiors lie below the yellow chord. This schematic assumes the slope condition; the theorem proves it for sufficiently large clean blocks.</p>` : `<h3>${math(String.raw`\omega\!\left(\frac{b_{j+1}}{b_j}\right)\ge ` + state.primes)}</h3><p>All ${state.primes} distinct fresh primes divide the quotient. Additional factors may occur.</p><p>${math(String.raw`b_j\mid N_0\mid N_r\mid b_{j+1}`)}</p>`;
  } else {
    const title = p.reference ? 'Reference competitor' : boundary ? (p.schematic ? 'A finite sketch boundary point' : 'Finite-sample candidate') : 'A skipped point';
    html = `<p class="eyebrow">CLICK ANY POINT TO INSPECT</p><h3>${title}</h3><p class="number">${p.schematic ? escape(p.label) : escape(shortInteger(p.n))}</p>`;
    if (p.reference) html += '<p>55440 participates in every comparison, but is excluded from the theorem’s contact set.</p>';
    else if (!boundary) html += `<p>Gap to the finite upper boundary: <strong>${precise(h-p.y)}</strong>. This point cannot touch a line majorising even this finite set.</p>`;
    else html += `<p>${p.schematic ? 'One of the two endpoints of the strictly increasing-slope sketch. This does not assert that a block endpoint is a global contact.' : 'This point supports a line within the plotted sample. That does not certify comparison with all CA integers.'}</p>`;
    html += `<dl class="coordinate-values"><dt>Original X</dt><dd>${precise(p.x)}</dd><dt>Original Y</dt><dd>${precise(p.y)}</dd></dl>`;
    if (p.factors) html += `<details><summary>Exact integer and factorisation</summary><code>${escape(p.n)}<br>${escape(factorText(p.factors))}</code><p>X and Y use floating-point logarithms of the exact CA integer and its divisor sum.</p></details>`;
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
  for (const id of ['slope', 'animate', 'pinned', 'gaps']) $(id).disabled = current.residual;
  $('zoom-value').value = `${state.zoom}×`;
  $('zoom-in').disabled = state.zoom >= 32;
  for (const id of ['zoom-out', 'pan-left', 'pan-right', 'fit-view']) $(id).disabled = state.zoom === 1;
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
function changeScene(scene) { stop(); state.scene = scene; state.selected = null; state.zoom = 1; state.center = null; render(); }

document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => changeScene(b.dataset.scene)));
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { stop(); state.mode = b.dataset.mode; state.selected = null; state.zoom = 1; state.center = null; render(); }));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { stop(); state.projection = b.dataset.view; render(); }));
document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { state.blockStep = Number(b.dataset.step); render(); }));
$('zoom-in').addEventListener('click', () => {
  stop(); const selected = current.points.find(p => p.id === state.selected);
  if (selected) state.center = selected.x;
  state.zoom = Math.min(32, state.zoom * 2); render();
});
$('zoom-out').addEventListener('click', () => { stop(); state.zoom = Math.max(1, state.zoom / 2); render(); });
$('fit-view').addEventListener('click', () => { state.zoom = 1; state.center = null; render(); });
for (const [id, direction] of [['pan-left', -1], ['pan-right', 1]]) $(id).addEventListener('click', () => {
  state.center = current.window.center + direction * .65 * (current.window.maxX - current.window.minX); render();
});
const inputs = { alpha: 'alpha', power: 'k', 'sample-count': 'count', slope: 'turn', epsilon: 'epsilon', 'prime-count': 'primes' };
for (const [id, key] of Object.entries(inputs)) $(id).addEventListener('input', e => {
  stop(); state[key] = Number(e.target.value); state.selected = null;
  if (['alpha', 'k', 'count'].includes(key)) { state.zoom = 1; state.center = null; }
  render();
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
$('reset').addEventListener('click', () => { stop(); Object.assign(state, { mode: 'numerical', alpha: .5, k: 1, count: 30, turn: 260, epsilon: .11, primes: 4, pinned: true, gaps: true, selected: null, projection: 'coordinates', zoom: 1, center: null, blockStep: 1 }); render(); });
$('next-chapter').addEventListener('click', () => { if (state.scene === 'block' && state.blockStep < 3) { state.blockStep++; render(); return; } const scenes = ['switches', 'contacts', 'block']; changeScene(scenes[(scenes.indexOf(state.scene)+1)%3]); });
$('share').addEventListener('click', async () => {
  const url = new URL(location.href); url.search = '';
  for (const key of ['scene', 'mode', 'alpha', 'k', 'count', 'turn', 'epsilon', 'primes', 'projection', 'zoom', 'pinned', 'gaps', 'blockStep']) url.searchParams.set(key, state[key]);
  if (state.center !== null) url.searchParams.set('center', state.center);
  if (state.selected !== null) url.searchParams.set('selected', state.selected);
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
  typesetStatic();
  const response = await fetch(new URL('./data/ca-states.json', import.meta.url));
  if (!response.ok) throw new Error(`Data request returned ${response.status}`);
  data = await response.json(); restore(); render();
} catch (error) {
  console.error(error); data = null; stop(); $('load-error').hidden = false;
  $('plot').setAttribute('hidden', '');
  $('load-error').textContent = 'The interactive data could not be loaded. Please reload or serve the site over HTTP. The explanation below remains available.';
  document.querySelectorAll('.playground button, .playground input, .playground select').forEach(el => { el.disabled = true; });
}
