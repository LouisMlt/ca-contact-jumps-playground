import katex from './vendor/katex/katex.mjs';

const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function math(tex) {
  return `<span class="tex" data-tex="${escape(tex)}" data-typeset="${escape(tex)}">${katex.renderToString(tex, {
    throwOnError: true, trust: false, output: 'htmlAndMathml',
  })}</span>`;
}

export function typesetStatic(root = document) {
  for (const element of root.querySelectorAll('[data-tex]')) {
    const tex = element.dataset.tex;
    if (element.dataset.typeset === tex) continue;
    element.innerHTML = katex.renderToString(tex, { throwOnError: true, trust: false, output: 'htmlAndMathml' });
    element.dataset.typeset = tex;
  }
}
