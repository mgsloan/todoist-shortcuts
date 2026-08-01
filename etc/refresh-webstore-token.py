#!/usr/bin/env python3
"""Gets a new Chrome Web Store refresh token and stores it in secrets.json.

The refresh token in etc/secrets.json stops working every so often - Google
expires them after a week while the OAuth consent screen is in "Testing"
status - which makes `grunt webstore_upload` fail with invalid_grant.

Run this, open the URL it prints, and approve the request. The authorization
code comes back to a local server, is exchanged for a new refresh token, and
written back to etc/secrets.json. Nothing is printed except progress: the
secrets stay in the file.
"""

import http.server
import json
import os
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request

SECRETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'secrets.json')
SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
AUTH_URL = 'https://accounts.google.com/o/oauth2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

received = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        received.update({k: v[0] for k, v in query.items()})
        self.send_response(200)
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        done = 'code' in received
        self.wfile.write(b'Authorized, you can close this tab.' if done
                         else b'No code in the response.')
        threading.Thread(target=self.server.shutdown).start()

    def log_message(self, *args):
        pass


def main():
    secrets = json.load(open(SECRETS))
    redirect_uri = 'http://localhost:%d' % PORT
    params = {
        'client_id': secrets['chrome_client_id'],
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': SCOPE,
        # Both are needed to be given a refresh token rather than just an
        # access token.
        'access_type': 'offline',
        'prompt': 'consent',
    }
    print('Open this URL and approve the request:\n')
    print(AUTH_URL + '?' + urllib.parse.urlencode(params) + '\n')
    print('Waiting for the response on %s ...' % redirect_uri)

    with http.server.HTTPServer(('127.0.0.1', PORT), Handler) as server:
        server.serve_forever()

    if 'code' not in received:
        print('No authorization code received: %s' % received.get('error'))
        return 1

    data = urllib.parse.urlencode({
        'client_id': secrets['chrome_client_id'],
        'client_secret': secrets['chrome_client_secret'],
        'code': received['code'],
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri,
    }).encode()
    try:
        with urllib.request.urlopen(TOKEN_URL, data) as response:
            tokens = json.load(response)
    except urllib.error.HTTPError as e:
        body = json.load(e)
        print('Exchanging the code failed: %s - %s' %
              (body.get('error'), body.get('error_description')))
        return 1

    if 'refresh_token' not in tokens:
        print('No refresh token in the response, only: %s' %
              ', '.join(sorted(tokens)))
        return 1

    secrets['refresh_token'] = tokens['refresh_token']
    with open(SECRETS, 'w') as f:
        json.dump(secrets, f, indent=2)
        f.write('\n')
    os.chmod(SECRETS, 0o600)
    print('Wrote a new refresh token (%d chars) to %s' %
          (len(tokens['refresh_token']), SECRETS))
    return 0


if __name__ == '__main__':
    sys.exit(main())
