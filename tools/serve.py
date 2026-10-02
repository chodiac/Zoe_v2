"""Local preview server for ZOE BY AZ v2 (static site at project root).

    python tools/serve.py [port]      (default 5198) -> http://localhost:5198/
Dev flags: ?motion (force full motion when the browser reports reduced motion),
?raw (native scroll, no Lenis).
"""
import functools
import http.server
import socketserver
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


Handler.extensions_map.update({".js": "text/javascript", ".mjs": "text/javascript", ".webp": "image/webp",
                               ".glb": "model/gltf-binary", ".svg": "image/svg+xml"})

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5198
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), functools.partial(Handler, directory=str(SITE))) as httpd:
        print(f"ZOE BY AZ v2 -> http://localhost:{port}/")
        httpd.serve_forever()
