/*
 * Periodic table data and helpers. Works in the browser (window.Elements) and in Node (require).
 *
 * Sources of values: IUPAC standard (abridged) atomic weights; [brackets] give the mass number of the
 * longest-lived isotope for elements with no stable isotope. Electronegativity is on the Pauling scale
 * (values for many heavy elements are estimates). Electron configurations are ground-state; for Z >= 109
 * they are predictions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Elements = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Z|symbol|name|atomic weight|category code|Pauling electronegativity (blank = none)
  // Category codes: am alkali metal, ae alkaline earth, tm transition metal, pt post-transition metal,
  // md metalloid, nm reactive nonmetal, ha halogen, ng noble gas, ln lanthanide, ac actinide.
  const RAW = `
1|H|Hydrogen|1.008|nm|2.20
2|He|Helium|4.0026|ng|
3|Li|Lithium|6.94|am|0.98
4|Be|Beryllium|9.0122|ae|1.57
5|B|Boron|10.81|md|2.04
6|C|Carbon|12.011|nm|2.55
7|N|Nitrogen|14.007|nm|3.04
8|O|Oxygen|15.999|nm|3.44
9|F|Fluorine|18.998|ha|3.98
10|Ne|Neon|20.180|ng|
11|Na|Sodium|22.990|am|0.93
12|Mg|Magnesium|24.305|ae|1.31
13|Al|Aluminium|26.982|pt|1.61
14|Si|Silicon|28.085|md|1.90
15|P|Phosphorus|30.974|nm|2.19
16|S|Sulfur|32.06|nm|2.58
17|Cl|Chlorine|35.45|ha|3.16
18|Ar|Argon|39.95|ng|
19|K|Potassium|39.098|am|0.82
20|Ca|Calcium|40.078|ae|1.00
21|Sc|Scandium|44.956|tm|1.36
22|Ti|Titanium|47.867|tm|1.54
23|V|Vanadium|50.942|tm|1.63
24|Cr|Chromium|51.996|tm|1.66
25|Mn|Manganese|54.938|tm|1.55
26|Fe|Iron|55.845|tm|1.83
27|Co|Cobalt|58.933|tm|1.88
28|Ni|Nickel|58.693|tm|1.91
29|Cu|Copper|63.546|tm|1.90
30|Zn|Zinc|65.38|tm|1.65
31|Ga|Gallium|69.723|pt|1.81
32|Ge|Germanium|72.630|md|2.01
33|As|Arsenic|74.922|md|2.18
34|Se|Selenium|78.971|nm|2.55
35|Br|Bromine|79.904|ha|2.96
36|Kr|Krypton|83.798|ng|3.00
37|Rb|Rubidium|85.468|am|0.82
38|Sr|Strontium|87.62|ae|0.95
39|Y|Yttrium|88.906|tm|1.22
40|Zr|Zirconium|91.224|tm|1.33
41|Nb|Niobium|92.906|tm|1.6
42|Mo|Molybdenum|95.95|tm|2.16
43|Tc|Technetium|[97]|tm|1.9
44|Ru|Ruthenium|101.07|tm|2.2
45|Rh|Rhodium|102.91|tm|2.28
46|Pd|Palladium|106.42|tm|2.20
47|Ag|Silver|107.87|tm|1.93
48|Cd|Cadmium|112.41|tm|1.69
49|In|Indium|114.82|pt|1.78
50|Sn|Tin|118.71|pt|1.96
51|Sb|Antimony|121.76|md|2.05
52|Te|Tellurium|127.60|md|2.1
53|I|Iodine|126.90|ha|2.66
54|Xe|Xenon|131.29|ng|2.6
55|Cs|Caesium|132.91|am|0.79
56|Ba|Barium|137.33|ae|0.89
57|La|Lanthanum|138.91|ln|1.10
58|Ce|Cerium|140.12|ln|1.12
59|Pr|Praseodymium|140.91|ln|1.13
60|Nd|Neodymium|144.24|ln|1.14
61|Pm|Promethium|[145]|ln|1.13
62|Sm|Samarium|150.36|ln|1.17
63|Eu|Europium|151.96|ln|1.2
64|Gd|Gadolinium|157.25|ln|1.20
65|Tb|Terbium|158.93|ln|1.1
66|Dy|Dysprosium|162.50|ln|1.22
67|Ho|Holmium|164.93|ln|1.23
68|Er|Erbium|167.26|ln|1.24
69|Tm|Thulium|168.93|ln|1.25
70|Yb|Ytterbium|173.05|ln|1.1
71|Lu|Lutetium|174.97|ln|1.27
72|Hf|Hafnium|178.49|tm|1.3
73|Ta|Tantalum|180.95|tm|1.5
74|W|Tungsten|183.84|tm|2.36
75|Re|Rhenium|186.21|tm|1.9
76|Os|Osmium|190.23|tm|2.2
77|Ir|Iridium|192.22|tm|2.20
78|Pt|Platinum|195.08|tm|2.28
79|Au|Gold|196.97|tm|2.54
80|Hg|Mercury|200.59|tm|2.00
81|Tl|Thallium|204.38|pt|1.62
82|Pb|Lead|207.2|pt|1.87
83|Bi|Bismuth|208.98|pt|2.02
84|Po|Polonium|[209]|pt|2.0
85|At|Astatine|[210]|ha|2.2
86|Rn|Radon|[222]|ng|2.2
87|Fr|Francium|[223]|am|0.79
88|Ra|Radium|[226]|ae|0.9
89|Ac|Actinium|[227]|ac|1.1
90|Th|Thorium|232.04|ac|1.3
91|Pa|Protactinium|231.04|ac|1.5
92|U|Uranium|238.03|ac|1.38
93|Np|Neptunium|[237]|ac|1.36
94|Pu|Plutonium|[244]|ac|1.28
95|Am|Americium|[243]|ac|1.13
96|Cm|Curium|[247]|ac|1.28
97|Bk|Berkelium|[247]|ac|1.3
98|Cf|Californium|[251]|ac|1.3
99|Es|Einsteinium|[252]|ac|1.3
100|Fm|Fermium|[257]|ac|1.3
101|Md|Mendelevium|[258]|ac|1.3
102|No|Nobelium|[259]|ac|1.3
103|Lr|Lawrencium|[266]|ac|1.3
104|Rf|Rutherfordium|[267]|tm|
105|Db|Dubnium|[268]|tm|
106|Sg|Seaborgium|[269]|tm|
107|Bh|Bohrium|[270]|tm|
108|Hs|Hassium|[269]|tm|
109|Mt|Meitnerium|[278]|tm|
110|Ds|Darmstadtium|[281]|tm|
111|Rg|Roentgenium|[282]|tm|
112|Cn|Copernicium|[285]|tm|
113|Nh|Nihonium|[286]|pt|
114|Fl|Flerovium|[289]|pt|
115|Mc|Moscovium|[290]|pt|
116|Lv|Livermorium|[293]|pt|
117|Ts|Tennessine|[294]|ha|
118|Og|Oganesson|[294]|ng|`;

  const CATEGORIES = {
    am: 'Alkali metal', ae: 'Alkaline earth metal', tm: 'Transition metal', pt: 'Post-transition metal',
    md: 'Metalloid', nm: 'Reactive nonmetal', ha: 'Halogen', ng: 'Noble gas', ln: 'Lanthanide', ac: 'Actinide',
  };

  const GASES = new Set([1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86]);
  const LIQUIDS = new Set([35, 80]);
  const NOBLE = [2, 10, 18, 36, 54, 86];
  const NOBLE_SYM = { 2: 'He', 10: 'Ne', 18: 'Ar', 36: 'Kr', 54: 'Xe', 86: 'Rn' };

  // ---------------------------------------------------------------- electron configuration
  const ORDER = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
  const CAP = { s: 2, p: 6, d: 10, f: 14 };

  // Ground states that break the simple filling order (valence part after the noble-gas core).
  const EXCEPTIONS = {
    24: '3d5 4s1', 29: '3d10 4s1',
    41: '4d4 5s1', 42: '4d5 5s1', 44: '4d7 5s1', 45: '4d8 5s1', 46: '4d10', 47: '4d10 5s1',
    57: '5d1 6s2', 58: '4f1 5d1 6s2', 64: '4f7 5d1 6s2',
    78: '4f14 5d9 6s1', 79: '4f14 5d10 6s1',
    89: '6d1 7s2', 90: '6d2 7s2', 91: '5f2 6d1 7s2', 92: '5f3 6d1 7s2', 93: '5f4 6d1 7s2',
    96: '5f7 6d1 7s2', 103: '5f14 7s2 7p1',
  };

  function aufbau(z) {
    const occ = {};
    let left = z;
    for (const orb of ORDER) {
      if (!left) break;
      const n = Math.min(CAP[orb[1]], left);
      occ[orb] = n;
      left -= n;
    }
    return occ;
  }
  const orbKey = (o) => [+o[0], 'spdf'.indexOf(o[1])];
  const sortOrbs = (a, b) => orbKey(a)[0] - orbKey(b)[0] || orbKey(a)[1] - orbKey(b)[1];

  /** Noble-gas shorthand, e.g. 26 -> "[Ar] 3d6 4s2". */
  function electronConfig(z) {
    const core = [...NOBLE].reverse().find((g) => g < z);
    const prefix = core ? `[${NOBLE_SYM[core]}] ` : '';
    if (EXCEPTIONS[z]) return prefix + EXCEPTIONS[z];
    const full = aufbau(z);
    const coreOcc = core ? aufbau(core) : {};
    const val = Object.keys(full)
      .filter((o) => full[o] - (coreOcc[o] || 0) > 0)
      .sort(sortOrbs)
      .map((o) => `${o}${full[o] - (coreOcc[o] || 0)}`);
    return prefix + val.join(' ');
  }

  /** Total electrons described by a configuration string (used to check the data). */
  function countElectrons(config) {
    let total = 0;
    const m = config.match(/^\[(\w+)\]\s*/);
    if (m) total += +Object.keys(NOBLE_SYM).find((k) => NOBLE_SYM[k] === m[1]);
    for (const [, n] of config.replace(/^\[\w+\]\s*/, '').matchAll(/\d[spdf](\d+)/g)) total += +n;
    return total;
  }

  // ---------------------------------------------------------------- position in the table
  /** Display position: {row, col} on an 18-column grid; lanthanides/actinides go to rows 9/10. */
  function position(z) {
    const periods = [[1, 2], [3, 10], [11, 18], [19, 36], [37, 54], [55, 86], [87, 118]];
    const period = periods.findIndex(([a, b]) => z >= a && z <= b) + 1;
    const start = periods[period - 1][0];
    const i = z - start;
    let group = null, row = period, col;
    if (period === 1) col = z === 1 ? 1 : 18;
    else if (period <= 3) col = i < 2 ? i + 1 : i + 11;
    else if (period <= 5) col = i + 1;
    else if (i < 2) col = i + 1;
    else if (i < 17) { row = period + 3; col = i + 1; } // f-block: 57-71 / 89-103 into cols 3..17
    else col = i - 14 + 1;
    if (row === period) group = col;
    const block = row > 7 ? 'f' : col <= 2 || z === 2 ? 's' : col >= 13 ? 'p' : 'd';
    return { period, group, row, col, block };
  }

  // ---------------------------------------------------------------- build records
  const ELEMENTS = RAW.trim().split('\n').map((line) => {
    const [z, symbol, name, mass, cat, en] = line.split('|');
    const Z = +z;
    const pos = position(Z);
    const synthetic = Z === 43 || Z === 61 || Z >= 95;
    return {
      z: Z, symbol, name, mass,
      massValue: parseFloat(mass.replace(/[[\]]/g, '')),
      stableIsotope: !mass.startsWith('['),
      category: cat, categoryName: CATEGORIES[cat],
      electronegativity: en === '' ? null : +en,
      state: Z >= 100 ? 'unknown' : GASES.has(Z) ? 'gas' : LIQUIDS.has(Z) ? 'liquid' : 'solid',
      radioactive: Z === 43 || Z === 61 || Z >= 84,
      synthetic,
      predicted: Z >= 109,
      config: electronConfig(Z),
      ...pos,
    };
  });
  const BY_SYMBOL = Object.fromEntries(ELEMENTS.map((e) => [e.symbol, e]));

  // ---------------------------------------------------------------- finding elements in text
  const ALIASES = { aluminum: 'Al', cesium: 'Cs', sulphur: 'S', sulfide: 'S', sulphide: 'S' };
  // Name stems also match adjectives/compounds: "ferrocene" no, but "zirconium-based", "copper(II)" yes.
  const NAME_RE = new RegExp(
    '\\b(' + [...ELEMENTS.map((e) => e.name.toLowerCase()), ...Object.keys(ALIASES)].join('|') + ')\\b', 'gi');
  const FORMULA_RE = /(?<![A-Za-z])((?:[A-Z][a-z]?\d*){1,8})(?![a-z])/g;

  /** Split "Fe3O4" into symbols if every part is a real element, else null. */
  function parseFormula(tok) {
    const parts = tok.match(/[A-Z][a-z]?\d*/g) || [];
    if (parts.join('') !== tok) return null;
    const syms = parts.map((p) => p.replace(/\d+/, ''));
    return syms.every((s) => BY_SYMBOL[s]) ? syms : null;
  }

  /**
   * Elements mentioned in text: by name ("zirconium", "copper"), in formulas with a digit (CO2, Fe3O4),
   * with an oxidation state (Ni(II)), or as a bond (C–H, C-N).
   * @returns {{symbol:string, count:number, forms:string[]}[]} most mentioned first
   */
  function findElements(text) {
    const found = new Map();
    const add = (sym, form) => {
      const e = found.get(sym) || { symbol: sym, count: 0, forms: new Set() };
      e.count++; e.forms.add(form);
      found.set(sym, e);
    };
    const t = String(text || '').replace(/[‐-―−]/g, '-');
    for (const m of t.matchAll(NAME_RE)) {
      const w = m[1].toLowerCase();
      if (w === 'lead' && /^\s+(to|by|in|on|the|a|an|us|them)\b|^ing/i.test(t.slice(m.index + 4, m.index + 12))) continue;
      const sym = ALIASES[w] || ELEMENTS.find((e) => e.name.toLowerCase() === w).symbol;
      add(sym, m[1].toLowerCase());
    }
    for (const m of t.matchAll(FORMULA_RE)) {
      const tok = m[1];
      const after = t.slice(m.index + tok.length, m.index + tok.length + 6);
      const ox = /^\((?:I{1,3}|IV|V|VI{0,3}|0)\)/.test(after);
      if (!/\d/.test(tok) && !ox) continue;
      const syms = parseFormula(tok);
      if (syms) syms.forEach((s) => add(s, tok + (ox ? after.match(/^\([IVX0]+\)/)[0] : '')));
    }
    for (const m of t.matchAll(/(?<![A-Za-z(])([A-Z][a-z]?)-([A-Z][a-z]?)(?![A-Za-z])/g)) {
      if (BY_SYMBOL[m[1]] && BY_SYMBOL[m[2]]) { add(m[1], `${m[1]}–${m[2]}`); add(m[2], `${m[1]}–${m[2]}`); }
    }
    return [...found.values()]
      .map((e) => ({ ...e, forms: [...e.forms] }))
      .sort((a, b) => b.count - a.count || BY_SYMBOL[a.symbol].z - BY_SYMBOL[b.symbol].z);
  }

  return { ELEMENTS, BY_SYMBOL, CATEGORIES, electronConfig, countElectrons, position, findElements, parseFormula };
});
