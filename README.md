# Thesis Title Lab

A small, dependency-free web app for analysing **chemistry dissertation titles**.
Paste or load a list of titles (optionally with years) and get:

- **Summary tiles**: title count, year range, median length, and the share of titles that have a subtitle, are phrased as a question, or contain an acronym or chemical formula.
- **Subfields**: keyword-based, multi-label classification into 10 areas (organic, inorganic/organometallic, physical, analytical, materials/nano, polymer/supramolecular, chemical biology/medicinal, computational/theory/data, electrochemistry/energy, environmental/green).
- **Techniques mentioned**: NMR, mass spec, X-ray, DFT, MD, IR/Raman, UV-vis/fluorescence, EPR, EM, chromatography, electrochemical methods, ultrafast/laser, machine learning.
- **Most common words and two-word phrases** (stopwords and optional "filler" words such as *study*, *novel* and *towards* removed).
- **Title-length histogram** and common opening phrases.
- **Trend over time**: the share of titles per year (or per 3- or 5-year group) matching any subfield, technique, structural feature or free-text keyword. Click any bar to plot its trend.
- **Searchable, sortable table** of every title with its tags, plus **CSV export**.

Everything runs in the browser. No data leaves your machine.

## Run it

Open `index.html` in a browser. No build step and no install are needed.

Or serve it locally:

```bash
npm start   # python3 -m http.server 8000, then open http://localhost:8000
```

## Input formats

- **CSV/TSV with a header** that includes a `title` column (also accepted: `thesis title`, `dissertation title`, `headline`) and optionally a `year` (or `date`) column. Any other columns are kept but not yet used.
- **Plain text**, one title per line. A year may be prefixed or suffixed with a tab, comma, semicolon or `|`, for example `2019, Title` or `Title<TAB>2019`.

`data/sample.csv` contains ~110 **synthetic** example titles (not real dissertations) spanning 2008–2025. Use **Load sample data** to try the app.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | Page shell |
| `src/analysis.js` | All parsing and analysis (pure functions; works in browser and Node) |
| `src/charts.js` | Small SVG chart helpers (bars, columns, trend line with hover) |
| `src/app.js` | UI wiring |
| `src/styles.css` | Styles, light and dark themes |
| `src/sample-data.js` | Copy of `data/sample.csv` so the sample also loads from `file://` |
| `test/` | Node tests for the analysis module |

## Tests

```bash
npm test
```

## Extending the classifier

Subfield and technique detection is driven by the `SUBFIELDS` and `TECHNIQUES` keyword lists at the top of `src/analysis.js`. Each entry is a list of regex fragments matched against the lowercased title. Add or adjust patterns there. Classification is deliberately transparent and editable rather than a black-box model.

If you change `data/sample.csv`, regenerate the embedded copy:

```bash
node -e 'const fs=require("fs");fs.writeFileSync("src/sample-data.js","// Synthetic example titles (not real dissertations). Mirrors data/sample.csv so the app works from file://.\nwindow.SAMPLE_CSV = "+JSON.stringify(fs.readFileSync("data/sample.csv","utf8"))+";\n")'
```
