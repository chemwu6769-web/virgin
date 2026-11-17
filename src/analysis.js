/*
 * Chemistry dissertation title analysis — pure functions, no DOM.
 * Works in the browser (window.TitleAnalysis) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TitleAnalysis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- lexicons
  // Each entry: label -> list of regex sources matched against the lowercased,
  // dash-normalised title. Titles can match several categories.
  const SUBFIELDS = {
    'Organic synthesis': [
      'total synthesis', 'asymmetric', 'enantioselective', 'stereoselective', 'diastereoselective',
      'organocatal', 'natural products?', 'heterocycl', 'alkaloid', 'cross-coupling',
      'c-h (?:bond )?(?:activation|functionali[sz]ation)', 'alken', 'alkyn', '\\baryl', 'amination',
      'cycloaddition', 'metathesis', 'photoredox', 'synthetic methodolog', 'organic synthesis',
      'chiral', 'radical', 'ketone', 'aldehyde', 'amide', 'ester', 'organic reactions?',
      'flow chemistry', 'bond formation',
    ],
    'Inorganic & organometallic': [
      'transition[- ]metal', 'coordination', 'ligand', 'complexes', 'lanthanide', 'actinide',
      'organometallic', 'main[- ]group', 'bioinorganic', 'ruthenium', 'iridium', 'rhodium',
      'platinum', 'palladium', 'gold\\(', 'copper', 'iron', 'cobalt', 'nickel', 'manganese',
      'uranium', 'frustrated lewis', 'boron', 'metal complex', 'clusters?\\b',
    ],
    'Physical chemistry': [
      'spectroscop', 'kinetic', 'ultrafast', 'photophysic', 'thermodynamic', 'surface science',
      'femtosecond', 'excited[- ]state', 'single[- ]molecule', 'reaction dynamics', 'laser',
      'vibrational', 'photochemi', 'interfac', 'solvation',
    ],
    'Analytical chemistry': [
      'mass spectrometr', 'chromatograph', 'sensors?\\b', 'sensing', 'detection', 'assays?\\b',
      'quantification', 'electrophoresis', 'analytical', 'determination of', 'trace',
      'biosensor', 'imaging', 'microfluidic', 'metabolomic', 'proteomic',
    ],
    'Materials & nanochemistry': [
      'nanopartic', 'nanomaterial', 'nanostructur', 'nanocrystal', 'nanosheet', 'nanowire',
      'metal[- ]organic framework', '\\bmofs?\\b', 'covalent organic framework', '\\bcofs?\\b',
      'perovskite', 'thin films?', '\\b2d\\b', 'two[- ]dimensional', 'graphene', 'zeolite', 'porous',
      'crystal engineering', 'quantum dots?', 'semiconduct', 'materials?\\b', 'oxide',
    ],
    'Polymer & supramolecular': [
      'polymer', 'copolymer', 'macromolec', 'hydrogel', 'dendrimer', 'supramolecular',
      'self[- ]assembl', 'host[- ]guest', 'cage', 'macrocycl', 'rotaxane', 'catenane',
    ],
    'Chemical biology & medicinal': [
      'protein', 'enzym', 'peptide', '\\bdna\\b', '\\brna\\b', 'nucleic', 'biolog', '\\bcells?\\b',
      'drug', 'medicinal', 'inhibitor', 'antibacterial', 'antimicrobial', 'antibiotic', 'cancer',
      'glyco', 'carbohydrate', 'lipid', 'therapeut', 'bioactive', 'membrane', 'probes?\\b',
    ],
    'Computational, theory & data': [
      'density functional', '\\bdft\\b', 'computational', 'theoretical', 'ab initio',
      'molecular dynamics', 'simulation', 'machine learning', 'modell?ing', 'quantum chemi',
      'first[- ]principles', 'in silico', 'neural network', 'electronic structure',
      'data-driven', 'automat', 'autonomous', 'self-driving', 'language models?', 'generative',
      'bayesian', 'high-throughput', 'retrosynthe', 'deep learning', 'quantum comput',
    ],
    'Electrochemistry & energy': [
      'electrochem', 'electrocatal', 'batter(?:y|ies)', 'lithium', 'sodium[- ]ion', 'fuel cells?',
      'solar', 'photovoltaic', 'water splitting', 'hydrogen evolution', 'oxygen (?:reduction|evolution)',
      'co2 (?:reduction|conversion)', 'supercapacitor', 'electrolyte', 'photoelectro', 'energy storage',
      'electrode',
    ],
    'Environmental & green': [
      'environment', 'pollutant', 'atmospher', 'aerosol', 'water treatment', 'remediation',
      'green chemistry', 'sustainab', 'biomass', 'waste', 'microplastic', 'carbon capture', 'soil',
      'renewable', 'recycl', 'contaminant',
    ],
  };

  const TECHNIQUES = {
    'NMR': ['\\bnmr\\b', 'nuclear magnetic resonance'],
    'Mass spectrometry': ['mass spectrometr', '\\bmaldi', '\\besi-ms', '\\blc-ms', '\\bgc-ms'],
    'X-ray / diffraction': ['x-ray', 'crystallograph', '\\bxrd\\b', 'diffraction', 'crystal structures?'],
    'DFT / quantum chemistry': ['density functional', '\\bdft\\b', 'ab initio', 'quantum chemi', 'first[- ]principles'],
    'Molecular dynamics': ['molecular dynamics', '\\bmd simulation'],
    'Vibrational (IR / Raman)': ['infrared', '\\bir\\b', 'raman', '\\bftir\\b', 'vibrational'],
    'UV-vis / fluorescence': ['uv-vis', 'ultraviolet', 'fluoresc', 'luminesc', 'absorption spectroscop'],
    'EPR': ['\\bepr\\b', 'electron paramagnetic', '\\besr\\b'],
    'Electron microscopy': ['electron microscop', '\\btem\\b', '\\bsem\\b', 'cryo-em'],
    'Chromatography': ['chromatograph', '\\bhplc\\b'],
    'Electrochemical methods': ['voltammetr', 'impedance', 'electrochemical'],
    'Ultrafast / laser': ['ultrafast', 'femtosecond', 'picosecond', 'laser', 'pump-probe', 'transient absorption'],
    'Machine learning': ['machine learning', 'neural network', 'deep learning', 'data-driven'],
  };

  const STOPWORDS = new Set((
    'a an and are as at be by for from has have in into is it its of on or that the their this to ' +
    'was were which with within without via using use towards toward through under upon over between ' +
    'among both but can do does than then these those such not no non its de der des la le et'
  ).split(' '));

  // Words that appear in almost every dissertation title and say little about topic.
  const FILLER = new Set((
    'study studies investigation investigations investigating towards toward novel new development ' +
    'developing design designing application applications approach approaches based role ' +
    'understanding exploring exploration analysis characterisation characterization characterizing ' +
    'synthesis synthesising synthesizing synthetic properties property effect effects aspects ' +
    'thesis dissertation part chemistry chemical systems system some various'
  ).split(' '));

  const compile = (lex) =>
    Object.fromEntries(Object.entries(lex).map(([k, pats]) => [k, new RegExp(pats.join('|'), 'i')]));
  const SUBFIELD_RE = compile(SUBFIELDS);
  const TECHNIQUE_RE = compile(TECHNIQUES);

  // ---------------------------------------------------------------- helpers
  /** Normalise unicode dashes and whitespace so lexicon regexes stay simple. */
  function normalise(title) {
    return String(title)
      .replace(/[‐-―−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Lowercased word tokens; keeps internal hyphens and digits (e.g. "metal-organic", "co2"). */
  function tokenize(title) {
    return (normalise(title).toLowerCase().match(/[a-z0-9À-ɏ]+(?:[-'][a-z0-9À-ɏ]+)*/g) || []);
  }

  function contentTokens(title, { dropFiller = true } = {}) {
    return tokenize(title).filter(
      (t) => t.length > 1 && !STOPWORDS.has(t) && !(dropFiller && FILLER.has(t)) && !/^\d+$/.test(t)
    );
  }

  function matchLexicon(text, compiled) {
    const lower = normalise(text).toLowerCase();
    return Object.keys(compiled).filter((k) => compiled[k].test(lower));
  }

  const classify = (title) => matchLexicon(title, SUBFIELD_RE);
  const techniques = (title) => matchLexicon(title, TECHNIQUE_RE);

  function countBy(items) {
    const m = new Map();
    for (const it of items) m.set(it, (m.get(it) || 0) + 1);
    return m;
  }
  const sortedEntries = (m, limit = Infinity) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);

  function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  // ---------------------------------------------------------------- parsing
  /** Minimal RFC-4180 CSV/TSV parser (quoted fields, escaped quotes, CRLF). */
  function parseDelimited(text, delim) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"' && field === '') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((f) => f.trim() !== ''));
  }

  const YEAR_RE = /^(19|20)\d{2}$/;

  /**
   * Parse user input into [{title, year|null, extra}].
   * Accepts: CSV/TSV with a header containing "title" (and optionally "year"),
   * or plain text — one title per line, optionally prefixed/suffixed with a year
   * separated by tab, comma, semicolon or "|".
   */
  function parseInput(text) {
    text = String(text || '').replace(/^﻿/, '');
    const firstLine = (text.split(/\r?\n/).find((l) => l.trim()) || '');
    const delim = firstLine.includes('\t') ? '\t' : ',';
    const headerCells = parseDelimited(firstLine, delim)[0] || [];
    const lowerHeader = headerCells.map((h) => h.trim().toLowerCase());
    const titleIdx = lowerHeader.findIndex((h) => /^(title|thesis title|dissertation title|headline)$/.test(h));

    if (titleIdx !== -1) {
      const yearIdx = lowerHeader.findIndex((h) => /^(year|date|published|award(ed)? year)$/.test(h));
      const rows = parseDelimited(text, delim).slice(1);
      return rows
        .map((r) => {
          const extra = {};
          lowerHeader.forEach((h, i) => { if (i !== titleIdx && i !== yearIdx && h) extra[headerCells[i].trim()] = (r[i] || '').trim(); });
          return { title: normalise(r[titleIdx] || ''), year: yearIdx === -1 ? null : extractYear(r[yearIdx]), extra };
        })
        .filter((r) => r.title);
    }

    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        let m = line.match(/^((?:19|20)\d{2})\s*[\t,;|]\s*(.+)$/);
        if (m) return { title: normalise(stripQuotes(m[2])), year: +m[1], extra: {} };
        m = line.match(/^(.+?)\s*[\t,;|]\s*((?:19|20)\d{2})$/);
        if (m) return { title: normalise(stripQuotes(m[1])), year: +m[2], extra: {} };
        return { title: normalise(stripQuotes(line)), year: null, extra: {} };
      })
      .filter((r) => r.title);
  }

  function stripQuotes(s) {
    return s.replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
  }

  function extractYear(v) {
    const m = String(v || '').match(/\b(19|20)\d{2}\b/);
    return m ? +m[0] : null;
  }

  // ---------------------------------------------------------------- analysis
  function ngrams(tokens, n) {
    const out = [];
    for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(' '));
    return out;
  }

  /** Bigrams over content words, but never spanning a colon/sub-title break. */
  function titleBigrams(title, opts) {
    return normalise(title)
      .split(/[:;?!.()[\]]/)
      .flatMap((seg) => ngrams(contentTokens(seg, opts), 2));
  }

  function openingPhrase(title) {
    const toks = tokenize(title);
    while (toks.length && /^(a|an|the|on|some)$/.test(toks[0])) toks.shift();
    return toks.slice(0, 2).join(' ');
  }

  function structure(title) {
    const t = normalise(title);
    return {
      words: tokenize(t).length,
      chars: t.length,
      hasColon: /:/.test(t) || /\s[-–—]\s/.test(t),
      isQuestion: /\?/.test(t),
      // e.g. CO2, Fe3O4, H2O, Ni(II) — uppercase element symbol followed by digit or oxidation state
      hasFormula: /\b(?:[A-Z][a-z]?\d*)*[A-Z][a-z]?\d+(?:[A-Z][a-z]?\d*)*\b|\b[A-Z][a-z]?\((?:I{1,3}|IV|V|VI)\)/.test(t),
      hasAcronym: /\b[A-Z]{2,}[a-z]?s?\b/.test(t.replace(/^[A-Z\s\W]+$/, '')),
    };
  }

  /**
   * Run every analysis over parsed records.
   * @param {{title:string, year:number|null}[]} records
   * @param {{dropFiller?: boolean, topN?: number}} opts
   */
  function analyse(records, opts = {}) {
    const { dropFiller = true, topN = 25 } = opts;
    const enriched = records.map((r, i) => ({
      id: i,
      ...r,
      subfields: classify(r.title),
      techniques: techniques(r.title),
      structure: structure(r.title),
      opening: openingPhrase(r.title),
    }));

    const n = enriched.length;
    const words = enriched.map((r) => r.structure.words);
    const years = enriched.map((r) => r.year).filter((y) => y != null);
    const share = (pred) => (n ? enriched.filter(pred).length / n : 0);

    const subfieldCounts = countBy(enriched.flatMap((r) => r.subfields));
    const unclassified = enriched.filter((r) => !r.subfields.length).length;

    const lengthHist = countBy(words);
    const maxLen = Math.max(0, ...words);
    const minLen = Math.min(maxLen, ...words);

    return {
      records: enriched,
      summary: {
        count: n,
        meanWords: n ? words.reduce((a, b) => a + b, 0) / n : 0,
        medianWords: median(words),
        colonShare: share((r) => r.structure.hasColon),
        questionShare: share((r) => r.structure.isQuestion),
        formulaShare: share((r) => r.structure.hasFormula),
        acronymShare: share((r) => r.structure.hasAcronym),
        withYear: years.length,
        yearMin: years.length ? Math.min(...years) : null,
        yearMax: years.length ? Math.max(...years) : null,
        unclassified,
      },
      subfields: Object.keys(SUBFIELDS)
        .map((k) => [k, subfieldCounts.get(k) || 0])
        .sort((a, b) => b[1] - a[1]),
      techniques: sortedEntries(countBy(enriched.flatMap((r) => r.techniques))),
      terms: sortedEntries(countBy(enriched.flatMap((r) => [...new Set(contentTokens(r.title, { dropFiller }))])), topN),
      bigrams: sortedEntries(countBy(enriched.flatMap((r) => [...new Set(titleBigrams(r.title, { dropFiller }))]))
        , topN).filter(([, c]) => c > 1),
      openings: sortedEntries(countBy(enriched.map((r) => r.opening).filter(Boolean)), 15).filter(([, c]) => c > 1),
      lengthHistogram: Array.from({ length: n ? maxLen - minLen + 1 : 0 }, (_, i) => [minLen + i, lengthHist.get(minLen + i) || 0]),
    };
  }

  /**
   * Share of titles per year (or per bin of `binSize` years) matching a predicate.
   * `year` is the first year of the bin, `yearEnd` the last.
   * @returns {{year:number, yearEnd:number, total:number, hits:number, share:number}[]}
   */
  function trendByYear(records, predicate, binSize = 1) {
    const byYear = new Map();
    const years = records.map((r) => r.year).filter((y) => y != null);
    const minYear = years.length ? Math.min(...years) : 0;
    const maxYear = years.length ? Math.max(...years) : 0;
    for (const r of records) {
      if (r.year == null) continue;
      const start = minYear + Math.floor((r.year - minYear) / binSize) * binSize;
      const e = byYear.get(start) || { year: start, yearEnd: Math.min(start + binSize - 1, maxYear), total: 0, hits: 0 };
      e.total++;
      if (predicate(r)) e.hits++;
      byYear.set(start, e);
    }
    return [...byYear.values()]
      .sort((a, b) => a.year - b.year)
      .map((e) => ({ ...e, share: e.total ? e.hits / e.total : 0 }));
  }

  /** Build a case-insensitive predicate for a free-text keyword (whole-word prefix match). */
  function keywordPredicate(keyword) {
    const k = normalise(keyword).toLowerCase();
    if (!k) return () => false;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[^a-z0-9])' + esc, 'i');
    return (r) => re.test(normalise(r.title).toLowerCase());
  }

  function toCSV(records) {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = ['title', 'year', 'words', 'subfields', 'techniques', 'has_subtitle', 'is_question'];
    const lines = records.map((r) =>
      [r.title, r.year, r.structure.words, r.subfields.join('; '), r.techniques.join('; '),
        r.structure.hasColon, r.structure.isQuestion].map(esc).join(',')
    );
    return [head.join(','), ...lines].join('\n');
  }

  return {
    SUBFIELDS, TECHNIQUES,
    normalise, tokenize, contentTokens, classify, techniques, structure, openingPhrase,
    parseInput, parseDelimited, analyse, trendByYear, keywordPredicate, toCSV, median,
  };
});
