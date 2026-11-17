const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/analysis.js');

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
});

test('structure flags', () => {
  const s = A.structure('Is Bigger Better? Fe3O4 Nanoparticles: A DFT View');
  assert.equal(s.isQuestion, true);
  assert.equal(s.hasColon, true);
  assert.equal(s.hasFormula, true);
  assert.equal(s.hasAcronym, true);
  assert.equal(A.structure('Electrochemical CO2 Reduction').hasFormula, true);
  assert.equal(A.structure('SARS-CoV-2 Protease').hasFormula, false);
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
