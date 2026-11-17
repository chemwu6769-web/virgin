#!/usr/bin/env python3
"""Inline the app's CSS and JS into one HTML file (for hosting as a single page).

Usage: python3 scripts/build_single_file.py OUTPUT.html
Link reading needs server.py, so the single-file copy offers paste mode only.
"""
import os
import re
import sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
html = open(os.path.join(root, "index.html"), encoding="utf-8").read()
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
css = open(os.path.join(root, "src/styles.css"), encoding="utf-8").read()


def inline(m):
    js = open(os.path.join(root, m.group(1)), encoding="utf-8").read()
    return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"


body = re.sub(r'<script src="(src/[^"]+)"></script>', inline, body)
out = ('<title>Thesis Title Lab</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
       "<style>\n" + css + "\n</style>\n" + body)
with open(sys.argv[1], "w", encoding="utf-8") as f:
    f.write(out)
print(f"wrote {sys.argv[1]} ({len(out)} bytes)")
