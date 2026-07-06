const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3737;
const ROOT = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

const MEDIA = [
  'blu', 'dvd', '4k', 'vhs', 'laserdisc', 'betamax', 'hddvd',
  'cd', 'vinyl', 'cassette', '8track',
  'book', 'manga'
];

const dataFile = (media) => path.join(DATA_DIR, `${media}.json`);
const SAMPLE_FILE = path.join(DATA_DIR, 'sample-data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const media of MEDIA) {
    if (!fs.existsSync(dataFile(media))) {
      fs.writeFileSync(dataFile(media), JSON.stringify({ entries: [] }, null, 2));
    }
  }
}

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/testmode') {
    if (req.method !== 'POST') return send(res, 405, 'method not allowed');
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 10_000) req.destroy(); });
    req.on('end', () => {
      let on;
      try {
        on = JSON.parse(body).on;
        if (typeof on !== 'boolean') throw new Error('bad shape');
      } catch {
        return send(res, 400, '{"ok":false,"error":"invalid payload"}', MIME['.json']);
      }

      ensureData();
      let samples;
      try {
        samples = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8'));
      } catch {
        return send(res, 500, '{"ok":false,"error":"sample data missing"}', MIME['.json']);
      }

      const results = {};
      for (const media of MEDIA) {
        const file = dataFile(media);
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const real = data.entries.filter((e) => !e.sample);
        if (on) {
          const sampleEntries = (samples[media] || []).map((e, i) => ({
            ...e,
            id: `sample-${media}-${i}`,
            sample: true
          }));
          data.entries = [...real, ...sampleEntries];
          results[media] = sampleEntries.length;
        } else {
          results[media] = data.entries.length - real.length;
          data.entries = real;
        }
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
      }
      send(res, 200, JSON.stringify({ ok: true, on, results }), MIME['.json']);
    });
    return;
  }

  if (url.pathname === '/api/data') {
    const media = url.searchParams.get('media') || 'blu';
    if (!MEDIA.includes(media)) {
      return send(res, 400, '{"ok":false,"error":"unknown media"}', MIME['.json']);
    }
    if (req.method === 'GET') {
      ensureData();
      return send(res, 200, fs.readFileSync(dataFile(media)), MIME['.json']);
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 10_000_000) req.destroy(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data || !Array.isArray(data.entries)) throw new Error('bad shape');
          ensureData();
          fs.writeFileSync(dataFile(media), JSON.stringify(data, null, 2));
          send(res, 200, '{"ok":true}', MIME['.json']);
        } catch {
          send(res, 400, '{"ok":false,"error":"invalid payload"}', MIME['.json']);
        }
      });
      return;
    }
    return send(res, 405, 'method not allowed');
  }

  if (req.method !== 'GET') return send(res, 405, 'method not allowed');

  let filePath = path.normalize(path.join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'forbidden');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, 'not found');

  const ext = path.extname(filePath).toLowerCase();
  send(res, 200, fs.readFileSync(filePath), MIME[ext] || 'application/octet-stream');
});

ensureData();
server.listen(PORT, () => {
  console.log(`medialog running at http://localhost:${PORT}`);
  console.log(`data dir: ${DATA_DIR}`);
});
