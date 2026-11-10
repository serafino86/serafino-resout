#!/usr/bin/env python3
"""Controlli di accettazione delle spec 2026-11-09 (scheletri e testi) e 2026-11-10 §9 (look).
Uso: python3 docs/specs/verifica.py [--testi] site/a.html ...   pagine
     python3 docs/specs/verifica.py --css site/assets/services.css   fogli (ogni argomento .css)
     python3 docs/specs/verifica.py --autoprova                      test del verificatore
Esce 1 se un controllo fallisce."""
import os, re, sys
from html.parser import HTMLParser

VERSIONE = "20261110"
ESCLUSI = ()  # script fuori dal budget JS (widget chat): oggi la chat è un iframe, nessun file
MAX_JS = 8192
LIMITI = {"services.css": 40960, "motion.css": 6144}
MEDIA_MOTION = "(prefers-reduced-motion: no-preference)"
ANIMABILI = {"transform", "opacity", "border-radius", "clip-path"}
CHIARI = ("--bg", "--surface", "--white")
COPPIE = ([(t, f, 4.5) for t in ("--text", "--muted", "--accent") for f in CHIARI] + [("--white", "--accent", 4.5)]
          + [(t, "--bg-dark", 4.5) for t in ("--text-inv", "--muted-inv", "--accent-inv")]
          + [("--focus", f, 3.0) for f in CHIARI])
VIETATI = [(r"cursor\s*:\s*(none|url\()", "cursor none/url"), (r"scroll-snap", "scroll-snap"),
           (r"@import", "@import"), (r"url\(\s*['\"]?(https?:)?//", "url() esterna")]

