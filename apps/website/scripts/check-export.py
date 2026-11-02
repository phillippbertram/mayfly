"""Validate a static export's local links/assets, including a GitHub Pages base path."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
import os
import json

root = Path("out").resolve()
base = os.environ.get("NEXT_PUBLIC_BASE_PATH", "")
errors = []
references = 0

class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"])
        for key in ["href", "src", "poster"]:
            if values.get(key):
                self.links.append(values[key])

pages = {}
for path in root.rglob("*.html"):
    parser = Links()
    parser.feed(path.read_text())
    pages[path] = parser

assert pages, "No HTML pages were exported."
for path, parser in pages.items():
    relative = path.relative_to(root).as_posix()
    current = base + "/" + (relative[:-10] if relative.endswith("index.html") else relative)
    for value in parser.links:
        if value.startswith(("http:", "https:", "mailto:", "tel:", "data:", "javascript:")):
            continue
        url = urlsplit(urljoin("https://filehop.invalid" + current, value))
        if url.hostname != "filehop.invalid":
            continue
        target_path = unquote(url.path)
        if base:
            if not (target_path == base or target_path.startswith(base + "/")):
                errors.append(f"{relative}: missing base path: {value}")
                continue
            target_path = target_path[len(base):]
        target = (root / target_path.lstrip("/")).resolve()
        if root not in target.parents and target != root:
            errors.append(f"{relative}: invalid local path: {value}")
            continue
        if target.is_dir():
            target /= "index.html"
        if not target.exists():
            errors.append(f"{relative}: missing file: {value}")
        elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
            errors.append(f"{relative}: missing anchor: {value}")
        references += 1
search_urls = set()
def inspect_index(value):
    if isinstance(value, dict):
        if isinstance(value.get("url"), str) and value["url"].startswith("/"):
            search_urls.add(value["url"])
        for item in value.values():
            inspect_index(item)
    elif isinstance(value, list):
        for item in value:
            inspect_index(item)

inspect_index(json.loads((root / "search-index.json").read_text()))
assert search_urls, "The static search index has no document routes."
for value in search_urls:
    url = urlsplit(value)
    if base and url.path.startswith(base + "/"):
        errors.append(f"Search index route must omit Next.js basePath to avoid double prefixes: {value}")
    target = root / unquote(url.path).lstrip("/")
    if target.is_dir():
        target /= "index.html"
    if not target.exists():
        errors.append(f"Search index points to a missing document: {value}")
    elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
        errors.append(f"Search index points to a missing anchor: {value}")

if errors:
    raise SystemExit("\n".join(sorted(set(errors))))
print(f"Verified {len(pages)} exported HTML pages, {references} local links/assets, and {len(search_urls)} search routes (base path: {base or '/'}).")
