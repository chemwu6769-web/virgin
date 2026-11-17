/* Small dependency-free SVG horizontal bar chart with hover tooltips. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const tooltip = () => document.getElementById('tooltip');

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  function showTip(evt, html) {
    const t = tooltip();
    t.innerHTML = html;
    t.hidden = false;
    const pad = 14;
    const { innerWidth: W, innerHeight: H } = window;
    const r = t.getBoundingClientRect();
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + r.width > W - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > H - 8) y = evt.clientY - r.height - pad;
    t.style.left = Math.max(8, x) + 'px';
    t.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = () => { tooltip().hidden = true; };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function emptyState(container, msg) {
    container.innerHTML = `<div class="empty">${esc(msg)}</div>`;
  }

  // Re-render a chart whenever its container width changes.
  const observers = new WeakMap();
  function responsive(container, draw) {
    const run = () => { if (container.clientWidth) draw(container.clientWidth); };
    let ro = observers.get(container);
    if (ro) ro.disconnect();
    let lastW = 0;
    ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      if (Math.abs(w - lastW) > 2) { lastW = w; run(); }
    });
    ro.observe(container);
    observers.set(container, ro);
    lastW = container.clientWidth;
    run();
  }

  // Rounded only at the data end (right side), square at the baseline.
  function hbarPath(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    if (w <= 0) return '';
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  /**
   * Horizontal bar chart.
   * data: [{label, value, tip?}]; opts: {total, onClick(label), activeLabel, emptyMsg}
   */
  function hbar(container, data, opts = {}) {
    if (!data.length || data.every((d) => !d.value)) return emptyState(container, opts.emptyMsg || 'Nothing to show.');
    responsive(container, (W) => {
      container.innerHTML = '';
      const rowH = 26, barH = 16, gap = (rowH - barH) / 2;
      const labelW = W < 480 ? Math.round(W * 0.47) : Math.min(Math.max(90, W * 0.38), 210);
      const valueW = 64;
      const plotW = Math.max(40, W - labelW - valueW - 8);
      const max = Math.max(...data.map((d) => d.value));
      const H = data.length * rowH + 4;
      const svg = el('svg', { width: W, height: H, role: 'img', 'aria-label': opts.ariaLabel || 'Bar chart' }, container);
      el('line', { class: 'baseline', x1: labelW, x2: labelW, y1: 0, y2: H }, svg);

      data.forEach((d, i) => {
        const y = i * rowH;
        const g = el('g', { class: 'datum' + (opts.activeLabel === d.label ? ' active' : '') }, svg);
        const hit = el('rect', { class: 'hit' + (opts.onClick ? ' clickable' : ''), x: 0, y, width: W, height: rowH, rx: 4 }, g);
        const label = el('text', { x: labelW - 8, y: y + rowH / 2 + 4, 'text-anchor': 'end' }, g);
        label.textContent = truncate(d.label, labelW - 10);
        const w = max ? (d.value / max) * plotW : 0;
        el('path', { class: 'bar', d: hbarPath(labelW, y + gap, w, barH, 4) }, g);
        const v = el('text', { class: 'value', x: labelW + w + 6, y: y + rowH / 2 + 4 }, g);
        v.textContent = opts.format ? opts.format(d.value) : opts.total ? `${d.value} · ${pct(d.value / opts.total)}` : d.value;

        const tip = d.tip || `<div class="t-title">${esc(d.label)}</div><div class="t-sub">${d.value} title${d.value === 1 ? '' : 's'}${opts.total ? ' (' + pct(d.value / opts.total) + ')' : ''}</div>`;
        g.addEventListener('mousemove', (e) => showTip(e, tip));
        g.addEventListener('mouseleave', hideTip);
        if (opts.onClick) {
          g.setAttribute('tabindex', '0');
          g.setAttribute('role', 'button');
          g.setAttribute('aria-label', `${d.label}: ${d.value}.`);
          g.addEventListener('click', () => opts.onClick(d.label));
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(d.label); } });
        }
      });
    });
  }

  function pct(v, digits = 0) {
    return (v * 100).toFixed(digits) + '%';
  }

  // Cheap width-based truncation (≈6.6px per char at 12px system-ui).
  function truncate(s, px) {
    const maxChars = Math.floor(px / 6.6);
    return s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
  }

  window.Charts = { hbar, pct, esc };
})();
