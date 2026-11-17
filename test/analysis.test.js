const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../src/analysis.js');

test('parses CSV with title and year columns, including quoted commas', () => {
  const rows = A.parseInput('title,year,university\n"Catalysis, Kinetics and Mechanism",2019,X\nPlain Title,2020,Y\n');
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].title, rows[0].year, rows[0].extra.university], ['Catalysis, Kinetics and Mechanism', 2019, 'X']);
});

test('parses TSV and plain lines with leading or trailing years', () => {
  assert.equal(A.parseInput('Title\tYear\nA study of NMR\t2001\n')[0].year, 2001);
  const lines = A.parseInput('2015, Perovskite Solar Cells\nMOFs for Gas Storage\t2012\nNo year here\n');
  assert.deepEqual(lines.map((r) => r.year), [2015, 2012, null]);
  assert.equal(lines[0].title, 'Perovskite Solar Cells');
});

test('does not treat a comma inside a plain title as a year separator', () => {
  const [r] = A.parseInput('Synthesis, Structure and Reactivity of Iron Complexes');
  assert.equal(r.year, null);
  assert.equal(r.title, 'Synthesis, Structure and Reactivity of Iron Complexes');
});

test('classifies subfields (multi-label) and techniques', () => {
  const t = 'Density Functional Theory Studies of Palladium-Catalysed C–H Activation';
  assert.ok(A.classify(t).includes('Computational, theory & data'));
  assert.ok(A.classify(t).includes('Organic synthesis'));
  assert.ok(A.classify(t).includes('Inorganic & organometallic'));
  assert.deepEqual(A.techniques('Solid-State NMR and X-ray Crystallography of Zeolites'), ['NMR', 'X-ray / diffraction']);
  assert.deepEqual(A.classify('An Unrelated Title About Nothing'), []);
});

test('tokenizer keeps hyphenated chemistry terms and formulae', () => {
  assert.deepEqual(A.tokenize('Metal–Organic Frameworks for CO2 Capture'), ['metal-organic', 'frameworks', 'for', 'co2', 'capture']);
  assert.deepEqual(A.contentTokens('Towards a Novel Study of the Iron Complexes'), ['iron', 'complexes']);
  assert.ok(A.contentTokens('Towards a Novel Study', { dropFiller: false }).includes('novel'));
});

test('structure flags', () => {
  const s = A.structure('Is Bigger Better? Fe3O4 Nanoparticles: A DFT View');
  assert.equal(s.isQuestion, true);
  assert.equal(s.hasColon, true);
  assert.equal(s.hasFormula, true);
  assert.equal(s.hasAcronym, true);
  assert.equal(A.structure('Electrochemical CO2 Reduction').hasFormula, true);
  assert.equal(A.structure('SARS-CoV-2 Protease').hasFormula, false);
  assert.equal(A.openingPhrase('The Synthesis of Things'), 'synthesis of');
});

test('trendByYear computes per-year shares', () => {
  const recs = A.analyse(A.parseInput('2020, NMR of proteins\n2020, Battery cathodes\n2021, NMR of glasses\n')).records;
  const pts = A.trendByYear(recs, A.keywordPredicate('nmr'));
  assert.deepEqual(pts.map((p) => [p.year, p.hits, p.total, p.share]), [[2020, 1, 2, 0.5], [2021, 1, 1, 1]]);
});

test('keywordPredicate matches at word starts only and escapes regex chars', () => {
  const p = A.keywordPredicate('ion');
  assert.equal(p({ title: 'Ion channels' }), true);
  assert.equal(p({ title: 'Oxidation' }), false);
  assert.equal(A.keywordPredicate('c(sp3)')({ title: 'C(sp3)-H bonds' }), true);
});

test('analyses the bundled sample and exports CSV', () => {
  const csv = fs.readFileSync(path.join(__dirname, '../data/sample.csv'), 'utf8');
  const res = A.analyse(A.parseInput(csv));
  assert.ok(res.summary.count > 100);
  assert.equal(res.summary.unclassified, 0);
  assert.ok(res.terms.length > 0 && res.bigrams.length > 0);
  const out = A.toCSV(res.records).split('\n');
  assert.equal(out.length, res.summary.count + 1);
  assert.match(out[0], /^title,year,words,subfields/);
});

test('empty input is handled', () => {
  const res = A.analyse([]);
  assert.equal(res.summary.count, 0);
  assert.deepEqual(res.lengthHistogram, []);
});

test('trendByYear groups years into bins', () => {
  const recs = A.analyse(A.parseInput('2010, NMR a\n2011, b\n2012, NMR c\n2013, NMR d\n')).records;
  const pts = A.trendByYear(recs, A.keywordPredicate('nmr'), 3);
  assert.deepEqual(pts.map((p) => [p.year, p.yearEnd, p.hits, p.total]), [[2010, 2012, 2, 3], [2013, 2013, 1, 1]]);
});

test('keyPhrases finds multi-word phrases and keeps "in situ" together', () => {
  const abs = 'We report zirconium MOFs for carbon capture. In situ infrared spectroscopy shows CO2 binding. Carbon capture performance was screened.';
  const phrases = A.keyPhrases(abs).map((p) => p.phrase);
  assert.ok(phrases.includes('in-situ infrared spectroscopy'));
  assert.ok(phrases.includes('carbon capture'));
  assert.ok(!phrases.some((p) => /\b(we|was|shows)\b/.test(p)));
});

test('analyseThesis picks a main subfield and explains it', () => {
  const r = A.analyseThesis({
    title: 'Enantioselective Nickel Catalysis for C–N Bond Formation',
    abstract: 'Chiral ligands enable asymmetric amination under photoredox conditions. EPR spectroscopy supports a radical mechanism.',
    keywords: ['asymmetric catalysis'],
  });
  assert.equal(r.primary, 'Organic synthesis');
  assert.ok(r.subfields[0].terms.some((t) => t.term === 'enantioselective'));
  assert.ok(r.techniques.some((t) => t.label === 'EPR'));
  assert.ok(Math.abs(r.subfields.reduce((a, s) => a + s.share, 0) - 1) < 1e-9);
  assert.match(r.summary, /^Chiral ligands/);
});

test('analyseThesis copes with a title only', () => {
  const r = A.analyseThesis({ title: 'Perovskite Solar Cells' });
  assert.equal(r.summary, '');
  assert.ok(r.subfields.length > 0);
});
