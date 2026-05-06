const DEFAULT_AXES = ['Cost', 'Accuracy', 'Throughput', 'Velma fit', 'Leaderboards', 'Uniqueness'];
const DEFAULT_MAX = 5;
const DEFAULT_COLOR = '#007AFF';
const DEFAULT_VALUE = 3;
const SLOT_COUNT = 10;

const MIN_AXES = 3;
const MAX_AXES = 12;
const MIN_SCALE = 2;
const MAX_SCALE = 10;

const PRESETS = ['#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF3B30', '#FF9500', '#34C759', '#30B0C7'];
const STORAGE_KEY = 'spider-chart-store';
const LEGACY_KEY = 'spider-chart-state';
const SVG_NS = 'http://www.w3.org/2000/svg';

const CX = 300;
const CY = 300;
const MAX_R = 175;
const LABEL_OFFSET_SIDE = 36;
const LABEL_OFFSET_VERT = 20;

let store = defaultStore();
let state = store.slots[store.active];

function defaultSlot(i) {
  return {
    title: `Model ${i + 1}`,
    names: [...DEFAULT_AXES],
    values: DEFAULT_AXES.map(() => DEFAULT_VALUE),
    color: DEFAULT_COLOR,
    max: DEFAULT_MAX,
    edited: false,
  };
}

function defaultStore() {
  return {
    active: 0,
    slots: Array.from({ length: SLOT_COUNT }, (_, i) => defaultSlot(i)),
  };
}

function axisCount() {
  return state.names.length;
}

function angleFor(i, n = axisCount()) {
  return -Math.PI / 2 + i * ((2 * Math.PI) / n);
}

function valueToPoint(value, i) {
  const a = angleFor(i);
  const r = (value / state.max) * MAX_R;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function clampSnap(v) {
  v = Math.max(0, Math.min(state.max, v));
  return Math.round(v * 2) / 2;
}

function isVerticalAxis(i) {
  if (i === 0) return true;
  const n = axisCount();
  if (n % 2 === 0 && i === n / 2) return true;
  return false;
}

function labelOffset(i) {
  return isVerticalAxis(i) ? LABEL_OFFSET_VERT : LABEL_OFFSET_SIDE;
}

function ringValues() {
  const m = state.max;
  if (m <= 8) return Array.from({ length: m }, (_, k) => k + 1);
  const out = [];
  for (let v = 2; v <= m; v += 2) out.push(v);
  return out;
}

function mergeSlot(def, partial, i) {
  const out = { ...def };
  if (partial && typeof partial === 'object') {
    if (typeof partial.title === 'string') out.title = partial.title;
    if (typeof partial.color === 'string') out.color = partial.color;
    if (typeof partial.max === 'number' && partial.max >= MIN_SCALE && partial.max <= MAX_SCALE) {
      out.max = Math.round(partial.max);
    }
    if (
      Array.isArray(partial.names) &&
      partial.names.length >= MIN_AXES &&
      partial.names.length <= MAX_AXES
    ) {
      out.names = partial.names.map((n, k) =>
        typeof n === 'string' && n.trim() ? n : (DEFAULT_AXES[k] || `Axis ${k + 1}`)
      );
      if (Array.isArray(partial.values) && partial.values.length === out.names.length) {
        out.values = partial.values.map((v) => {
          let n = Number(v) || 0;
          n = Math.max(0, Math.min(out.max, n));
          return Math.round(n * 2) / 2;
        });
      } else {
        out.values = out.names.map(() => Math.min(DEFAULT_VALUE, out.max));
      }
    }
    out.edited = !!partial.edited;
  }
  return out;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && Array.isArray(raw.slots)) {
      store = defaultStore();
      const slots = raw.slots.slice(0, SLOT_COUNT);
      slots.forEach((s, i) => {
        store.slots[i] = mergeSlot(defaultSlot(i), s, i);
      });
      const ai = Number(raw.active);
      store.active = Number.isInteger(ai) && ai >= 0 && ai < SLOT_COUNT ? ai : 0;
      state = store.slots[store.active];
      return;
    }
    // Migrate legacy single-state into slot 0
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy && typeof legacy === 'object') {
      store = defaultStore();
      store.slots[0] = mergeSlot(defaultSlot(0), legacy, 0);
      store.slots[0].edited = true;
      state = store.slots[store.active];
      saveStore();
    }
  } catch (_) {}
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function markEdited() {
  state.edited = true;
}

