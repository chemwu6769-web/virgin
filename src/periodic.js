/* Interactive periodic table cover. Listens for "thesis:analysed" to light up mentioned elements. */
(function () {
  'use strict';
  const E = window.Elements;
  const $ = (id) => document.getElementById(id);
  const esc = window.Charts.esc;
  const table = $('ptable');

  const state = {
    mode: 'block',
    selected: 6, // carbon: a sensible opening element for chemists
    query: '',
    mentions: new Map(), // symbol -> {count, forms}
    thesisTitle: '',
    onlyMentioned: false,
  };

  const BLOCK_NAMES = { s: 's-block', p: 'p-block', d: 'd-block', f: 'f-block' };
  const STATE_NAMES = { solid: 'Solid', liquid: 'Liquid', gas: 'Gas', unknown: 'Unknown' };
  // Electronegativity ramp: 13 steps of one hue, light to dark (100..700).
  const EN_STEPS = 13;
  const EN_MIN = 0.7, EN_MAX = 4.0;
  const enStep = (en) => Math.max(0, Math.min(EN_STEPS - 1, Math.round(((en - EN_MIN) / (EN_MAX - EN_MIN)) * (EN_STEPS - 1))));

  // ------------------------------------------------------------------ build grid
  const tiles = new Map();
  for (const el of E.ELEMENTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'el';
    b.style.gridRow = String(el.row > 7 ? el.row + 1 : el.row); // leave row 8 as a spacer
    b.style.gridColumn = String(el.col);
    b.dataset.z = el.z;
    b.innerHTML = `<span class="el-z">${el.z}</span><span class="el-sym">${el.symbol}</span><span class="el-name">${el.name}</span>`;
    b.setAttribute('aria-label', `${el.name}, ${el.symbol}, atomic number ${el.z}`);
    b.addEventListener('click', () => select(el.z));
    table.appendChild(b);
    tiles.set(el.z, b);
  }
  // f-block placeholders in group 3
  [['57–71', 6], ['89–103', 7]].forEach(([label, row]) => {
    const d = document.createElement('div');
    d.className = 'el el-ph';
    d.style.gridRow = String(row);
    d.style.gridColumn = '3';
    d.textContent = label;
    d.setAttribute('aria-hidden', 'true');
    table.appendChild(d);
  });
  // group numbers above the table are omitted to keep the cover clean; the detail panel names the group.

  // ------------------------------------------------------------------ rendering
  function paint() {
    const q = state.query.trim().toLowerCase();
    for (const el of E.ELEMENTS) {
      const t = tiles.get(el.z);
      t.className = 'el';
      t.style.removeProperty('--tile');
      t.style.removeProperty('--tile-fg');
      if (state.mode === 'block') t.classList.add('c-' + el.block);
      else if (state.mode === 'state') t.classList.add('c-' + el.state);
      else if (el.electronegativity == null) t.classList.add('c-none');
      else {
        const step = enStep(el.electronegativity);
        t.classList.add('en');
        t.style.setProperty('--tile', `var(--en-${step})`);
        // first 7 steps are the light end in light mode (dark end in dark mode, where the ramp reverses)
        t.style.setProperty('--tile-fg', step >= 7 ? 'var(--en-fg-light)' : 'var(--en-fg-dark)');
      }
      const matches = !q || el.name.toLowerCase().includes(q) || el.symbol.toLowerCase() === q || String(el.z) === q;
      const mentioned = state.mentions.has(el.symbol);
      if (!matches || (state.onlyMentioned && !mentioned)) t.classList.add('dim');
      if (mentioned) t.classList.add('lit');
      if (el.z === state.selected) t.classList.add('sel');
      t.setAttribute('aria-pressed', String(el.z === state.selected));
    }
    renderLegend();
    renderDetail();
  }

  function renderLegend() {
    let items;
    if (state.mode === 'block') {
      items = Object.entries(BLOCK_NAMES).map(([k, v]) => `<span class="lg"><i class="sw c-${k}"></i>${v}</span>`);
    } else if (state.mode === 'state') {
      items = Object.entries(STATE_NAMES).map(([k, v]) => `<span class="lg"><i class="sw c-${k}"></i>${v}</span>`);
    } else {
      const ramp = Array.from({ length: EN_STEPS }, (_, i) => `<i style="background:var(--en-${i})"></i>`).join('');
      items = [`<span class="lg">${EN_MIN.toFixed(1)}<span class="ramp">${ramp}</span>${EN_MAX.toFixed(1)} Pauling</span>`,
        '<span class="lg"><i class="sw c-none"></i>No value</span>'];
    }
    $('ptLegend').innerHTML = items.join('');
  }

  const sup = (cfg) => esc(cfg).replace(/([spdf])(\d+)/g, '$1<sup>$2</sup>');

  function renderDetail() {
    const el = E.ELEMENTS[state.selected - 1];
    const m = state.mentions.get(el.symbol);
    const where = el.row > 7
      ? `Period ${el.period} · ${el.categoryName === 'Lanthanide' ? 'lanthanide' : 'actinide'} series · f-block`
      : `Group ${el.group} · Period ${el.period} · ${el.block}-block`;
    const flags = [
      el.radioactive ? 'Radioactive' : null,
      el.synthetic ? 'Synthetic' : null,
      el.predicted ? 'Properties largely predicted' : null,
    ].filter(Boolean);
    $('elDetail').innerHTML = `
      <div class="d-tile c-${el.block}"><span class="el-z">${el.z}</span><span class="d-sym">${el.symbol}</span><span class="d-mass">${esc(el.mass)}</span></div>
      <div class="d-body">
        <div class="d-name">${esc(el.name)}</div>
        <div class="d-cat">${esc(el.categoryName)} · ${where}</div>
        <dl class="d-facts">
          <div><dt>Atomic mass</dt><dd>${esc(el.mass)}${el.stableIsotope ? '' : ' <small>(most stable isotope)</small>'}</dd></div>
          <div><dt>Electron configuration</dt><dd>${sup(el.config)}${el.predicted ? ' <small>(predicted)</small>' : ''}</dd></div>
          <div><dt>Electronegativity</dt><dd>${el.electronegativity == null ? '—' : el.electronegativity.toFixed(2)}</dd></div>
          <div><dt>State at 25 °C</dt><dd>${STATE_NAMES[el.state]}</dd></div>
        </dl>
        ${flags.length ? `<div class="d-flags">${flags.map((f) => `<span class="chip">${f}</span>`).join('')}</div>` : ''}
        ${m ? `<div class="d-mention">In this thesis: ${m.forms.map(esc).join(', ')} (${m.count}×)</div>` : ''}
      </div>`;
  }

  function select(z, focus = false) {
    state.selected = z;
    paint();
    if (focus) tiles.get(z).focus();
  }

  // ------------------------------------------------------------------ controls
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    paint();
  }));

  $('ptSearch').addEventListener('input', (e) => {
    state.query = e.target.value;
    const q = state.query.trim().toLowerCase();
    if (q) {
      const hit = E.ELEMENTS.find((el) => el.symbol.toLowerCase() === q || String(el.z) === q) ||
        E.ELEMENTS.find((el) => el.name.toLowerCase().startsWith(q)) ||
        E.ELEMENTS.find((el) => el.name.toLowerCase().includes(q));
      if (hit) state.selected = hit.z;
    }
    paint();
  });

  // Arrow keys move between neighbouring tiles.
  table.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (!moves[e.key]) return;
    e.preventDefault();
    const cur = E.ELEMENTS[state.selected - 1];
    const [dr, dc] = moves[e.key];
    let best = null, bestD = Infinity;
    for (const el of E.ELEMENTS) {
      const r = el.row, c = el.col;
      const along = dr ? (r - cur.row) * dr : (c - cur.col) * dc;
      if (along <= 0) continue;
      const across = dr ? Math.abs(c - cur.col) : Math.abs(r - cur.row);
      const d = along + across * 3;
      if (d < bestD) { bestD = d; best = el; }
    }
    if (best) select(best.z, true);
  });

  // ------------------------------------------------------------------ thesis link-up
  document.addEventListener('thesis:analysed', (e) => {
    const { elements, title } = e.detail;
    state.mentions = new Map(elements.map((x) => [x.symbol, x]));
    state.thesisTitle = title || 'this thesis';
    state.onlyMentioned = false;
    if (elements.length) state.selected = E.BY_SYMBOL[elements[0].symbol].z;
    renderThesisNote();
    paint();
  });

  function renderThesisNote() {
    const note = $('ptThesisNote');
    const n = state.mentions.size;
    if (!n) { note.hidden = false; note.innerHTML = `<span>No elements mentioned in “${esc(state.thesisTitle)}”.</span>`; return; }
    note.hidden = false;
    note.innerHTML = `<span class="lg"><i class="sw lit-sw"></i>${n} element${n === 1 ? '' : 's'} mentioned in “${esc(state.thesisTitle)}”</span>
      <label class="check"><input id="ptOnly" type="checkbox"${state.onlyMentioned ? ' checked' : ''}> Show only these</label>`;
    $('ptOnly').addEventListener('change', (ev) => { state.onlyMentioned = ev.target.checked; paint(); });
  }

  window.PeriodicTable = {
    show(symbol) {
      const el = E.BY_SYMBOL[symbol];
      if (!el) return;
      select(el.z);
      document.querySelector('.cover').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };

  // On narrow screens the table scrolls sideways, so show the details below it instead of in the gap.
  const narrow = matchMedia('(max-width: 820px)');
  function placeDetail() {
    const d = $('elDetail');
    if (narrow.matches) { d.classList.add('below'); $('ptDetailSlot').appendChild(d); }
    else { d.classList.remove('below'); table.prepend(d); }
  }
  narrow.addEventListener('change', placeDetail);
  placeDetail();

  paint();
})();
