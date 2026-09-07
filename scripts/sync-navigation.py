"""Keep the site's static navigation consistent. Run after adding a new page."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = [("services", "Services"), ("products", "Products"), ("research", "Research"), ("learn", "Learn & play"), ("company", "About"), ("contact", "Contact")]

def navigation(page):
    nested = page.parent.name == "pages"
    home = "../index.html" if nested else "./index.html"
    asset = "../src/assets/" if nested else "./src/assets/"
    prefix = "./" if nested else "./pages/"
    current = page.stem
    links = "".join(f'<a class="nav-link{" is-current" if current == key else ""}" href="{prefix}{key}.html"{chr(32) + "aria-current=" + chr(34) + "page" + chr(34) if current == key else ""}>{label}</a>' for key, label in PAGES)
    brand = f'<a class="brand" href="{home}" aria-label="Atriksha home"><img class="brand-icon" src="{asset}atriksha-mark.svg" alt=""><span class="brand-name">atriksha<span class="brand-dot">.</span></span></a>'
    quote_current = ' aria-current="page"' if current == "quotation" else ""
    header = f'''<header class="site-header"><nav class="nav-shell container" aria-label="Main navigation">{brand}<div class="nav-links" id="main-navigation">{links}</div><div class="header-actions"><div class="theme-picker"><button class="theme-toggle" type="button" data-theme-toggle aria-label="Background theme: Midnight" aria-expanded="false" aria-controls="color-theme-panel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/></svg><span class="theme-toggle-label">Theme</span></button><div class="theme-panel" id="color-theme-panel" data-theme-panel role="group" aria-label="Background theme" hidden></div></div><a class="button button-small button-primary nav-quotation" href="{prefix}quotation.html"{quote_current}><span class="quote-label-full">Get quotation</span><span class="quote-label-short">Quote</span> <span aria-hidden="true">↗</span></a><button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="main-navigation"><span></span><span></span></button></div></nav></header>'''
    footer = f'''<footer class="site-footer"><div class="container"><div class="footer-top"><div>{brand}<p>Engineering, made practical.<br>New Delhi, India.</p></div><nav class="footer-links" aria-label="Footer navigation"><div><span>GET STARTED</span><a href="{prefix}services.html">Services</a><a href="{prefix}quotation.html">Get a quotation</a><a href="{prefix}contact.html">Contact us</a></div><div><span>EXPLORE</span><a href="{prefix}research.html">Research</a><a href="{prefix}products.html">Products</a><a href="{prefix}learn.html">Learn through games</a><a href="{prefix}playground.html">Interactive demos</a></div><div><span>ATRIKSHA</span><a href="{prefix}company.html">About us</a><a href="{prefix}career.html">Careers</a><a href="mailto:info@atriksha.com">info@atriksha.com ↗</a><a href="tel:+918770423437">+91 87704 23437</a></div></nav></div><div class="footer-bottom"><p>© <span data-year>2026</span> Atriksha Engineering Solutions Pvt Ltd.</p><button type="button" class="motion-toggle" data-motion-toggle aria-pressed="false" aria-label="Pause animations"><span class="motion-symbol" aria-hidden="true"></span><span data-motion-label>Pause motion</span></button></div></div></footer>'''
    return header, footer

def sync(page):
    text = page.read_text()
    if '<header class="site-header"' not in text:
        return
    header, footer = navigation(page)
    text, headers = re.subn(r'<header class="site-header"[^>]*>.*?</header>', header, text, count=1, flags=re.S)
    text, footers = re.subn(r'<footer class="site-footer"[^>]*>.*?</footer>', footer, text, count=1, flags=re.S)
    if headers != 1 or footers != 1:
        raise ValueError(f"Expected one shared header/footer in {page}")
    src = "../src/" if page.parent.name == "pages" else "./src/"
    if 'src/scripts/appearance.js' not in text:
        text = text.replace('<meta charset="UTF-8"', f'<script src="{src}scripts/appearance.js"></script>\n    <meta charset="UTF-8"', 1)
    if 'src/styles/themes.css' not in text:
        text = text.replace('</head>', f'<link rel="stylesheet" href="{src}styles/themes.css">\n  </head>', 1)
    page.write_text(text)

if __name__ == "__main__":
    import sys
    selected = [ROOT / name for name in sys.argv[1:]] if len(sys.argv) > 1 else [ROOT / "index.html", *sorted((ROOT / "pages").glob("*.html"))]
    for page in selected:
        sync(page)
        print(page.relative_to(ROOT))