function save() {
  saveStore();
}

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function svgPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function clearGroup(id) {
  const g = document.getElementById(id);
  while (g.firstChild) g.removeChild(g.firstChild);
}

function buildGrid() {
  clearGroup('grid');
  const g = document.getElementById('grid');
  const rings = ringValues();
  const outer = state.max;
  rings.forEach((r) => {
    const points = [];
    for (let i = 0; i < axisCount(); i++) {
      const p = valueToPoint(r, i);
      points.push(`${p.x},${p.y}`);
    }
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points', points.join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', r === outer ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)');
    poly.setAttribute('stroke-width', '1');
    g.appendChild(poly);
  });
}

function buildAxes() {
  clearGroup('axes');
  const g = document.getElementById('axes');
  for (let i = 0; i < axisCount(); i++) {
    const p = valueToPoint(state.max, i);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', CX);
    line.setAttribute('y1', CY);
    line.setAttribute('x2', p.x);
    line.setAttribute('y2', p.y);
    line.setAttribute('stroke', 'rgba(0,0,0,0.08)');
    line.setAttribute('stroke-width', '1');
    g.appendChild(line);
  }
}

function buildScale() {
  clearGroup('scale');
  const g = document.getElementById('scale');
  ringValues().forEach((r) => {
    const p = valueToPoint(r, 0);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', p.x + 8);
    text.setAttribute('y', p.y + 1);
    text.setAttribute('text-anchor', 'start');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '10');
    text.setAttribute('font-weight', '500');
    text.setAttribute('fill', 'rgba(0,0,0,0.32)');
    text.setAttribute(
      'font-family',
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif"
    );
    text.textContent = String(r);
    g.appendChild(text);
  });
}

function buildLabels() {
  clearGroup('labels');
  const g = document.getElementById('labels');
  for (let i = 0; i < axisCount(); i++) {
    const a = angleFor(i);
    const off = labelOffset(i);
    const x = CX + (MAX_R + off) * Math.cos(a);
    const y = CY + (MAX_R + off) * Math.sin(a);
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', '500');
    text.setAttribute('fill', '#1d1d1f');
    text.setAttribute(
      'font-family',
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif"
    );
    text.dataset.index = i;
    text.classList.add('axis-label');
    text.textContent = state.names[i];
    g.appendChild(text);
  }
}

function buildHandles() {
  clearGroup('handles');
  const g = document.getElementById('handles');
  const svg = document.getElementById('chart');

  for (let i = 0; i < axisCount(); i++) {
    const hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('r', '14');
    hit.classList.add('handle-hit');
    hit.dataset.index = i;
    g.appendChild(hit);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '6');
    dot.setAttribute('stroke', 'white');
    dot.setAttribute('stroke-width', '2');
    dot.classList.add('handle-dot');
    dot.dataset.index = i;
    g.appendChild(dot);

    let dragging = false;

    const moveTo = (clientX, clientY) => {
      const pt = svgPoint(svg, clientX, clientY);
      const a = angleFor(i);
      const dx = pt.x - CX;
      const dy = pt.y - CY;
      const proj = dx * Math.cos(a) + dy * Math.sin(a);
      const v = clampSnap((proj / MAX_R) * state.max);
      if (state.values[i] !== v) {
        state.values[i] = v;
        markEdited();
        save();
        render();
        updateActiveTab();
      }
    };

    hit.addEventListener('pointerdown', (e) => {
      dragging = true;
      hit.setPointerCapture(e.pointerId);
      e.preventDefault();
      moveTo(e.clientX, e.clientY);
    });
    hit.addEventListener('pointermove', (e) => {
      if (dragging) moveTo(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      try { hit.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
  }
}

function buildValueRows() {
  const wrap = document.querySelector('.values');
  wrap.innerHTML = '';
  for (let i = 0; i < axisCount(); i++) {
    const row = document.createElement('div');
    row.className = 'value-row';
    const placeholder = DEFAULT_AXES[i] || `Axis ${i + 1}`;
    row.innerHTML = `
      <span class="name" contenteditable="true" spellcheck="false" data-i="${i}" data-placeholder="${escapeHtml(placeholder)}"></span>
      <button class="stepper" data-act="dec" data-i="${i}" aria-label="Decrease">−</button>
      <span class="val" data-i="${i}">${state.values[i]}</span>
      <button class="stepper" data-act="inc" data-i="${i}" aria-label="Increase">+</button>
      <button class="remove-btn" data-act="remove" data-i="${i}" aria-label="Remove axis" ${
        axisCount() <= MIN_AXES ? 'disabled' : ''
      }>×</button>
    `;
    wrap.appendChild(row);

    const nameEl = row.querySelector('.name');
    nameEl.textContent = state.names[i];
    nameEl.addEventListener('input', () => {
      state.names[i] = nameEl.textContent.replace(/\n/g, ' ');
      markEdited();
      save();
      const label = document.querySelector(`.axis-label[data-index="${i}"]`);
      if (label) label.textContent = state.names[i];
      updateActiveTab();
    });
    nameEl.addEventListener('blur', () => {
      const trimmed = nameEl.textContent.trim();
      state.names[i] = trimmed || (DEFAULT_AXES[i] || `Axis ${i + 1}`);
      nameEl.textContent = state.names[i];
      markEdited();
      save();
      const label = document.querySelector(`.axis-label[data-index="${i}"]`);
      if (label) label.textContent = state.names[i];
      updateActiveTab();
    });
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      }
    });
    nameEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      document.execCommand('insertText', false, text.replace(/\n/g, ' '));
    });
  }
}

function onValuesClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const i = +btn.dataset.i;
  const act = btn.dataset.act;
  if (act === 'inc' || act === 'dec') {
    const delta = act === 'inc' ? 0.5 : -0.5;
    state.values[i] = clampSnap(state.values[i] + delta);
    markEdited();
    save();
    render();
    updateActiveTab();
  } else if (act === 'remove') {
    if (axisCount() <= MIN_AXES) return;
    state.names.splice(i, 1);
    state.values.splice(i, 1);
    markEdited();
    save();
    rebuildAll();
    updateActiveTab();
  }
}

function addAxis() {
  if (axisCount() >= MAX_AXES) return;
  const idx = axisCount();
  state.names.push(DEFAULT_AXES[idx] || `Axis ${idx + 1}`);
  state.values.push(clampSnap(state.max / 2));
  markEdited();
  save();
  rebuildAll();
  updateActiveTab();
}

function setScale(newMax) {
  newMax = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(newMax)));
  if (newMax === state.max) return;
  state.max = newMax;
  state.values = state.values.map((v) => clampSnap(v));
  markEdited();
  save();
  rebuildAll();
  updateActiveTab();
}

function restoreCurrentSlot() {
  const i = store.active;
  store.slots[i] = defaultSlot(i);
  state = store.slots[i];
  save();
  document.querySelector('.chart-title').textContent = state.title;
  rebuildAll();
  rebuildTabs();
}

function buildSwatches() {
  const wrap = document.getElementById('swatches');
  wrap.innerHTML = '';
  PRESETS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c;
    b.dataset.color = c;
    b.setAttribute('aria-label', c);
    b.addEventListener('click', () => setColor(c));
    wrap.appendChild(b);
  });
}

function setColor(c) {
  state.color = c;
  markEdited();
  save();
  render();
  updateActiveTab();
}

