const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/elements.js');

test('has all 118 elements in order with unique symbols and cells', () => {
  assert.equal(E.ELEMENTS.length, 118);
  E.ELEMENTS.forEach((e, i) => assert.equal(e.z, i + 1));
  assert.equal(new Set(E.ELEMENTS.map((e) => e.symbol)).size, 118);
  assert.equal(new Set(E.ELEMENTS.map((e) => `${e.row},${e.col}`)).size, 118);
});

test('every electron configuration accounts for exactly Z electrons', () => {
  for (const e of E.ELEMENTS) assert.equal(E.countElectrons(e.config), e.z, `${e.symbol}: ${e.config}`);
});

test('known configurations, including exceptions to the filling order', () => {
  const cfg = (s) => E.BY_SYMBOL[s].config;
  assert.equal(cfg('H'), '1s1');
  assert.equal(cfg('Fe'), '[Ar] 3d6 4s2');
  assert.equal(cfg('Cr'), '[Ar] 3d5 4s1');
  assert.equal(cfg('Cu'), '[Ar] 3d10 4s1');
  assert.equal(cfg('Pd'), '[Kr] 4d10');
  assert.equal(cfg('Pb'), '[Xe] 4f14 5d10 6s2 6p2');
  assert.equal(cfg('Gd'), '[Xe] 4f7 5d1 6s2');
  assert.equal(cfg('U'), '[Rn] 5f3 6d1 7s2');
});

test('positions, groups and blocks', () => {
  const p = (s) => { const e = E.BY_SYMBOL[s]; return [e.period, e.group, e.block]; };
  assert.deepEqual(p('He'), [1, 18, 's']);
  assert.deepEqual(p('Na'), [3, 1, 's']);
  assert.deepEqual(p('Al'), [3, 13, 'p']);
  assert.deepEqual(p('Fe'), [4, 8, 'd']);
  assert.deepEqual(p('Hf'), [6, 4, 'd']);
  assert.deepEqual(p('Ce'), [6, null, 'f']);
  assert.equal(E.BY_SYMBOL.Ce.row, 9);
  assert.equal(E.BY_SYMBOL.Th.row, 10);
});

test('states, masses and flags', () => {
  assert.equal(E.BY_SYMBOL.Br.state, 'liquid');
  assert.equal(E.BY_SYMBOL.Hg.state, 'liquid');
  assert.equal(E.BY_SYMBOL.Cl.state, 'gas');
  assert.equal(E.BY_SYMBOL.Ga.state, 'solid');
  assert.equal(E.BY_SYMBOL.C.mass, '12.011');
  assert.equal(E.BY_SYMBOL.Tc.stableIsotope, false);
  assert.equal(E.BY_SYMBOL.Tc.radioactive, true);
  assert.equal(E.BY_SYMBOL.Bi.radioactive, false);
  assert.equal(E.BY_SYMBOL.He.electronegativity, null);
  assert.equal(E.BY_SYMBOL.F.electronegativity, 3.98);
});

test('findElements: names, formulas, oxidation states and bonds', () => {
  const found = E.findElements('Zirconium MOFs for CO2 capture; Fe3O4 and Ni(II) complexes; C–H activation; aluminum oxide.');
  const syms = found.map((f) => f.symbol);
  for (const s of ['Zr', 'C', 'O', 'Fe', 'Ni', 'H', 'Al']) assert.ok(syms.includes(s), s);
  assert.deepEqual(found.find((f) => f.symbol === 'C').forms.sort(), ['CO2', 'C–H']);
});

test('findElements ignores look-alikes', () => {
  assert.deepEqual(E.findElements('This may lead to better DFT and NMR results. In 2020 SARS-CoV-2 appeared.'), []);
  assert.deepEqual(E.findElements('lead acetate').map((f) => f.symbol), ['Pb']);
});
