# Thesis Title Lab

A small web app for chemistry: an interactive periodic table on the cover, and a thesis reader below it.

**The cover: periodic table.** All 118 elements. Select an element to see its atomic mass, electron configuration, electronegativity, state at 25 °C, group, period, block and category. Colour the table by block, electronegativity or state, search by name, symbol or number, and move around with the arrow keys.

**The thesis reader.** Paste a link to a thesis page (or its DOI) and get:

- title, author, year, institution, and links to the page, PDF and DOI
- **main subfield** plus the other subfields touched, each with the words that triggered it
- **keywords**: the author's own, the repository's subject headings, OpenAlex topics when the thesis has a DOI, and a combined "suggested keywords" list
- **key phrases** pulled from the abstract automatically
- **methods** named (NMR, X-ray, DFT, EPR, machine learning…)
- **elements mentioned**, by name (zirconium), formula (CO2, Fe3O4), oxidation state (Ni(II)) or bond (C–H). They light up on the cover table, with an option to show only those.
- a two-sentence summary (the abstract's opening), the full abstract with key phrases highlighted, and a **Copy summary** button

If a site blocks automatic reading, paste the title and abstract instead and get the same analysis.

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

Without the helper (opening `index.html` directly, or the hosted copy), the periodic table and everything else work except reading links. Use the paste box instead.

### Which links work

The helper reads the metadata repositories publish for Google Scholar: `citation_*` and Dublin Core `DC.*` tags, and schema.org JSON-LD. Most university repositories (DSpace, EPrints, Figshare, Pure, Hyrax/Samvera) publish these, so a thesis's landing page usually works. Tips:

- Link the **landing page**, not the PDF.
- A **DOI** (e.g. `10.1234/abcd`) works and also pulls topics from OpenAlex.
- Some commercial sites (e.g. ProQuest) block automated access. You'll get an error explaining that; paste the abstract instead.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | Page shell |
| `src/analysis.js` | Thesis text analysis: subfields, methods, key phrases (pure functions; browser and Node) |
| `src/elements.js` | Periodic table data, electron configurations, finding elements in text |
| `src/periodic.js` | The periodic table cover |
| `src/theme.js` | Light/dark toggle |
| `src/charts.js` | Small SVG bar chart with hover |
| `src/thesis.js` | Thesis reader UI |
| `server.py` | Local helper: serves the app and reads thesis pages (`/api/thesis?url=…`) |
| `src/styles.css` | Styles, light and dark themes |
| `test/` | Node tests for analysis and element data, Python tests for `server.py`, synthetic fixture pages |
| `scripts/build_single_file.py` | Inlines everything into one HTML file for hosting |

## Tests

```bash
npm test
```

This runs both the JavaScript and the Python tests. Python only: `python3 -m unittest discover -s test -p 'test_*.py'`.

## Data and extending the rules

Subfield and technique detection is driven by the `SUBFIELDS` and `TECHNIQUES` keyword lists at the top of `src/analysis.js`. Each entry is a list of regex fragments matched against the lowercased title. Add or adjust patterns there. Classification is deliberately transparent and editable rather than a black-box model.

Element data lives in `src/elements.js`: IUPAC standard atomic weights (bracketed values are the mass number of the most stable isotope), Pauling electronegativities (estimates for many heavy elements), and ground-state electron configurations generated from the filling order plus a list of known exceptions (predicted for Z ≥ 109). The tests check that every configuration adds up to the right number of electrons.