class Testo(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.parti = []; self.tag = []; self.video = None
    def handle_starttag(self, tag, a):
        if tag in ("script", "style", "noscript", "template"): self.skip += 1
        a = dict(a); self.tag.append((tag, a))
        if tag == "video": self.video = a
        if tag == "track" and a.get("kind") == "captions" and self.video is not None: self.video["_captions"] = 1
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template") and self.skip: self.skip -= 1
        if tag == "video": self.video = None
    def handle_data(self, d):
        if not self.skip: self.parti.append(d)

def parole(html, solo_main=True):
    if solo_main and "<main" in html:
        html = html[html.index("<main"):html.rindex("</main>")]
    p = Testo(); p.feed(html)
    return len(re.findall(r"\w[\w'’-]*", " ".join(p.parti)))

def controlla_html(h, testi, base=None):
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
    ok(f"services.css?v={VERSIONE}" in h, f"services.css?v={VERSIONE} assente")
    for m in re.finditer(r"<img\b[^>]*>", h):
        ok("alt=" in m.group(0), f"img senza alt: {m.group(0)[:60]}")
    p = Testo(); p.feed(h)
    js = 0
    for tag, a in p.tag:
        if tag == "img":
            ok("width" in a and "height" in a, f"img senza width/height: {a.get('src')}")
        if tag == "video":
            ok("playsinline" in a and a.get("preload") == "none" and a.get("poster") and "controls" in a,
               "video: servono playsinline, preload=none, poster, controls")
            ok("autoplay" not in a, "video con autoplay")
            ok("muted" in a or "_captions" in a, "video non muted senza track captions")
        if tag in ("script", "link", "img", "video", "source", "track") and a.get("rel") not in ("canonical", "alternate"):
            for u in (a.get("src"), a.get("href"), a.get("poster")):
                ok(not (u or "").strip().startswith(("http", "//")), f"risorsa da altro dominio: {u}")
                if u and re.search(r"\.(css|js)(\?|$)", u):
                    ok(u.endswith(f"?v={VERSIONE}"), f"versione cache diversa da {VERSIONE}: {u}")
        if tag == "script" and a.get("src"):
            ok("defer" in a or a.get("type") == "module", f"script senza defer/module: {a['src']}")
            f = a["src"].split("?")[0]
            if base is not None and not f.startswith(("http", "//")) and os.path.basename(f) not in ESCLUSI:
                f = os.path.join(base, f)
                ok(os.path.isfile(f), f"script inesistente: {f}")
                js += os.path.isfile(f) and os.path.getsize(f)
        if tag == "link" and "motion.css" in (a.get("href") or ""):
            ok(a.get("media") == MEDIA_MOTION, "motion.css senza media reduced-motion: no-preference")
    ok(js <= MAX_JS, f"JS locale {js} > {MAX_JS} byte")
    if testi:
        ok("{{T:" not in h, f"segnaposto rimasti: {h.count('{{T:')}")
        ok("—" not in h, "trattino lungo")
        ok(len(re.findall(r"sur mesure", h, re.I)) <= 1, "sur mesure > 1")
        ok(not re.search(r"pas [^.<]{1,40}, mais", h, re.I), "antitesi 'pas ..., mais'")
        nomi = re.findall(r"planeto|moca|ruben|lapa|\bdge\b", h, re.I)
        ok(not nomi, f"nomi clienti: {set(nomi)}")
    return ko, parole(h)

def controlla(f, testi):
    return controlla_html(open(f, encoding="utf-8").read(), testi, os.path.dirname(f))

def contrasto(a, b):
    def lum(x):  # luminanza relativa WCAG 2.x
        x = x.lstrip("#"); x = x if len(x) == 6 else "".join(c * 2 for c in x)
        r, g, b = ((c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4)
                   for c in (int(x[i:i + 2], 16) / 255 for i in (0, 2, 4)))
        return .2126 * r + .7152 * g + .0722 * b
    x, y = sorted((lum(a), lum(b)))
    return (y + .05) / (x + .05)

def dich(corpo):
    return [tuple(x.strip() for x in d.split(":", 1)) for d in corpo.split(";") if ":" in d]

def senza_supports(css):
    """Toglie i blocchi @supports (animation-timeline ...) contando le graffe."""
    while (m := re.search(r"@supports[^{]*animation-timeline[^{]*\{", css)):
        i, n = m.end(), 1
        while n and i < len(css):
            n += {"{": 1, "}": -1}.get(css[i], 0); i += 1
        css = css[:m.start()] + css[i:]
    return css

def controlla_css(css, nome, peso=None):
    ko = []
    def ok(cond, msg):
        if not cond: ko.append(msg)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    regole = re.findall(r"([^{}]+)\{([^{}]*)\}", css)  # blocchi foglia: (selettore, dichiarazioni)
    tok = {p: v for sel, corpo in regole if ":root" in sel for p, v in dich(corpo) if p.startswith("--")}
    if "--bg" in tok or nome == "services.css":
        for t, f, soglia in COPPIE:
            vt, vf = tok.get(t, ""), tok.get(f, "")
            if all(re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v, re.I) for v in (vt, vf)):
                c = contrasto(vt, vf)
                ok(c >= soglia, f"contrasto {t} su {f} = {c:.2f} < {soglia}")
            else:
                ok(False, f"token assente o non esadecimale: {t}={vt!r} {f}={vf!r}")
    ok(not re.search(r"(?<![-\w])color\s*:[^;}]*--accent-deco", css), "--accent-deco usato in color:")
    for pat, msg in VIETATI:
        ok(not re.search(pat, css, re.I), f"vietato: {msg}")
    for sel, corpo in regole:
        if re.search(r"(?<![\w.#-])(html|body)(?![\w-])", sel):
            ok(not re.search(r"overflow\s*:\s*hidden", corpo), f"overflow: hidden su {sel.strip()}")
    if nome == "services.css":
        ok(not re.search(r"opacity\s*:\s*0(?![.\d])", css), "opacity: 0 in services.css")
        ok("animation-timeline" not in css, "animation-timeline in services.css")
    if nome == "motion.css":
        ok("animation-timeline" not in senza_supports(css), "animation-timeline fuori da @supports (animation-timeline")
        for sel, corpo in regole:
            fotogramma = re.fullmatch(r"\s*(from|to|[\d.]+%)(\s*,\s*(from|to|[\d.]+%))*\s*", sel)
            for prop, val in dich(corpo):
                if fotogramma and prop != "animation-timing-function":
                    ok(prop in ANIMABILI, f"proprietà animata non ammessa: {prop}")
                if prop in ("transition", "transition-property"):
                    for seg in re.sub(r"\([^)]*\)", "", val).split(","):
                        primo = (seg.split() or [""])[0]
                        ok(primo in ANIMABILI | {"none"}, f"transition su proprietà non ammessa: {primo or '?'}")
    if peso is not None and nome in LIMITI:
        ok(peso <= LIMITI[nome], f"{nome} pesa {peso} > {LIMITI[nome]} byte")
    return ko

