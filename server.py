#!/usr/bin/env python3
"""
Thesis Title Lab local server.

Serves the web app and adds one endpoint the browser can't do on its own
(other websites block cross-site requests from pages):

    GET /api/thesis?url=<thesis page URL or DOI>

It downloads the thesis landing page and pulls out the metadata that
repositories publish for Google Scholar and other indexers (Highwire
`citation_*` tags, Dublin Core `DC.*` tags, schema.org JSON-LD, plain
<meta> tags). If a DOI is found, OpenAlex is asked for topics/keywords too.

Standard library only. Run:  python3 server.py   then open http://localhost:8000
"""
from __future__ import annotations

import argparse
import gzip
import html
import ipaddress
import json
import os
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
import zlib
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
MAX_BYTES = 5 * 1024 * 1024
TIMEOUT = 20
USER_AGENT = (
    "Mozilla/5.0 (compatible; ThesisTitleLab/0.2; +local research tool) "
    "AppleWebKit/537.36 (KHTML, like Gecko)"
)
DOI_RE = re.compile(r"\b(10\.\d{4,9}/[^\s\"'<>]+)", re.I)


# --------------------------------------------------------------------------- HTML parsing
class _MetaParser(HTMLParser):
    """Collects <meta>, <link>, JSON-LD blocks, <title>, the first <h1> and paragraphs."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: list[tuple[str, str]] = []  # (lowercased name/property, content)
        self.links: list[dict] = []
        self.jsonld: list[str] = []
        self.title = ""
        self.h1 = ""
        self.paragraphs: list[str] = []
        self._stack: list[str] = []
        self._buf: list[str] = []
        self._capture: str | None = None

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            key = (a.get("name") or a.get("property") or a.get("itemprop") or "").strip().lower()
            if key and a.get("content", "").strip():
                self.meta.append((key, a["content"].strip()))
        elif tag == "link":
            self.links.append(a)
        elif tag == "script" and "ld+json" in a.get("type", "").lower():
            self._start_capture("jsonld")
        elif tag == "title" and not self.title:
            self._start_capture("title")
        elif tag == "h1" and not self.h1:
            self._start_capture("h1")
        elif tag == "p" and len(self.paragraphs) < 200 and self._capture is None:
            self._start_capture("p")

    def _start_capture(self, kind):
        self._capture = kind
        self._buf = []

    def handle_data(self, data):
        if self._capture:
            self._buf.append(data)

    def handle_endtag(self, tag):
        kind = self._capture
        if not kind:
            return
        if (kind == "jsonld" and tag == "script") or tag == kind:
            text = "".join(self._buf)
            if kind == "jsonld":
                self.jsonld.append(text)
            else:
                text = _clean(text)
                if kind == "title":
                    self.title = text
                elif kind == "h1":
                    self.h1 = text
                elif text:
                    self.paragraphs.append(text)
            self._capture = None
            self._buf = []


def _clean(s: str) -> str:
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)  # stray markup inside abstracts
    return re.sub(r"\s+", " ", s).strip()


def _uniq(items):
    seen, out = set(), []
    for it in items:
        it = _clean(it)
        k = it.lower()
        if it and k not in seen:
            seen.add(k)
            out.append(it)
    return out


def _split_keywords(values: list[str], commas: bool = True) -> list[str]:
    out = []
    for v in values:
        # repositories use ; , or | between keywords in a single tag
        if re.search(r"[;|]", v) or not commas:
            parts = re.split(r"\s*[;|]\s*", v)
        else:
            parts = re.split(r"\s*,\s*", v)
        out.extend(p.strip(" .") for p in parts)
    return _uniq(p for p in out if 1 < len(p) < 120)


def _year(s: str | None) -> int | None:
    m = re.search(r"\b(1[89]\d{2}|20\d{2})\b", s or "")
    return int(m.group(1)) if m else None


def _jsonld_objects(blocks: list[str]):
    for raw in blocks:
        try:
            data = json.loads(raw.strip())
        except ValueError:
            continue
        stack = [data]
        while stack:
            d = stack.pop()
            if isinstance(d, list):
                stack.extend(d)
            elif isinstance(d, dict):
                if "@graph" in d:
                    stack.append(d["@graph"])
                yield d


def _ld_text(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v]
    if isinstance(v, list):
        return [t for x in v for t in _ld_text(x)]
    if isinstance(v, dict):
        return _ld_text(v.get("name") or v.get("@value") or v.get("value"))
    return [str(v)]


def parse_thesis_html(page: str, url: str = "") -> dict:
    """Extract thesis metadata from a landing page's HTML."""
    p = _MetaParser()
    try:
        p.feed(page)
        p.close()
    except Exception:  # malformed HTML: keep whatever was parsed
        pass

    def get(*names: str) -> list[str]:
        names_l = [n.lower() for n in names]
        return [v for k, v in p.meta if k in names_l]

    found: list[str] = []

    def pick(label: str, *names: str) -> list[str]:
        vals = get(*names)
        if vals:
            found.append(label)
        return vals

    ld = [o for o in _jsonld_objects(p.jsonld)
          if str(o.get("@type", "")).lower() in {"thesis", "scholarlyarticle", "creativework", "article", "book"}]
    ld0 = ld[0] if ld else {}
    if ld0:
        found.append("JSON-LD")

    title = (pick("citation_title", "citation_title") or pick("DC.title", "dc.title", "dcterms.title")
             or _ld_text(ld0.get("name") or ld0.get("headline"))
             or pick("og:title", "og:title") or [p.h1 or p.title])
    authors = (pick("citation_author", "citation_author") or pick("DC.creator", "dc.creator", "dcterms.creator")
               or _ld_text(ld0.get("author")))
    date = (pick("citation_date", "citation_publication_date", "citation_online_date", "citation_date")
            or pick("DC.date", "dc.date", "dc.date.issued", "dcterms.issued", "dcterms.date", "dcterms.created")
            or _ld_text(ld0.get("datePublished") or ld0.get("dateCreated")))
    abstract = (pick("citation_abstract", "citation_abstract")
                or pick("DC.description", "dc.description.abstract", "dcterms.abstract", "dc.description", "dcterms.description")
                or _ld_text(ld0.get("abstract") or ld0.get("description"))
                or pick("description", "description", "og:description"))
    kw = (pick("citation_keywords", "citation_keywords")
          + pick("keywords", "keywords", "dc.subject.keyword")
          + _ld_text(ld0.get("keywords")))
    subjects = pick("DC.subject", "dc.subject", "dcterms.subject") + _ld_text(ld0.get("about"))
    institution = (pick("citation_dissertation_institution", "citation_dissertation_institution",
                        "citation_publisher", "dc.publisher", "dcterms.publisher")
                   or _ld_text(ld0.get("sourceOrganization") or ld0.get("publisher")))
    doc_type = get("citation_dissertation_name", "dc.type", "dcterms.type") or _ld_text(ld0.get("@type"))
    pdf = get("citation_pdf_url")
    doi_vals = get("citation_doi", "dc.identifier.doi", "prism.doi", "dc.identifier", "dcterms.identifier") + \
        _ld_text(ld0.get("identifier")) + [url]
    doi = next((m.group(1).rstrip(".);,") for v in doi_vals for m in [DOI_RE.search(v)] if m), None)

    # Fallback for abstracts: the paragraph after an "Abstract" heading, or the longest early paragraph.
    abstract_text = _clean(max(abstract, key=len)) if abstract else ""
    if len(abstract_text) < 200:
        long_paras = [t for t in p.paragraphs if len(t) > 400]
        cand = next((t for t in long_paras if re.match(r"(?i)abstract\b", t)), None) or (long_paras[0] if long_paras else "")
        if len(cand) > len(abstract_text):
            abstract_text = re.sub(r"(?i)^abstract[:.\s]*", "", cand)
            found.append("page text")

    return {
        "url": url,
        "title": _clean(title[0]) if title else "",
        "authors": _uniq(authors)[:20],
        "year": _year(date[0] if date else ""),
        "institution": _clean(institution[0]) if institution else "",
        "type": _clean(doc_type[0]) if doc_type else "",
        "abstract": abstract_text[:20000],
        "keywords": _split_keywords(kw)[:60],
        "subjects": _split_keywords(subjects, commas=False)[:60],
        "doi": doi,
        "pdf_url": urllib.parse.urljoin(url, pdf[0]) if pdf else None,
        "found": sorted(set(found)),
    }


