'use strict';

const CHAPTERS = [
  { slug: 'overview',        title: 'Overview' },
  { slug: 'comments',        title: 'Comments' },
  { slug: 'types',           title: 'Types' },
  { slug: 'expressions',     title: 'Expressions' },
  { slug: 'statements',      title: 'Statements' },
  { slug: 'aggregates',      title: 'Aggregates & Literals' },
  { slug: 'initialization',  title: 'Initialization' },
  { slug: 'functions',       title: 'Functions & Methods' },
  { slug: 'effects',         title: 'Effects & Hermeticity' },
  { slug: 'optionals-unions',title: 'Optionals & Unions' },
  { slug: 'references',      title: 'References & Pointers' },
  { slug: 'properties',      title: 'Properties' },
  { slug: 'generics',        title: 'Generics' },
  { slug: 'attributes',      title: 'Constants & Attributes' },
  { slug: 'modules',         title: 'Modules & Foreign' },
  { slug: 'asm',             title: 'Inline Assembly' },
  { slug: 'compiler',        title: 'The Compiler' },
];

const contentEl  = document.getElementById('content');
const chaptersEl = document.getElementById('chapters');
const tocEl      = document.getElementById('toc');

const KEYWORDS = new Set([
  'fn', 'let', 'const', 'if', 'else', 'for', 'in', 'return', 'defer', 'type',
  'struct', 'union', 'enum', 'tuple', 'using', 'import', 'foreign', 'with',
  'as', 'is', 'of', 'true', 'false', 'none',
]);

const TYPES = new Set([
  'Bool', 'Bool8', 'Bool16', 'Bool32', 'Bool64',
  'Sint8', 'Sint16', 'Sint32', 'Sint64', 'Sint128',
  'Uint8', 'Uint16', 'Uint32', 'Uint64', 'Uint128',
  'Real16', 'Real32', 'Real64',
  'String', 'Length', 'Address', 'Type', 'MemoryOrder',
]);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightBiron(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const isIdStart = c => /[A-Za-z_]/.test(c);
  const isId      = c => /[A-Za-z0-9_]/.test(c);
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {                       // line comment
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      out += '<span class="tok-c">' + esc(src.slice(i, j)) + '</span>';
      i = j;
    } else if (c === '/' && src[i + 1] === '*') {                // block comment
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
      j = Math.min(n, j + 2);
      out += '<span class="tok-c">' + esc(src.slice(i, j)) + '</span>';
      i = j;
    } else if (c === '"') {                                      // string
      let j = i + 1;
      while (j < n && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
      j = Math.min(n, j + 1);
      out += '<span class="tok-s">' + esc(src.slice(i, j)) + '</span>';
      i = j;
    } else if (c === '@') {                                      // attribute sigil
      out += '<span class="tok-a">@</span>';
      i++;
    } else if (/[0-9]/.test(c)) {                                // number
      let j = i + 1;
      while (j < n && /[0-9a-fA-FxX._]/.test(src[j])) j++;
      out += esc(src.slice(i, j));
      i = j;
    } else if (isIdStart(c)) {                                   // identifier / keyword / type
      let j = i + 1;
      while (j < n && isId(src[j])) j++;
      const w = src.slice(i, j);
      if (KEYWORDS.has(w))                       out += '<span class="tok-k">' + w + '</span>';
      else if (TYPES.has(w) || /^[A-Z]/.test(w)) out += '<span class="tok-t">' + w + '</span>';
      else                                       out += esc(w);
      i = j;
    } else {                                                    // anything else
      out += esc(c);
      i++;
    }
  }
  return out;
}