def autoprova():
    """Casi giusti che devono passare e casi sbagliati che devono fallire col messaggio atteso."""
    pagina = ('<html><head><title>Titre</title><meta name="description" content="' + "x" * 130 + '">'
              '<link rel="canonical" href="https://serafino-resout.ch/"><meta property="og:image" content="a.jpg">'
              f'<link rel="stylesheet" href="./assets/services.css?v={VERSIONE}">'
              f'<link rel="stylesheet" href="./assets/motion.css?v={VERSIONE}" media="{MEDIA_MOTION}">'
              f'<script defer src="./assets/motion.js?v={VERSIONE}"></script></head><body><main>BreadcrumbList'
              '<a href="https://www.instagram.com/x/">lien</a><img src="a.jpg" alt="" width="4" height="5">'
              '<video controls playsinline preload="none" poster="p.jpg"><source src="v.mp4">'
              '<track kind="captions" src="v.vtt"></video></main></body></html>')
    token = (":root { --bg:#EEF0F4; --surface:#E1E4EA; --white:#FFFFFF; --text:#14161A; --muted:#4B515C; --accent:#A33B1A;"
             " --accent-deco:#E0572B; --bg-dark:#14161A; --text-inv:#EEF0F4; --muted-inv:#B4B9C4; --accent-inv:#FF9A70;"
             " --focus:#1D4ED8; }\n")
    foglio = token + "body { color: var(--text); overflow-x: hidden; } .dot { background-color: var(--accent-deco); opacity: 0.5; }"
    moto = ("@supports (animation-timeline: view()) { .r { animation-timeline: view(); } }\n"
            "@keyframes su { from { opacity: .4; transform: translateY(8px); } to { opacity: 1; transform: none; } }\n"
            ".b { transition: transform .3s cubic-bezier(.16,1,.3,1), opacity .3s; }")
    H = lambda vecchio, nuovo: ("html", pagina.replace(vecchio, nuovo))
    S = lambda extra, base=foglio: ("services.css", base + extra)
    casi = [  # (descrizione, (tipo, testo), pezzo del KO atteso oppure None = deve passare)
        ("pagina giusta", H("", ""), None),
        ("video autoplay", H("<video controls", "<video autoplay controls"), "autoplay"),
        ("video senza poster", H(' poster="p.jpg"', ""), "poster"),
        ("video senza sottotitoli", H('<track kind="captions" src="v.vtt">', ""), "captions"),
        ("script da CDN", H("./assets/motion.js", "https://cdn.jsdelivr.net/npm/gsap.js"), "altro dominio"),
        ("script senza defer", H("<script defer", "<script"), "defer"),
        ("img senza misure", H(' width="4" height="5"', ""), "width/height"),
        ("versione cache vecchia", H(f"motion.js?v={VERSIONE}", "motion.js?v=20261109"), "versione cache"),
        ("motion.css senza media", H(f' media="{MEDIA_MOTION}"', ""), "motion.css senza media"),
        ("foglio giusto", S(""), None),
        ("contrasto 3:1", S("", foglio.replace("--muted:#4B515C", "--muted:#8A8F99")), "contrasto --muted"),
        ("token mancante", S("", foglio.replace("--white:#FFFFFF;", "")), "token assente"),
        ("accent-deco come testo", S(".x { color: var(--accent-deco); }"), "--accent-deco"),
        ("cursor: none", S(".x { cursor: none; }"), "cursor"),
        ("scroll bloccato", S("html, body { overflow: hidden; }"), "overflow: hidden"),
        ("contenuto nascosto", S(".x { opacity: 0; }"), "opacity: 0"),
        ("foglio troppo pesante", ("services.css", foglio, 50000), "pesa"),
        ("moto giusto", ("motion.css", moto), None),
        ("timeline senza @supports", ("motion.css", moto + ".y { animation-timeline: scroll(); }"), "fuori da @supports"),
        ("keyframes su margin", ("motion.css", moto + "@keyframes m { to { margin-top: 0; } }"), "margin-top"),
        ("transition su tutto", ("motion.css", moto + ".y { transition: .3s; }"), "transition su"),
    ]
    sbagliati = abs(contrasto("#14161A", "#EEF0F4") - 15.87) > .01  # la formula deve ridare i numeri di §3.1
    if sbagliati: print("KO  formula del contrasto: 15,87 atteso per --text su --bg")
    for nome, (tipo, *arg), atteso in casi:
        ko = controlla_html(arg[0], True)[0] if tipo == "html" else controlla_css(arg[0], tipo, *arg[1:])
        bene = not ko if atteso is None else any(atteso in k for k in ko)
        print(f"{'OK ' if bene else 'KO '} {nome}: " + ("passa" if not ko else "; ".join(ko)))
        sbagliati += not bene
    print(f"autoprova: {len(casi) - sbagliati}/{len(casi)} casi come previsto")
    return 1 if sbagliati else 0

if __name__ == "__main__":
    if "--autoprova" in sys.argv: sys.exit(autoprova())
    testi = "--testi" in sys.argv
    errori = 0
    for f in [a for a in sys.argv[1:] if not a.startswith("--")]:
        if f.endswith(".css"):
            ko, n = controlla_css(open(f, encoding="utf-8").read(), os.path.basename(f), os.path.getsize(f)), ""
        else:
            ko, n = controlla(f, testi)
            n = f"  parole_main={n}"
        print(f"{'OK ' if not ko else 'KO '} {f}{n}" + ("".join(f"\n     - {k}" for k in ko)))
        errori += bool(ko)
    sys.exit(1 if errori else 0)
