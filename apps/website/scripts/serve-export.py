"""Preview the exported Pages site on loopback, including its project path and 404."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import os

root = Path("out").resolve()
base = os.environ.get("NEXT_PUBLIC_BASE_PATH", "")
port = int(os.environ.get("PORT", "3037"))
assert root.is_dir(), "Build the website before previewing its export."

class Handler(SimpleHTTPRequestHandler):
    def route(self):
        path = urlsplit(self.path).path
        if base and not (path == base or path.startswith(base + "/")):
            self.send_error(404)
            return False
        if base:
            self.path = self.path[len(base):] or "/"
        return True

    def do_GET(self):
        if self.route():
            super().do_GET()

    def do_HEAD(self):
        if self.route():
            super().do_HEAD()

    def send_error(self, code, message=None, explain=None):
        if code == 404 and (root / "404.html").exists():
            content = (root / "404.html").read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(content)
        else:
            super().send_error(code, message, explain)

print(f"Mayfly static preview: http://127.0.0.1:{port}{base}/", flush=True)
ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(root))).serve_forever()