function render() {
  const points = state.values
    .map((v, i) => {
      const p = valueToPoint(v, i);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const poly = document.getElementById('poly');
  poly.setAttribute('points', points);
  poly.setAttribute('fill', hexToRgba(state.color, 0.22));
  poly.setAttribute('stroke', state.color);
  poly.setAttribute('stroke-width', '2');
  poly.setAttribute('stroke-linejoin', 'round');

  document.querySelectorAll('.handle-hit').forEach((h) => {
    const i = +h.dataset.index;
    const p = valueToPoint(state.values[i], i);
    h.setAttribute('cx', p.x);
    h.setAttribute('cy', p.y);
  });
  document.querySelectorAll('.handle-dot').forEach((h) => {
    const i = +h.dataset.index;
    const p = valueToPoint(state.values[i], i);
    h.setAttribute('cx', p.x);
    h.setAttribute('cy', p.y);
    h.setAttribute('fill', state.color);
  });

  document.querySelectorAll('.value-row .val').forEach((el) => {
    const i = +el.dataset.i;
    el.textContent = state.values[i];
  });

  document.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle(
      'selected',
      s.dataset.color.toLowerCase() === state.color.toLowerCase()
    );
  });

  const cc = document.getElementById('customColor');
  if (cc) cc.value = state.color;

  const scaleVal = document.getElementById('scaleVal');
  if (scaleVal) scaleVal.textContent = state.max;

  const scaleDec = document.getElementById('scaleDec');
  const scaleInc = document.getElementById('scaleInc');
  if (scaleDec) scaleDec.disabled = state.max <= MIN_SCALE;
  if (scaleInc) scaleInc.disabled = state.max >= MAX_SCALE;

  const addBtn = document.getElementById('addAxis');
  if (addBtn) addBtn.disabled = axisCount() >= MAX_AXES;
}

function rebuildAll() {
  buildGrid();
  buildAxes();
  buildScale();
  buildLabels();
  buildHandles();
  buildValueRows();
  render();
}

// ---- Tabs ----

