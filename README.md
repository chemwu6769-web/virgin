# Thesis Title Lab

A small web app for chemistry dissertations, with two modes.

**One thesis.** Paste a link to a thesis page (or its DOI) and get:

- title, author, year, institution, and links to the page, PDF and DOI
- **main subfield** plus the other subfields touched, each with the words that triggered it
- **keywords**: the author's own, the repository's subject headings, OpenAlex topics when the thesis has a DOI, and a combined "suggested keywords" list
- **key phrases** pulled from the abstract automatically
- **methods** named (NMR, X-ray, DFT, EPR, machine learning…)
- a two-sentence summary (the abstract's opening), the full abstract with key phrases highlighted, a **Copy summary** button, and **Add to my title list**

If a site blocks automatic reading, paste the title and abstract instead and get the same analysis.

**Many titles.** Paste or load a list of titles (optionally with years) and get:

- **Summary tiles**: title count, year range, median length, and the share of titles that have a subtitle, are phrased as a question, or contain an acronym or chemical formula.
- **Subfields**: keyword-based, multi-label classification into 10 areas (organic, inorganic/organometallic, physical, analytical, materials/nano, polymer/supramolecular, chemical biology/medicinal, computational/theory/data, electrochemistry/energy, environmental/green).
- **Techniques mentioned**: NMR, mass spec, X-ray, DFT, MD, IR/Raman, UV-vis/fluorescence, EPR, EM, chromatography, electrochemical methods, ultrafast/laser, machine learning.
- **Most common words and two-word phrases** (stopwords and optional "filler" words such as *study*, *novel* and *towards* removed).
- **Title-length histogram** and common opening phrases.
- **Trend over time**: the share of titles per year (or per 3- or 5-year group) matching any subfield, technique, structural feature or free-text keyword. Click any bar to plot its trend.
- **Searchable, sortable table** of every title with its tags, plus **CSV export**.

No AI and no accounts. All analysis uses transparent keyword rules that you can edit.

## Run it on your computer

Reading thesis links needs the small helper in `server.py`, because browsers don't let a web page read other websites directly. It uses only standard Python 3 (3.8 or newer), so there's nothing to install.

1. Download this project (on GitHub: **Code → Download ZIP**, then unzip it), or clone it.
2. Open a terminal in the project folder. On a Mac, right-click the folder in Finder and choose **New Terminal at Folder**. On Windows, open the folder, type `cmd` in the address bar and press Enter.
3. Start the helper:

   ```bash
   python3 server.py
   ```

   (On Windows use `py server.py` if `python3` isn't found.)
4. Open **http://localhost:8000** in your browser. Leave the terminal open while you use the app, and press Ctrl+C there to stop it.

The helper only listens on your own computer. It fetches the page you ask for and nothing else; it refuses local or private network addresses.

Without the helper (opening `index.html` directly, or the hosted copy), everything works except reading links. Use the paste box instead.

### Which links work

The helper reads the metadata repositories publish for Google Scholar: `citation_*` and Dublin Core `DC.*` tags, and schema.org JSON-LD. Most university repositories (DSpace, EPrints, Figshare, Pure, Hyrax/Samvera) publish these, so a thesis's landing page usually works. Tips:

- Link the **landing page**, not the PDF.
- A **DOI** (e.g. `10.1234/abcd`) works and also pulls topics from OpenAlex.
- Some commercial sites (e.g. ProQuest) block automated access. You'll get an error explaining that; paste the abstract instead.

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
| `src/app.js` | "Many titles" UI |
| `src/thesis.js` | "One thesis" UI |
| `server.py` | Local helper: serves the app and reads thesis pages (`/api/thesis?url=…`) |
| `src/styles.css` | Styles, light and dark themes |
| `src/sample-data.js` | Copy of `data/sample.csv` so the sample also loads from `file://` |
| `test/` | Node tests for the analysis module, Python tests for `server.py`, synthetic fixture pages |

## Tests

```bash
npm test
```

This runs both the JavaScript and the Python tests. Python only: `python3 -m unittest discover -s test -p 'test_*.py'`.

## Extending the classifier

Subfield and technique detection is driven by the `SUBFIELDS` and `TECHNIQUES` keyword lists at the top of `src/analysis.js`. Each entry is a list of regex fragments matched against the lowercased title. Add or adjust patterns there. Classification is deliberately transparent and editable rather than a black-box model.

If you change `data/sample.csv`, regenerate the embedded copy:

```bash
node -e 'const fs=require("fs");fs.writeFileSync("src/sample-data.js","// Synthetic example titles (not real dissertations). Mirrors data/sample.csv so the app works from file://.\nwindow.SAMPLE_CSV = "+JSON.stringify(fs.readFileSync("data/sample.csv","utf8"))+";\n")'
```
