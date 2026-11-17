/* Small dependency-free SVG charts: horizontal bars, columns, and a line with crosshair. */
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

  /** "Nice" upper bound and tick step for an axis. */
  function niceScale(max, ticks = 4) {
    if (max <= 0) return { max: 1, step: 1 };
    const raw = max / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    return { max: Math.ceil(max / step) * step, step };
  }

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
  // Rounded only at the top (data end).
  function colPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
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
        v.textContent = opts.total ? `${d.value} · ${pct(d.value / opts.total)}` : d.value;

        const tip = d.tip || `<div class="t-title">${esc(d.label)}</div><div class="t-sub">${d.value} title${d.value === 1 ? '' : 's'}${opts.total ? ' (' + pct(d.value / opts.total) + ')' : ''}</div>`;
        g.addEventListener('mousemove', (e) => showTip(e, tip));
        g.addEventListener('mouseleave', hideTip);
        if (opts.onClick) {
          g.setAttribute('tabindex', '0');
          g.setAttribute('role', 'button');
          g.setAttribute('aria-label', `${d.label}: ${d.value}. Show trend.`);
          g.addEventListener('click', () => opts.onClick(d.label));
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onClick(d.label); } });
        }
      });
    });
  }

  /** Vertical column chart (histogram). data: [{x, y}] */
  function columns(container, data, opts = {}) {
    if (!data.length) return emptyState(container, 'Nothing to show.');
    responsive(container, (W) => {
      container.innerHTML = '';
      const H = 180, padL = 30, padB = 22, padT = 8;
      const plotW = W - padL - 4, plotH = H - padB - padT;
      const { max, step } = niceScale(Math.max(...data.map((d) => d.y)));
      const svg = el('svg', { width: W, height: H, role: 'img', 'aria-label': opts.ariaLabel || 'Column chart' }, container);
      for (let t = 0; t <= max; t += step) {
        const y = padT + plotH - (t / max) * plotH;
        el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: padL, x2: W - 4, y1: y, y2: y }, svg);
        const lbl = el('text', { class: 'axis', x: padL - 6, y: y + 4, 'text-anchor': 'end' }, svg);
        lbl.textContent = t;
      }
      const slot = plotW / data.length;
      const bw = Math.max(2, Math.min(28, slot - 2));
      const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(plotW / 28)));
      data.forEach((d, i) => {
        const x = padL + i * slot + (slot - bw) / 2;
        const h = (d.y / max) * plotH;
        const g = el('g', { class: 'datum' }, svg);
        const hit = el('rect', { class: 'hit', x: padL + i * slot, y: padT, width: slot, height: plotH, rx: 3 }, g);
        el('path', { class: 'bar', d: colPath(x, padT + plotH - h, bw, h, 4) }, g);
        if (i % labelEvery === 0) {
          const t = el('text', { class: 'axis', x: x + bw / 2, y: H - 6, 'text-anchor': 'middle' }, g);
          t.textContent = d.x;
        }
        const tip = `<div class="t-title">${esc(d.x)} ${esc(opts.xUnit || '')}</div><div class="t-sub">${d.y} title${d.y === 1 ? '' : 's'}</div>`;
        g.addEventListener('mousemove', (e) => showTip(e, tip));
        g.addEventListener('mouseleave', hideTip);
      });
    });
  }

  /** Line chart of share-by-year with crosshair tooltip. points: [{year, share, hits, total}] */
  function trend(container, points, opts = {}) {
    if (points.length < 2) return emptyState(container, opts.emptyMsg || 'Need titles from at least two different years.');
    responsive(container, (W) => {
      container.innerHTML = '';
      const H = 240, padL = 40, padR = 12, padT = 12, padB = 26;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const x0 = points[0].year, x1 = points[points.length - 1].year;
      const { max, step } = niceScale(Math.max(0.05, ...points.map((p) => p.share)));
      const sx = (yr) => padL + (x1 === x0 ? plotW / 2 : ((yr - x0) / (x1 - x0)) * plotW);
      const sy = (v) => padT + plotH - (v / max) * plotH;
      const svg = el('svg', { width: W, height: H, role: 'img', 'aria-label': opts.ariaLabel || 'Trend chart' }, container);

      for (let t = 0; t <= max + 1e-9; t += step) {
        el('line', { class: t === 0 ? 'baseline' : 'gridline', x1: padL, x2: W - padR, y1: sy(t), y2: sy(t) }, svg);
        const lbl = el('text', { class: 'axis', x: padL - 6, y: sy(t) + 4, 'text-anchor': 'end' }, svg);
        lbl.textContent = pct(t, 0);
      }
      const span = x1 - x0;
      const every = Math.max(1, Math.ceil(span / Math.max(1, Math.floor(plotW / 48))));
      for (let yr = x0; yr <= x1; yr += every) {
        const t = el('text', { class: 'axis', x: sx(yr), y: H - 6, 'text-anchor': 'middle' }, svg);
        t.textContent = yr;
      }

      const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.year)},${sy(p.share)}`).join('');
      el('path', { class: 'area', d: `${d}L${sx(x1)},${sy(0)}L${sx(x0)},${sy(0)}Z` }, svg);
      el('path', { class: 'line', d }, svg);

      const cross = el('line', { class: 'crosshair', y1: padT, y2: padT + plotH, visibility: 'hidden' }, svg);
      const dot = el('circle', { class: 'dot', r: 5, visibility: 'hidden' }, svg);
      // Endpoint marker + direct label for the latest value.
      const last = points[points.length - 1];
      el('circle', { class: 'dot', r: 4, cx: sx(last.year), cy: sy(last.share) }, svg);

      const overlay = el('rect', { x: padL, y: padT, width: plotW, height: plotH, fill: 'transparent' }, svg);
      overlay.addEventListener('mousemove', (e) => {
        const bx = e.clientX - svg.getBoundingClientRect().left;
        let best = points[0];
        for (const p of points) if (Math.abs(sx(p.year) - bx) < Math.abs(sx(best.year) - bx)) best = p;
        const cx = sx(best.year), cy = sy(best.share);
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
        showTip(e, `<div class="t-title">${best.yearEnd > best.year ? best.year + '–' + best.yearEnd : best.year}</div><div>${pct(best.share)} of titles</div><div class="t-sub">${best.hits} of ${best.total}</div>`);
      });
      overlay.addEventListener('mouseleave', () => {
        cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip();
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

  window.Charts = { hbar, columns, trend, pct, esc };
})();
