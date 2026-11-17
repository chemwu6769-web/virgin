"""Tests for server.py metadata extraction. Run: python3 -m unittest discover -s test -p 'test_*.py'"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server  # noqa: E402

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        return f.read()


class ParseTests(unittest.TestCase):
    def test_dspace_style_tags(self):
        m = server.parse_thesis_html(load("dspace.html"), "https://repo.example.ac.uk/handle/1234/5678")
        self.assertTrue(m["title"].startswith("Zirconium Metal–Organic Frameworks for Carbon Capture"))
        self.assertEqual(m["authors"], ["Rivera, Alex"])
        self.assertEqual(m["year"], 2022)
        self.assertEqual(m["institution"], "Example University")
        self.assertEqual(m["keywords"], ["metal-organic frameworks", "carbon capture", "CO2 adsorption", "zirconium"])
        self.assertEqual(m["subjects"], ["Chemistry, Inorganic", "Porous materials"])
        self.assertEqual(m["doi"], "10.99999/example.thesis.5678")
        self.assertEqual(m["pdf_url"], "https://repo.example.ac.uk/bitstream/1234/5678/thesis.pdf")
        self.assertIn("carbon capture", m["abstract"])
        self.assertIn("citation_title", m["found"])

    def test_jsonld_only(self):
        m = server.parse_thesis_html(load("jsonld.html"), "https://example.edu/record/1")
        self.assertEqual(m["title"], "Enantioselective Nickel Catalysis for C–N Bond Formation")
        self.assertEqual(m["authors"], ["Sam Okafor"])
        self.assertEqual(m["year"], 2019)
        self.assertEqual(m["institution"], "Example Institute of Technology")
        self.assertEqual(m["keywords"], ["asymmetric catalysis", "nickel", "amination", "photoredox"])
        self.assertIn("photoredox", m["abstract"])
        self.assertIsNone(m["doi"])

    def test_plain_page_falls_back_to_h1_and_text(self):
        m = server.parse_thesis_html(load("plain.html"), "https://example.org/x")
        self.assertEqual(m["title"], "Probing Water at Interfaces with Vibrational Spectroscopy")
        self.assertTrue(m["abstract"].startswith("Water at interfaces"))
        self.assertIn("page text", m["found"])

    def test_keyword_splitting(self):
        self.assertEqual(server._split_keywords(["a b, c d"]), ["a b", "c d"])
        self.assertEqual(server._split_keywords(["Chemistry, Organic; NMR"]), ["Chemistry, Organic", "NMR"])

    def test_normalise_input(self):
        self.assertEqual(server.normalise_input("10.1000/xyz123"), "https://doi.org/10.1000/xyz123")
        self.assertEqual(server.normalise_input("doi:10.1000/xyz"), "https://doi.org/10.1000/xyz")
        self.assertEqual(server.normalise_input("repo.example.ac.uk/handle/1"), "https://repo.example.ac.uk/handle/1")

    def test_openalex_abstract_reconstruction(self):
        inv = {"Water": [0], "at": [1], "interfaces": [2]}
        self.assertEqual(server.openalex_reconstruct(inv), "Water at interfaces")

    def test_refuses_private_and_non_http(self):
        os.environ.pop("THESIS_LAB_ALLOW_PRIVATE", None)
        for bad in ("http://127.0.0.1/x", "http://localhost:8000/", "file:///etc/passwd", "ftp://example.org/"):
            with self.assertRaises(server.FetchError):
                server._check_public(bad)

    def test_malformed_html_does_not_crash(self):
        m = server.parse_thesis_html("<html><meta name='citation_title' content='X'><p>unclosed", "")
        self.assertEqual(m["title"], "X")


if __name__ == "__main__":
    unittest.main()
