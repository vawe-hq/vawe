// Google Search Console search analytics with a service-account key. No dependency, no OAuth screen.
import fs from 'node:fs';
import crypto from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function signedJwt(key) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${head}.${claim}`);
  return `${head}.${claim}.${b64url(signer.sign(key.private_key))}`;
}

/** A client for one property. Throws a message without the key content. */
export async function gscClient(keyPath, site) {
  const key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedJwt(key) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`GSC token request failed (${res.status})`);
  const { access_token: token } = await res.json();
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
  return {
    async query({ start, end, dimensions, rowLimit = 1000 }) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ startDate: start, endDate: end, dimensions, rowLimit }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error(`GSC query ${dimensions.join('+')} failed (${r.status})`);
      return (await r.json()).rows ?? [];
    },
  };
}
