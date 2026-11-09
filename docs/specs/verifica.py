#!/usr/bin/env python3
"""Controlli di accettazione della spec 2026-11-09 (scheletri e testi).
Uso: python3 docs/specs/verifica.py [--testi] site/a.html site/b.html ...
Esce 1 se un controllo fallisce."""
import re, sys
from html.parser import HTMLParser

class Testo(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.parti = []
    def handle_starttag(self, tag, a):
        if tag in ("script", "style", "noscript", "template"): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template") and self.skip: self.skip -= 1
    def handle_data(self, d):
        if not self.skip: self.parti.append(d)

def parole(html, solo_main=True):
    if solo_main and "<main" in html:
        html = html[html.index("<main"):html.rindex("</main>")]
    p = Testo(); p.feed(html)
    return len(re.findall(r"\w[\w'’-]*", " ".join(p.parti)))

def controlla(f, testi):
    h = open(f, encoding="utf-8").read()
    head = h.split("</head>")[0]
    ko = []
    def ok(cond, msg):
        if not cond: ko.append(msg)
    ok(h.count("<style") == 0, "<style presente")
    ok('style="' not in h, 'style="" presente')
    ok("fonts.googleapis" not in h and "fonts.gstatic" not in h, "Google Fonts")
    ok(len(re.findall(r'rel="canonical"', h)) == 1, "canonical != 1")
    ok(len(re.findall(r'property="og:image"', h)) == 1, "og:image != 1")
    t = re.search(r"<title>(.*?)</title>", head, re.S)
    ok(t and len(t.group(1).strip()) <= 60, f"title >60 o assente ({t and len(t.group(1).strip())})")
    d = re.search(r'<meta name="description" content="([^"]*)"', head)
    ok(d and 120 <= len(d.group(1)) <= 155, f"description fuori 120-155 ({d and len(d.group(1))})")
    ok("BreadcrumbList" in h, "BreadcrumbList assente")
    ok("services.css?v=20261109" in h, "services.css?v=20261109 assente")
    for m in re.finditer(r"<img\b[^>]*>", h):
        ok("alt=" in m.group(0), f"img senza alt: {m.group(0)[:60]}")
    if testi:
        ok("{{T:" not in h, f"segnaposto rimasti: {h.count('{{T:')}")
        ok("—" not in h, "trattino lungo")
        ok(len(re.findall(r"sur mesure", h, re.I)) <= 1, "sur mesure > 1")
        ok(not re.search(r"pas [^.<]{1,40}, mais", h, re.I), "antitesi 'pas ..., mais'")
        nomi = re.findall(r"planeto|moca|ruben|lapa|\bdge\b", h, re.I)
        ok(not nomi, f"nomi clienti: {set(nomi)}")
    return ko, parole(h)

if __name__ == "__main__":
    testi = "--testi" in sys.argv
    errori = 0
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        ko, n = controlla(f, testi)
        print(f"{'OK ' if not ko else 'KO '} {f}  parole_main={n}" + ("".join(f"\n     - {k}" for k in ko)))
        errori += bool(ko)
    sys.exit(1 if errori else 0)