function thumbSvgFor(slot) {
  const cx = 13, cy = 13, r = 11;
  const n = slot.names.length;
  const ang = (i) => -Math.PI / 2 + i * ((2 * Math.PI) / n);
  const ringPts = Array.from({ length: n }, (_, i) => {
    const a = ang(i);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  const polyPts = slot.values
    .map((v, i) => {
      const a = ang(i);
      const rr = (v / slot.max) * r;
      return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
    })
    .join(' ');
  return `<svg viewBox="0 0 26 26" xmlns="${SVG_NS}" class="tab-thumb">
    <polygon points="${ringPts}" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="0.7"/>
    <polygon points="${polyPts}" fill="${hexToRgba(slot.color, 0.3)}" stroke="${slot.color}" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;
}

function rebuildTabs() {
  const wrap = document.getElementById('tabs');
  wrap.innerHTML = '';
  store.slots.forEach((slot, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.i = i;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === store.active ? 'true' : 'false');
    if (i === store.active) btn.classList.add('active');
    if (!slot.edited) btn.classList.add('untouched');
    btn.innerHTML = `
      ${thumbSvgFor(slot)}
      <span class="tab-name">${escapeHtml(slot.title || `Model ${i + 1}`)}</span>
      <span class="tab-dot" style="background:${slot.color}"></span>
    `;
    btn.addEventListener('click', () => setActive(i));
    wrap.appendChild(btn);
  });
}

function updateActiveTab() {
  const i = store.active;
  const slot = store.slots[i];
  const tab = document.querySelector(`.tab[data-i="${i}"]`);
  if (!tab) return;
  tab.classList.toggle('untouched', !slot.edited);
  const name = tab.querySelector('.tab-name');
  if (name) name.textContent = slot.title || `Model ${i + 1}`;
  const dot = tab.querySelector('.tab-dot');
  if (dot) dot.style.background = slot.color;
  const oldThumb = tab.querySelector('svg.tab-thumb');
  if (oldThumb) {
    const tmp = document.createElement('div');
    tmp.innerHTML = thumbSvgFor(slot);
    tab.replaceChild(tmp.firstElementChild, oldThumb);
  }
}

function setActive(i) {
  if (i === store.active) return;
  store.active = i;
  state = store.slots[i];
  save();
  document.querySelector('.chart-title').textContent = state.title;
  rebuildAll();
  document.querySelectorAll('.tab').forEach((t) => {
    const idx = +t.dataset.i;
    t.classList.toggle('active', idx === i);
    t.setAttribute('aria-selected', idx === i ? 'true' : 'false');
  });
}

// ---- PNG export ----

function escapeXml(s) {
  return String(s).replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])
  );
}
function escapeHtml(s) {
  return escapeXml(s);
}

function buildExportSvg() {
  const titleHeight = 70;
  const w = 600;
  const h = 600 + titleHeight;
  const title = (state.title || '').trim();

  const gridParts = [];
  const outer = state.max;
  ringValues().forEach((r) => {
    const pts = [];
    for (let i = 0; i < axisCount(); i++) {
      const p = valueToPoint(r, i);
      pts.push(`${p.x},${p.y}`);
    }
    const stroke = r === outer ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)';
    gridParts.push(`<polygon points="${pts.join(' ')}" fill="none" stroke="${stroke}" stroke-width="1"/>`);
  });

  const axisParts = [];
  for (let i = 0; i < axisCount(); i++) {
    const p = valueToPoint(state.max, i);
    axisParts.push(`<line x1="${CX}" y1="${CY}" x2="${p.x}" y2="${p.y}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>`);
  }

  const labelParts = [];
  for (let i = 0; i < axisCount(); i++) {
    const a = angleFor(i);
    const off = labelOffset(i);
    const x = CX + (MAX_R + off) * Math.cos(a);
    const y = CY + (MAX_R + off) * Math.sin(a);
    labelParts.push(
      `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif" font-size="14" font-weight="500" fill="#1d1d1f">${escapeXml(state.names[i])}</text>`
    );
  }

  const scaleParts = [];
  ringValues().forEach((r) => {
    const p = valueToPoint(r, 0);
    scaleParts.push(
      `<text x="${p.x + 8}" y="${p.y + 1}" text-anchor="start" dominant-baseline="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif" font-size="10" font-weight="500" fill="rgba(0,0,0,0.32)">${r}</text>`
    );
  });

  const polyPts = state.values
    .map((v, i) => {
      const p = valueToPoint(v, i);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const dotParts = [];
  for (let i = 0; i < axisCount(); i++) {
    const p = valueToPoint(state.values[i], i);
    dotParts.push(
      `<circle cx="${p.x}" cy="${p.y}" r="5" fill="${state.color}" stroke="white" stroke-width="2"/>`
    );
  }

  const titlePart = title
    ? `<text x="${w / 2}" y="46" text-anchor="middle" font-family="'New York', ui-serif, 'Iowan Old Style', 'Apple Garamond', Georgia, Cambria, 'Times New Roman', Times, serif" font-size="30" font-weight="600" fill="#1d1d1f" letter-spacing="-0.3">${escapeXml(title)}</text>`
    : '';

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${titlePart}
  <g transform="translate(0, ${titleHeight})">
    ${gridParts.join('')}
    ${axisParts.join('')}
    ${scaleParts.join('')}
    <polygon points="${polyPts}" fill="${hexToRgba(state.color, 0.22)}" stroke="${state.color}" stroke-width="2" stroke-linejoin="round"/>
    ${labelParts.join('')}
    ${dotParts.join('')}
  </g>
</svg>`;
}

function downloadPNG() {
  const svgString = buildExportSvg();
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = (img.naturalWidth || 600) * scale;
    canvas.height = (img.naturalHeight || 670) * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      const a = document.createElement('a');
      const safeName =
        (state.title || 'spider-chart').replace(/[^a-z0-9-_ ]/gi, '').trim() ||
        'spider-chart';
      a.href = URL.createObjectURL(pngBlob);
      a.download = `${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('Failed to render chart.');
  };
  img.src = url;
}

function init() {
  load();

  const titleEl = document.querySelector('.chart-title');
  titleEl.textContent = state.title;
  titleEl.addEventListener('input', () => {
    state.title = titleEl.textContent.replace(/\n/g, ' ').trim();
    markEdited();
    save();
    updateActiveTab();
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleEl.blur();
    }
  });
  titleEl.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text.replace(/\n/g, ' '));
  });

  buildSwatches();
  document.querySelector('.values').addEventListener('click', onValuesClick);
  document.getElementById('addAxis').addEventListener('click', addAxis);
  document.getElementById('scaleDec').addEventListener('click', () => setScale(state.max - 1));
  document.getElementById('scaleInc').addEventListener('click', () => setScale(state.max + 1));
  document.getElementById('restore').addEventListener('click', () => {
    const label = (state.title && state.title.trim()) || `Model ${store.active + 1}`;
    if (confirm(`Reset "${label}" to defaults?`)) {
      restoreCurrentSlot();
    }
  });
  document.getElementById('customColor').addEventListener('input', (e) => {
    setColor(e.target.value);
  });
  document.getElementById('download').addEventListener('click', downloadPNG);

  rebuildAll();
  rebuildTabs();
}

init();