const CALLOUTS = {
  NOTE:      { label: 'Note',      icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.01"/>' },
  TIP:       { label: 'Tip',       icon: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.6c.6.5 1 1.2 1 2v.4h6v-.4c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>' },
  IMPORTANT: { label: 'Important', icon: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>' },
  WARNING:   { label: 'Warning',   icon: '<path d="M10.3 4 2.6 17.5A1.6 1.6 0 0 0 4 20h16a1.6 1.6 0 0 0 1.4-2.5L13.7 4a1.6 1.6 0 0 0-2.7 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>' },
  CAUTION:   { label: 'Caution',   icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/>' },
};

const CALLOUT_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(<br\s*\/?>)?\s*/i;

function processCallouts(root) {
  for (const bq of root.querySelectorAll('blockquote')) {
    const first = bq.firstElementChild;
    if (!first) continue;
    const m = first.textContent.match(CALLOUT_RE);
    if (!m) continue;
    const type = m[1].toUpperCase();
    const meta = CALLOUTS[type];
    // Strip the [!TYPE] marker (and any trailing break) off the leading block.
    first.innerHTML = first.innerHTML.replace(CALLOUT_RE, '');
    if (first.tagName === 'P' && first.textContent.trim() === '') first.remove();
    bq.classList.add('callout', 'callout-' + type.toLowerCase());
    const title = document.createElement('div');
    title.className = 'callout-title';
    title.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + meta.icon + '</svg>' +
      '<span>' + meta.label + '</span>';
    bq.insertBefore(title, bq.firstChild);
  }
}

const RATIONALE_RE = /^\s*\[!RATIONALE\]\s*(<br\s*\/?>)?\s*/i;

function processRationales(root) {
  for (const bq of Array.from(root.querySelectorAll('blockquote'))) {
    const first = bq.firstElementChild;
    if (!first || !RATIONALE_RE.test(first.textContent)) continue;
    first.innerHTML = first.innerHTML.replace(RATIONALE_RE, '');
    if (first.tagName === 'P' && first.textContent.trim() === '') first.remove();
    const details = document.createElement('details');
    details.className = 'rationale';
    const summary = document.createElement('summary');
    summary.innerHTML =
      '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>' +
      '<span>Rationale</span>';
    const body = document.createElement('div');
    body.className = 'rationale-body';
    while (bq.firstChild) body.appendChild(bq.firstChild);
    details.appendChild(summary);
    details.appendChild(body);
    bq.replaceWith(details);
  }
}

function processFootnotes(md) {
  const defs = {};
  // Pull "[^id]: text" definition lines out of the source.
  md = md.replace(/^\[\^([^\]]+)\]:[ \t]*(.+)$/gm, (_, id, text) => {
    defs[id] = text.trim();
    return '';
  });
  const order = [];
  // Turn each inline "[^id]" into a numbered superscript link.
  md = md.replace(/\[\^([^\]]+)\]/g, (m, id) => {
    if (!(id in defs)) return m;
    let n = order.indexOf(id);
    if (n === -1) { order.push(id); n = order.length - 1; }
    return '<sup class="fn-ref" id="fnref-' + id + '"><a href="#fn-' + id + '">' + (n + 1) + '</a></sup>';
  });
  return { md, defs, order };
}

function appendFootnotes(order, defs) {
  if (!order.length) return;
  let html = '<hr class="fn-sep"><ol class="footnotes">';
  for (const id of order) {
    html += '<li id="fn-' + id + '">' + marked.parseInline(defs[id]) +
      ' <a href="#fnref-' + id + '" class="fn-back" aria-label="Back to reference">↩</a></li>';
  }
  html += '</ol>';
  contentEl.insertAdjacentHTML('beforeend', html);
  // Footnote jumps scroll in place rather than changing the chapter hash.
  for (const a of contentEl.querySelectorAll('.fn-ref a, a.fn-back')) {
    a.addEventListener('click', ev => {
      ev.preventDefault();
      const el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let loadedSlug = null;

function scrollToAnchor(anchor) {
  if (anchor) {
    const el = document.getElementById(anchor);
    if (el) { el.scrollIntoView(); return true; }
  }
  return false;
}

function route() {
  const raw = location.hash.replace(/^#/, '');
  const slash = raw.indexOf('/');
  const slug = slash === -1 ? raw : raw.slice(0, slash);
  const anchor = slash === -1 ? '' : raw.slice(slash + 1);
  if (CHAPTERS.some(c => c.slug === slug)) {
    if (slug === loadedSlug) { if (!scrollToAnchor(anchor)) window.scrollTo(0, 0); }
    else loadChapter(slug, anchor);
  } else if (raw && document.getElementById(raw)) {
    document.getElementById(raw).scrollIntoView();   // same-page anchor
  } else {
    loadChapter(CHAPTERS[0].slug, '');
  }
}

function buildChapterNav(activeSlug) {
  chaptersEl.innerHTML = '';
  for (const ch of CHAPTERS) {
    const a = document.createElement('a');
    a.href = '#' + ch.slug;
    a.textContent = ch.title;
    if (ch.slug === activeSlug) a.className = 'active';
    chaptersEl.appendChild(a);
  }
}

function buildToc(heads, slug) {
  tocEl.innerHTML = '';
  for (const h of heads) {
    const a = document.createElement('a');
    a.href = '#' + slug + '/' + h.id;
    a.textContent = h.textContent;
    a.className = h.tagName === 'H3' ? 'lvl-3' : 'lvl-2';
    a.dataset.target = h.id;
    tocEl.appendChild(a);
  }
}

const ANCHOR_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
  '<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

function decorateHeadings(heads, slug) {
  for (const h of heads) {
    const a = document.createElement('a');
    a.className = 'heading-anchor';
    a.href = '#' + slug + '/' + h.id;
    a.setAttribute('aria-label', 'Link to this section');
    a.innerHTML = ANCHOR_ICON;
    h.appendChild(a);
  }
}

let spyHeads = [];
let ticking = false;

function updateSpy() {
  ticking = false;
  const headH = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--doc-head-h'), 10) || 62;
  const threshold = headH + 24;
  let current = spyHeads.length ? spyHeads[0].id : null;
  for (const h of spyHeads) {
    if (h.getBoundingClientRect().top <= threshold) current = h.id;
    else break;
  }
  for (const a of tocEl.querySelectorAll('a')) {
    a.classList.toggle('active', a.dataset.target === current);
  }
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateSpy);
}

async function loadChapter(slug, anchor) {
  const ch = CHAPTERS.find(c => c.slug === slug) || CHAPTERS[0];
  buildChapterNav(ch.slug);
  document.title = 'Biron · ' + ch.title;
  contentEl.innerHTML = '<p class="doc-loading">Loading…</p>';

  let md;
  try {
    const res = await fetch('doc/' + ch.slug + '.md');
    if (!res.ok) throw new Error(String(res.status));
    md = await res.text();
  } catch (e) {
    return;
  }

  const fn = processFootnotes(md);
  contentEl.innerHTML = marked.parse(fn.md);

  // Give every h2/h3 a unique id for the TOC.
  const heads = contentEl.querySelectorAll('h2, h3');
  const used = new Set();
  for (const h of heads) {
    let base = slugify(h.textContent) || 'section';
    let s = base;
    let k = 1;
    while (used.has(s)) s = base + '-' + (++k);
    used.add(s);
    h.id = s;
  }

  // Highlight code blocks (fenced ```biron, or unlabeled).
  for (const code of contentEl.querySelectorAll('pre code')) {
    const cls = code.className || '';
    if (cls === '' || /\blanguage-biron\b/.test(cls)) {
      code.innerHTML = highlightBiron(code.textContent);
    }
  }

  processRationales(contentEl);
  processCallouts(contentEl);
  appendFootnotes(fn.order, fn.defs);

  buildToc(heads, slug);
  decorateHeadings(heads, slug);
  spyHeads = Array.from(heads);
  loadedSlug = slug;
  if (!scrollToAnchor(anchor)) window.scrollTo(0, 0);
  updateSpy();
}

window.addEventListener('hashchange', route);
window.addEventListener('scroll', onScroll, { passive: true });
route();
