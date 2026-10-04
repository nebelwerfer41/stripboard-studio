#!/bin/sh
cd "$(dirname "$0")" || exit 1
python3 - <<'PY'
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from webbrowser import open as open_browser

with ThreadingHTTPServer(('127.0.0.1', 0), SimpleHTTPRequestHandler) as server:
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Stripboard Studio: {url}', flush=True)
    if os.environ.get('STRIPBOARD_NO_BROWSER') != '1':
        open_browser(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
PY