# --------------------------------------------------------------------------- OpenAlex
def openalex_reconstruct(inv: dict | None) -> str:
    if not inv:
        return ""
    pos = [(i, w) for w, idxs in inv.items() for i in idxs]
    return " ".join(w for _, w in sorted(pos))


def openalex_summary(work: dict) -> dict:
    return {
        "id": work.get("id"),
        "title": work.get("display_name") or work.get("title"),
        "year": work.get("publication_year"),
        "type": work.get("type"),
        "abstract": openalex_reconstruct(work.get("abstract_inverted_index")),
        "authors": [a.get("author", {}).get("display_name") for a in work.get("authorships", []) if a.get("author")],
        "institution": next((i.get("display_name") for a in work.get("authorships", []) for i in a.get("institutions", [])), None),
        "topics": [
            {"name": t.get("display_name"), "subfield": (t.get("subfield") or {}).get("display_name"),
             "field": (t.get("field") or {}).get("display_name"), "score": t.get("score")}
            for t in work.get("topics", [])
        ],
        "keywords": [k.get("display_name") for k in work.get("keywords", []) if k.get("display_name")],
    }


# --------------------------------------------------------------------------- fetching
class FetchError(Exception):
    pass


def _check_public(url: str) -> None:
    """Refuse non-http(s) URLs and hosts that resolve to private/loopback addresses."""
    u = urllib.parse.urlsplit(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise FetchError("Only http:// and https:// links are supported.")
    if os.environ.get("THESIS_LAB_ALLOW_PRIVATE") == "1":
        return
    try:
        infos = socket.getaddrinfo(u.hostname, None)
    except socket.gaierror:
        raise FetchError(f"Couldn't find the website {u.hostname}. Check the link.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise FetchError("That link points to a private or local address, which is not allowed.")


class _SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _check_public(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(_SafeRedirect)


def fetch(url: str, accept: str = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5") -> tuple[str, str, str]:
    """Return (final_url, content_type, text)."""
    _check_public(url)
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT, "Accept": accept, "Accept-Language": "en", "Accept-Encoding": "gzip, deflate",
    })
    try:
        with _opener.open(req, timeout=TIMEOUT) as r:
            data = r.read(MAX_BYTES + 1)
            final, ctype = r.geturl(), r.headers.get("Content-Type", "")
            enc = (r.headers.get("Content-Encoding") or "").lower()
    except urllib.error.HTTPError as e:
        hint = " The site may block automated access; paste the abstract instead." if e.code in (401, 403, 429) else ""
        raise FetchError(f"The website answered with error {e.code}.{hint}")
    except (urllib.error.URLError, socket.timeout, TimeoutError) as e:
        raise FetchError(f"Couldn't reach the website ({getattr(e, 'reason', e)}).")
    if len(data) > MAX_BYTES:
        raise FetchError("That page is too large to analyse.")
    if enc == "gzip":
        data = gzip.decompress(data)
    elif enc == "deflate":
        data = zlib.decompress(data)
    if "pdf" in ctype.lower() or data[:5] == b"%PDF-":
        raise FetchError("That link is a PDF. Use the thesis landing page (the page that links to the PDF) instead.")
    m = re.search(r"charset=([\w-]+)", ctype)
    text = data.decode(m.group(1) if m else "utf-8", errors="replace")
    return final, ctype, text


def normalise_input(s: str) -> str:
    s = s.strip()
    if re.match(r"(?i)^doi:\s*", s):
        s = re.sub(r"(?i)^doi:\s*", "", s)
    if re.match(r"^10\.\d{4,9}/\S+$", s):
        return "https://doi.org/" + s
    if not re.match(r"(?i)^https?://", s) and "." in s and " " not in s:
        return "https://" + s
    return s


def lookup_thesis(raw: str) -> dict:
    url = normalise_input(raw)
    final, _, page = fetch(url)
    meta = parse_thesis_html(page, final)
    meta["requested_url"] = url
    meta["openalex"] = None
    if meta["doi"]:
        try:
            _, _, body = fetch("https://api.openalex.org/works/doi:" + urllib.parse.quote(meta["doi"], safe="/"),
                               accept="application/json")
            oa = openalex_summary(json.loads(body))
            meta["openalex"] = oa
            # fill gaps from OpenAlex
            for k in ("title", "year", "institution"):
                if not meta[k] and oa.get(k):
                    meta[k] = oa[k]
            if not meta["authors"] and oa["authors"]:
                meta["authors"] = oa["authors"]
            if len(meta["abstract"]) < 100 and len(oa["abstract"]) > len(meta["abstract"]):
                meta["abstract"] = oa["abstract"]
                meta["found"].append("OpenAlex abstract")
        except (FetchError, ValueError):
            pass
    return meta


# --------------------------------------------------------------------------- HTTP server
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _json(self, code: int, obj) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        if u.path == "/api/health":
            return self._json(200, {"ok": True})
        if u.path == "/api/thesis":
            q = urllib.parse.parse_qs(u.query).get("url", [""])[0]
            if not q.strip():
                return self._json(400, {"error": "Add a thesis link or DOI."})
            try:
                return self._json(200, lookup_thesis(q))
            except FetchError as e:
                return self._json(502, {"error": str(e)})
            except Exception as e:  # keep the UI informative rather than hanging
                return self._json(500, {"error": f"Something went wrong reading that page: {e}"})
        return super().do_GET()

    def log_message(self, fmt, *args):
        sys.stderr.write("[thesis-lab] " + fmt % args + "\n")


def main():
    ap = argparse.ArgumentParser(description="Run Thesis Title Lab locally.")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--host", default="127.0.0.1", help="interface to bind (default: only this computer)")
    args = ap.parse_args()
    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Thesis Title Lab running at http://localhost:{args.port}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
