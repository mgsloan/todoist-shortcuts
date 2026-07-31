#!/usr/bin/env python3
"""Serves src/ over http://localhost:8765 with CORS enabled.

This exists so that the in-development version of the extension can be
injected into a live Todoist tab without installing the extension.  See
CLAUDE.md ("Testing against a live Todoist tab") for how it is used.
"""

import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, 'src')


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    handler = functools.partial(Handler, directory=SRC)
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), handler) as httpd:
        print('serving %s at http://localhost:%d' % (SRC, PORT))
        httpd.serve_forever()
