/* Thesis reader: read a thesis link via the local helper (server.py), or analyse pasted text. */
(function () {
  'use strict';
  const A = window.TitleAnalysis;
  const C = window.Charts;
  const $ = (id) => document.getElementById(id);
  const esc = C.esc;
  let current = null; // { meta, analysis }
  let helperOk = null;

  // ------------------------------------------------------------------ helper detection
  const HELPER_MSG =
    'Reading links needs the helper running on your computer. In the project folder run ' +
    '<code>python3 server.py</code>, then open <code>http://localhost:8000</code>. ' +
    'You can still paste a title and abstract below.';

  async function checkHelper() {
    if (location.protocol === 'file:') return false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch('api/health', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      return r.ok && (await r.json()).ok === true;
    } catch { return false; }
  }
  checkHelper().then((ok) => {
    helperOk = ok;
    if (!ok) { $('helperNote').innerHTML = HELPER_MSG; $('helperNote').hidden = false; }
  });

  // ------------------------------------------------------------------ input
  const setStatus = (msg) => { $('thesisStatus').textContent = msg; };

  $('thesisForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = $('thesisUrl').value.trim();
    if (!url) { setStatus('Paste a thesis link or DOI first.'); return; }
    if (helperOk === false) {
      $('helperNote').hidden = false;
      $('manualBox').open = true;
      setStatus('');
      return;
    }
    const btn = $('thesisBtn');
    btn.disabled = true;
    setStatus('Reading the thesis page…');
    try {
      const r = await fetch('api/thesis?url=' + encodeURIComponent(url), { cache: 'no-store' });
      const data = await r.json().catch(() => ({ error: 'The helper sent back something unexpected.' }));
      if (!r.ok || data.error) throw new Error(data.error || `Error ${r.status}`);
      if (!data.title && !data.abstract) {
        throw new Error('No thesis details were found on that page. Check it is the thesis landing page, or paste the abstract below.');
      }
      show(data);
      setStatus(data.abstract ? '' : 'No abstract on that page, so the analysis uses the title and keywords only.');
    } catch (err) {
      setStatus(err.message || String(err));
      $('manualBox').open = true;
    } finally {
      btn.disabled = false;
    }
  });

  $('manBtn').addEventListener('click', () => {
    const title = $('manTitle').value.trim();
    const abstract = $('manAbstract').value.trim();
    if (!title && !abstract) { setStatus('Add a title or an abstract to analyse.'); return; }
    const keywords = $('manKeywords').value.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    setStatus('');
    show({ title, abstract, keywords, subjects: [], authors: [], found: ['pasted text'] });
  });

  // ------------------------------------------------------------------ render
  function show(meta) {
    const analysis = A.analyseThesis(meta);
    current = { meta, analysis };
    $('thesisResult').hidden = false;

    // header
    $('tType').textContent = meta.type && !/^(thesis|text)$/i.test(meta.type) ? meta.type : 'Thesis';
    $('tTitle').textContent = meta.title || 'Untitled';
    $('tByline').textContent = [
      (meta.authors || []).join(', '), meta.year, meta.institution,
    ].filter(Boolean).join(' · ');
    const links = [];
    if (meta.url) links.push(`<a href="${esc(meta.url)}" target="_blank" rel="noopener">Thesis page</a>`);
    if (meta.pdf_url) links.push(`<a href="${esc(meta.pdf_url)}" target="_blank" rel="noopener">PDF</a>`);
    if (meta.doi) links.push(`<a href="https://doi.org/${esc(meta.doi)}" target="_blank" rel="noopener">DOI ${esc(meta.doi)}</a>`);
    $('tLinks').innerHTML = links.join('');

    // topic
    const sf = analysis.subfields;
    C.hbar($('tSubfieldChart'), sf.map((s) => ({
      label: s.label, value: Math.round(s.share * 100),
      tip: `<div class="t-title">${esc(s.label)}</div><div class="t-sub">${Math.round(s.share * 100)}% of matches · ${s.terms.map((t) => esc(t.term)).join(', ')}</div>`,
    })), { ariaLabel: 'Subfield shares', emptyMsg: 'No chemistry subfield keywords found.', format: (v) => v + '%' });
    $('tSubfieldTerms').innerHTML = sf.length
      ? (`<span class="primary-pill">Main subfield: ${esc(analysis.primary)}</span>` +
        sf.slice(0, 4).map((s) => `<div><b>${esc(s.label)}</b>: ${s.terms.slice(0, 6).map((t) => esc(t.term) + (t.count > 1 ? ` ×${t.count}` : '')).join(', ')}</div>`).join(''))
      : '';

    // keywords
    const blocks = [];
    const chipList = (arr, cls = '') => `<div class="chips">${arr.map((k) => `<span class="chip ${cls}">${esc(k)}</span>`).join('')}</div>`;
    if (meta.keywords && meta.keywords.length) blocks.push(['Author keywords', chipList(meta.keywords, 'kw')]);
    if (meta.subjects && meta.subjects.length) blocks.push(['Subject headings', chipList(meta.subjects)]);
    const oa = meta.openalex;
    if (oa && oa.topics && oa.topics.length) {
      blocks.push(['OpenAlex topics', `<div class="chips">${oa.topics.map((t) =>
        `<span class="chip" title="${esc([t.field, t.subfield].filter(Boolean).join(' › '))}">${esc(t.name)}</span>`).join('')}</div>`]);
    }
    if (oa && oa.keywords && oa.keywords.length) blocks.push(['OpenAlex keywords', chipList(oa.keywords)]);
    blocks.push(['Suggested keywords', chipList(suggestedKeywords(meta, analysis), 'kw')]);
    $('tKeywordBlocks').innerHTML = blocks.map(([h, b]) => `<div class="kw-block"><h3>${h}</h3>${b}</div>`).join('');

    // key phrases
    C.hbar($('tPhraseChart'), analysis.keyPhrases.slice(0, 12).map((p) => ({
      label: p.phrase, value: Math.round(p.score * 10) / 10,
      tip: `<div class="t-title">${esc(p.phrase)}</div><div class="t-sub">score ${p.score.toFixed(1)} · appears ${p.count}×</div>`,
    })), { ariaLabel: 'Key phrases', emptyMsg: 'Add an abstract to find key phrases.', format: (v) => v.toFixed(1) });

    // techniques + title facts
    $('tTechniques').innerHTML = analysis.techniques.length
      ? `<div class="term-list">${analysis.techniques.map((t) =>
          `<div><b>${esc(t.label)}</b>: ${t.terms.map((x) => esc(x.term)).join(', ')}</div>`).join('')}</div>`
      : '<p class="hint">No instrumental or computational methods named.</p>';
    const st = analysis.structure;
    $('tTitleFacts').innerHTML = st ? [
      `${st.words} words`, st.hasColon ? 'Has a subtitle' : 'No subtitle', st.isQuestion ? 'Question' : null,
      st.hasFormula ? 'Contains a formula' : null, st.hasAcronym ? 'Contains an acronym' : null,
    ].filter(Boolean).map((f) => `<span class="chip">${esc(f)}</span>`).join('') : '';

    // elements: shown here and lit up on the cover table
    const elements = window.Elements.findElements([meta.title, meta.abstract, (meta.keywords || []).join('; ')].join('. '));
    $('tElements').innerHTML = elements.length
      ? elements.map((x) => {
        const el = window.Elements.BY_SYMBOL[x.symbol];
        return `<button type="button" class="chip el-chip" data-sym="${x.symbol}" title="${esc(x.forms.join(', '))}">` +
          `<b>${x.symbol}</b> ${esc(el.name)}${x.count > 1 ? ` ×${x.count}` : ''}</button>`;
      }).join('')
      : '<span class="hint">No elements named in the title, abstract or keywords.</span>';
    $('tElements').querySelectorAll('[data-sym]').forEach((b) =>
      b.addEventListener('click', () => window.PeriodicTable.show(b.dataset.sym)));
    document.dispatchEvent(new CustomEvent('thesis:analysed', { detail: { elements, title: meta.title } }));

    // abstract
    $('tSummary').textContent = analysis.summary || 'No abstract available.';
    $('tAbstractMeta').textContent = meta.abstract ? `Summary: the abstract's opening sentences. ${analysis.abstractWords} words in total.` : '';
    $('tAbstractBox').hidden = !meta.abstract;
    $('tAbstract').innerHTML = highlight(meta.abstract || '', analysis.keyPhrases.slice(0, 10).map((p) => p.phrase));
    $('tSource').textContent = meta.found && meta.found.length ? `Details read from: ${meta.found.join(', ')}.` : '';

    $('thesisResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Author keywords first, then top key phrases not already covered, de-duplicated. */
  function suggestedKeywords(meta, analysis) {
    const out = [], seen = new Set();
    const add = (k) => {
      const n = k.toLowerCase().replace(/s\b/g, '');
      if (!k || seen.has(n) || [...seen].some((s) => s.includes(n) || n.includes(s))) return;
      seen.add(n); out.push(k);
    };
    (meta.keywords || []).forEach(add);
    analysis.keyPhrases.forEach((p) => add(p.phrase));
    analysis.techniques.forEach((t) => add(t.label));
    return out.slice(0, 10);
  }

  function highlight(text, phrases) {
    let html = esc(text);
    const sorted = [...phrases].sort((a, b) => b.length - a.length);
    if (!sorted.length) return html;
    const re = new RegExp('(' + sorted.map((p) => esc(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\\s]')).join('|') + ')', 'gi');
    return html.replace(re, '<mark>$1</mark>');
  }

  // ------------------------------------------------------------------ actions
  $('copyBtn').addEventListener('click', async () => {
    if (!current) return;
    const { meta, analysis } = current;
    const text = [
      meta.title, [(meta.authors || []).join(', '), meta.year, meta.institution].filter(Boolean).join(' · '),
      meta.url || '', '',
      'Main subfield: ' + (analysis.primary || 'unclassified'),
      'Other subfields: ' + analysis.subfields.slice(1).map((s) => s.label).join(', '),
      'Methods: ' + analysis.techniques.map((t) => t.label).join(', '),
      'Elements: ' + window.Elements.findElements([meta.title, meta.abstract].join('. ')).map((x) => x.symbol).join(', '),
      'Keywords: ' + suggestedKeywords(meta, analysis).join('; '),
      '', 'Summary: ' + analysis.summary,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('copyBtn').textContent = 'Copied';
      setTimeout(() => { $('copyBtn').textContent = 'Copy summary'; }, 1500);
    } catch {
      setStatus('Could not copy to the clipboard here.');
    }
  });
})();
