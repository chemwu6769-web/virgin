/*
 * Chemistry thesis analysis — pure functions, no DOM.
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
      'uranium', 'zirconium', 'titanium', 'vanadium', 'chromium', 'zinc', 'silver', 'molybdenum',
      'tungsten', 'osmium', 'frustrated lewis', 'boron', 'metal complex', 'clusters?\\b',
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

  function matchLexicon(text, compiled) {
    const lower = normalise(text).toLowerCase();
    return Object.keys(compiled).filter((k) => compiled[k].test(lower));
  }

  const classify = (title) => matchLexicon(title, SUBFIELD_RE);
  const techniques = (title) => matchLexicon(title, TECHNIQUE_RE);

  const sortedEntries = (m, limit = Infinity) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);


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

  // ---------------------------------------------------------------- single-thesis analysis
  /** For each category, the distinct terms in `text` that triggered it, most frequent first. */
  function explainMatches(text, compiled) {
    const lower = normalise(text).toLowerCase();
    const out = [];
    for (const [label, re] of Object.entries(compiled)) {
      const g = new RegExp(re.source, 'gi');
      const hits = new Map();
      for (const m of lower.matchAll(g)) {
        // widen the match to the whole word(s) it sits in, e.g. "nanopartic" -> "nanoparticles"
        const s = lower.lastIndexOf(' ', m.index) + 1;
        let e = lower.indexOf(' ', m.index + m[0].length);
        if (e === -1) e = lower.length;
        const term = lower.slice(s, e).replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
        if (term) hits.set(term, (hits.get(term) || 0) + 1);
      }
      if (hits.size) {
        const terms = sortedEntries(hits).map(([t, c]) => ({ term: t, count: c }));
        out.push({ label, score: terms.reduce((a, t) => a + t.count, 0), terms });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  // Extra stopwords for running prose (abstracts), on top of STOPWORDS.
  const PROSE_STOP = new Set((
    'we our us i my here herein this these those it its they them their there been being also however thus ' +
    'therefore hence which who whom whose what when where while whereas both each either all any most more ' +
    'less much many several such only very well further first second third one two three four five six ' +
    'show shows shown showed demonstrate demonstrates demonstrated found find report reports reported ' +
    'present presents presented describe describes described discuss discussed investigate investigated ' +
    'obtained obtain observed observe used uses employ employed allow allows allowed provide provides provided ' +
    'leading lead leads result results resulting resulted due order whether will would could should may might ' +
    'can cannot must has have had having do does did done make made making give gives given high highly low ' +
    'new novel different various important significant significantly potential possible key main large small ' +
    'work chapter chapters thesis dissertation project part approach approaches method methods study studies ' +
    'investigation research et al e g ie eg via within without upon across along after before during against ' +
    'about above below then than so if into onto out up down off over under again once same other another ' +
    'own because as until per towards toward based including include includes particular particularly ' +
    'respectively finally overall addition additionally furthermore moreover generally typically'
  ).split(' '));

  /**
   * RAKE-style key phrase extraction: candidate phrases are runs of content
   * words between stopwords/punctuation; word score = degree / frequency;
   * phrase score = sum of word scores, boosted by repetition.
   */
  function keyPhrases(text, { limit = 15, maxWords = 4 } = {}) {
    const isStop = (w) => STOPWORDS.has(w) || PROSE_STOP.has(w) || /^\d+(\.\d+)?$/.test(w) || w.length < 2;
    const phrases = [];
    const prepped = normalise(text).toLowerCase().replace(/\b(in|ex) (situ|vivo|vitro|silico|operando)\b/g, '$1-$2');
    for (const chunk of prepped.split(/[.,;:!?()[\]{}"“”‘’–—]|\s-\s|\s'|'\s/)) {
      let cur = [];
      for (const w of chunk.match(/[a-z0-9À-ɏ]+(?:[-'][a-z0-9À-ɏ]+)*/g) || []) {
        if (isStop(w)) { if (cur.length) phrases.push(cur); cur = []; }
        else cur.push(w);
      }
      if (cur.length) phrases.push(cur);
    }
    const cands = phrases.filter((p) => p.length <= maxWords);
    const freq = new Map(), deg = new Map();
    for (const p of cands) for (const w of p) {
      freq.set(w, (freq.get(w) || 0) + 1);
      deg.set(w, (deg.get(w) || 0) + p.length);
    }
    const score = new Map(), count = new Map();
    for (const p of cands) {
      const key = p.join(' ');
      count.set(key, (count.get(key) || 0) + 1);
      score.set(key, p.reduce((a, w) => a + deg.get(w) / freq.get(w), 0));
    }
    return [...score.entries()]
      .map(([phrase, s]) => ({ phrase, count: count.get(phrase), score: s * (1 + Math.log(count.get(phrase))) }))
      // single generic words are weak keywords unless repeated
      .filter((p) => p.phrase.includes(' ') || p.count > 1 || p.phrase.length > 7)
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, limit);
  }

  /** Simple first-sentence summary of an abstract. */
  function firstSentences(text, n = 2) {
    const sents = normalise(text).match(/[^.!?]+[.!?]+(?=\s|$)/g) || [normalise(text)];
    return sents.slice(0, n).map((x) => x.trim()).join(' ');
  }

  /**
   * Analyse one thesis record as returned by the local server (or pasted by hand).
   * @param {{title?:string, abstract?:string, keywords?:string[], subjects?:string[]}} meta
   */
  function analyseThesis(meta) {
    const title = meta.title || '';
    const abstract = meta.abstract || '';
    const authorKw = [...(meta.keywords || []), ...(meta.subjects || [])].join('. ');
    const all = [title, title, abstract, authorKw].join('. '); // title counts double
    const subfields = explainMatches(all, SUBFIELD_RE);
    const tech = explainMatches(all, TECHNIQUE_RE);
    const total = subfields.reduce((a, s) => a + s.score, 0) || 1;
    return {
      subfields: subfields.map((s) => ({ ...s, share: s.score / total })),
      primary: subfields[0] ? subfields[0].label : null,
      techniques: tech,
      keyPhrases: keyPhrases([title, abstract].join('. ')),
      summary: abstract ? firstSentences(abstract, 2) : '',
      structure: title ? structure(title) : null,
      abstractWords: tokenize(abstract).length,
    };
  }

  return {
    SUBFIELDS, TECHNIQUES, explainMatches, keyPhrases, analyseThesis, firstSentences,
    SUBFIELD_RE, TECHNIQUE_RE,
    normalise, tokenize, classify, techniques, structure,
  };
});
