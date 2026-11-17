(function () {
  'use strict';
  const A = window.TitleAnalysis;
  const C = window.Charts;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'thesis-title-lab:input';

  const state = {
    result: null,
    termMode: 'terms',
    trend: { kind: 'subfield', value: null }, // kind: subfield | technique | keyword
    sort: { key: null, dir: 1 },
  };

  // ---------------------------------------------------------------- storage (best effort)
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  // ---------------------------------------------------------------- theme toggle
  (function initTheme() {
    const saved = store.get('thesis-title-lab:theme');
    if (saved) document.documentElement.dataset.theme = saved;
    $('themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      store.set('thesis-title-lab:theme', next);
    });
  })();

  // ---------------------------------------------------------------- input
  function setStatus(msg) { $('status').textContent = msg; }

  function run() {
    const text = $('input').value;
    const records = A.parseInput(text);
    if (!records.length) {
      setStatus('No titles found. Paste some titles or load the sample data.');
      $('results').hidden = true;
      return;
    }
    store.set(STORE_KEY, text);
    state.result = A.analyse(records, { dropFiller: $('fillerToggle').checked });
    const s = state.result.summary;
    setStatus(`Analysed ${s.count} title${s.count === 1 ? '' : 's'}` +
      (s.withYear ? `, ${s.withYear} with a year (${s.yearMin}–${s.yearMax}).` : ' (no years found, so the trend chart is off).'));
    $('results').hidden = false;
    if (!state.trend.value) state.trend = { kind: 'subfield', value: state.result.subfields[0][0] };
    renderAll();
  }

  $('analyseBtn').addEventListener('click', run);
  $('fillerToggle').addEventListener('change', () => state.result && run());
  $('sampleBtn').addEventListener('click', () => { $('input').value = window.SAMPLE_CSV; run(); });
  $('clearBtn').addEventListener('click', () => {
    $('input').value = ''; store.set(STORE_KEY, ''); $('results').hidden = true; setStatus(''); state.result = null;
  });
  $('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
  $('fileInput').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('input').value = await f.text();
    e.target.value = '';
    run();
  });

  // ---------------------------------------------------------------- rendering
  function renderAll() {
    renderTiles();
    renderSubfields();
    renderTechniques();
    renderTerms();
    renderLength();
    renderTrendControls();
    renderTrend();
    renderTableControls();
    renderTable();
  }

  function renderTiles() {
    const s = state.result.summary;
    const tiles = [
      ['Titles', s.count, s.withYear ? `${s.yearMin}–${s.yearMax}` : 'no years given'],
      ['Median length', `${s.medianWords} words`, `mean ${s.meanWords.toFixed(1)}`],
      ['With a subtitle', C.pct(s.colonShare), 'colon or dash split'],
      ['Phrased as a question', C.pct(s.questionShare), ''],
      ['Contain an acronym', C.pct(s.acronymShare), 'e.g. NMR, DFT, MOF'],
      ['Contain a formula', C.pct(s.formulaShare), 'e.g. CO2, Fe3O4'],
    ];
    $('tiles').innerHTML = tiles.map(([l, v, n]) =>
      `<div class="tile"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n || '&nbsp;'}</div></div>`).join('');
  }

  function renderSubfields() {
    const { subfields, summary } = state.result;
    $('unclassifiedNote').textContent = summary.unclassified
      ? `${summary.unclassified} title${summary.unclassified === 1 ? '' : 's'} matched none.` : '';
    C.hbar($('subfieldChart'), subfields.map(([label, value]) => ({ label, value })), {
      total: summary.count, ariaLabel: 'Titles per subfield',
      activeLabel: state.trend.kind === 'subfield' ? state.trend.value : null,
      onClick: (label) => focusTrend('subfield', label),
    });
  }

  function renderTechniques() {
    const { techniques, summary } = state.result;
    C.hbar($('techniqueChart'), techniques.map(([label, value]) => ({ label, value })), {
      total: summary.count, ariaLabel: 'Titles per technique', emptyMsg: 'No techniques named in these titles.',
      activeLabel: state.trend.kind === 'technique' ? state.trend.value : null,
      onClick: (label) => focusTrend('technique', label),
    });
  }

  function renderTerms() {
    const list = state.result[state.termMode].slice(0, 15);
    document.querySelectorAll('[data-terms]').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.terms === state.termMode)));
    C.hbar($('termChart'), list.map(([label, value]) => ({ label, value })), {
      total: state.result.summary.count, ariaLabel: 'Most common terms',
      emptyMsg: state.termMode === 'bigrams' ? 'No phrase appears in more than one title.' : 'No terms found.',
      activeLabel: state.trend.kind === 'keyword' ? state.trend.value : null,
      onClick: (label) => focusTrend('keyword', label),
    });
  }
  document.querySelectorAll('[data-terms]').forEach((b) =>
    b.addEventListener('click', () => { state.termMode = b.dataset.terms; renderTerms(); }));

  function renderLength() {
    C.columns($('lengthChart'), state.result.lengthHistogram.map(([x, y]) => ({ x, y })), {
      xUnit: 'words', ariaLabel: 'Title length distribution',
    });
    const o = state.result.openings;
    $('openings').innerHTML = o.length
      ? o.map(([p, c]) => `<span class="chip">${C.esc(cap(p))}…<b>${c}</b></span>`).join('')
      : '<span class="hint">No opening phrase is shared by more than one title.</span>';
  }

  // ---------------------------------------------------------------- trend
  function renderTrendControls() {
    const sel = $('trendSelect');
    const opt = (kind, label) =>
      `<option value="${kind}|${C.esc(label)}">${C.esc(label)}</option>`;
    sel.innerHTML =
      `<optgroup label="Subfields">${state.result.subfields.map(([l]) => opt('subfield', l)).join('')}</optgroup>` +
      `<optgroup label="Techniques">${Object.keys(A.TECHNIQUES).map((l) => opt('technique', l)).join('')}</optgroup>` +
      `<optgroup label="Structure"><option value="structure|subtitle">Has a subtitle</option><option value="structure|question">Phrased as a question</option></optgroup>` +
      `<option value="keyword|" disabled>Keyword</option>`;
    if (state.trend.kind !== 'keyword') { sel.value = `${state.trend.kind}|${state.trend.value}`; $('trendKeyword').value = ''; }
    else { sel.value = 'keyword|'; $('trendKeyword').value = state.trend.value; }
  }

  $('trendSelect').addEventListener('change', (e) => {
    const [kind, ...rest] = e.target.value.split('|');
    focusTrend(kind, rest.join('|'), false);
  });
  $('trendBin').addEventListener('change', () => state.result && renderTrend());
  let kwTimer;
  $('trendKeyword').addEventListener('input', (e) => {
    clearTimeout(kwTimer);
    kwTimer = setTimeout(() => {
      const v = e.target.value.trim();
      if (v) focusTrend('keyword', v, false);
    }, 200);
  });

  function predicateFor({ kind, value }) {
    if (kind === 'subfield') return (r) => r.subfields.includes(value);
    if (kind === 'technique') return (r) => r.techniques.includes(value);
    if (kind === 'structure') return value === 'question' ? (r) => r.structure.isQuestion : (r) => r.structure.hasColon;
    return A.keywordPredicate(value);
  }

  function focusTrend(kind, value, scroll = true) {
    state.trend = { kind, value };
    renderSubfields(); renderTechniques(); renderTerms();
    renderTrendControls();
    renderTrend();
    if (scroll) $('trendChart').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderTrend() {
    const { records, summary } = state.result;
    const t = state.trend;
    const label = t.kind === 'keyword' ? `“${t.value}”`
      : t.kind === 'structure' ? (t.value === 'question' ? 'question titles' : 'titles with a subtitle') : t.value;
    const pts = A.trendByYear(records, predicateFor(t), +$('trendBin').value);
    const hits = pts.reduce((a, p) => a + p.hits, 0);
    $('trendHint').textContent = summary.withYear
      ? `Share of titles matching ${label}, by ${$('trendBin').value === '1' ? 'year' : $('trendBin').value + '-year group'}: ${hits} title${hits === 1 ? '' : 's'} in total.`
      : 'Add a year to each title to see trends.';
    C.trend($('trendChart'), pts, {
      ariaLabel: `Share of titles matching ${label} by year`,
      emptyMsg: summary.withYear ? 'Need titles from at least two different years.' : 'No years in the data.',
    });
  }

  // ---------------------------------------------------------------- table
  function renderTableControls() {
    const sel = $('tableSubfield');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All subfields</option>' +
      state.result.subfields.filter(([, c]) => c).map(([l]) => `<option>${C.esc(l)}</option>`).join('') +
      '<option value="__none">Unclassified</option>';
    sel.value = [...sel.options].some((o) => o.value === cur) ? cur : '';
  }

  function renderTable() {
    const q = $('tableSearch').value.trim();
    const sub = $('tableSubfield').value;
    const pred = q ? A.keywordPredicate(q) : () => true;
    let rows = state.result.records.filter((r) =>
      pred(r) && (!sub || (sub === '__none' ? !r.subfields.length : r.subfields.includes(sub))));
    const { key, dir } = state.sort;
    if (key) {
      const val = (r) => key === 'words' ? r.structure.words : r[key];
      rows = [...rows].sort((a, b) => {
        const x = val(a), y = val(b);
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
      });
    }
    $('tableCount').textContent = `Showing ${rows.length} of ${state.result.records.length}.`;
    const hl = (s) => {
      const e = C.esc(s);
      if (!q) return e;
      const re = new RegExp('(' + C.esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return e.replace(re, '<mark>$1</mark>');
    };
    $('titleTable').querySelector('tbody').innerHTML = rows.map((r) => `
      <tr>
        <td>${hl(r.title)}</td>
        <td class="num">${r.year ?? '—'}</td>
        <td class="num">${r.structure.words}</td>
        <td><div class="chips">${r.subfields.map((s) => `<span class="chip">${C.esc(s)}</span>`).join('')}${r.techniques.map((s) => `<span class="chip tech">${C.esc(s)}</span>`).join('')}</div></td>
      </tr>`).join('');
    document.querySelectorAll('#titleTable th[data-sort]').forEach((th) => {
      th.setAttribute('aria-sort', th.dataset.sort === key ? (dir > 0 ? 'ascending' : 'descending') : 'none');
    });
  }

  $('tableSearch').addEventListener('input', () => state.result && renderTable());
  $('tableSubfield').addEventListener('change', () => state.result && renderTable());
  document.querySelectorAll('#titleTable th[data-sort]').forEach((th) => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    state.sort = state.sort.key === k ? { key: k, dir: -state.sort.dir } : { key: k, dir: k === 'title' ? 1 : -1 };
    renderTable();
  }));

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([A.toCSV(state.result.records)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'thesis-titles-analysed.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------------------------------------------------------- boot
  const saved = store.get(STORE_KEY);
  if (saved) { $('input').value = saved; run(); }
})();
