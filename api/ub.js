const crypto = require('crypto');

const USER = 'root';
const PASSWORD_SHA256 = '3ec9fa8689c345fdfd015053534e34077d820b40b4171aa1414bc614e2890a77';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_SECONDS = 60 * 15;
const LOGIN_MAX_ATTEMPTS = 10;
const MAX_TODOS = 500;

function redis(...command) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  return fetch(UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify(command),
  }).then(r => r.json()).then(({ result }) => result);
}

function passwordMatches(password) {
  const given = crypto.createHash('sha256').update('ub:' + String(password)).digest();
  const expected = Buffer.from(PASSWORD_SHA256, 'hex');
  return crypto.timingSafeEqual(given, expected);
}

async function login(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const attemptsKey = `ub-login-attempts:${ip}`;
  const attempts = await redis('INCR', attemptsKey);
  if (attempts === 1) await redis('EXPIRE', attemptsKey, LOGIN_WINDOW_SECONDS);
  if (attempts > LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ error: 'Too many attempts, try again later' });
  }

  const { username, password } = req.body || {};
  if (username !== USER || !passwordMatches(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await redis('SET', `ub-session:${token}`, '1', 'EX', SESSION_TTL_SECONDS);
  return res.json({ token });
}

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const valid = await redis('GET', `ub-session:${token}`);
  if (!valid) return null;
  await redis('EXPIRE', `ub-session:${token}`, SESSION_TTL_SECONDS);
  return token;
}

function sanitizeTodos(todos) {
  if (!Array.isArray(todos) || todos.length > MAX_TODOS) return null;
  const clean = [];
  for (const t of todos) {
    if (!t || typeof t.text !== 'string' || !t.text.trim()) return null;
    clean.push({
      id: String(t.id || '').slice(0, 40),
      text: t.text.slice(0, 500),
      done: Boolean(t.done),
      created: Number(t.created) || 0,
      kind: t.kind === 'daily' ? 'daily' : 'global',
      doneOn: typeof t.doneOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.doneOn) ? t.doneOn : null,
    });
  }
  return clean;
}

module.exports = async function handler(req, res) {
  const { action } = req.query;
  try {
    if (action === 'login' && req.method === 'POST') return await login(req, res);

    const token = await authenticate(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    if (action === 'logout' && req.method === 'POST') {
      await redis('DEL', `ub-session:${token}`);
      return res.json({ ok: true });
    }

    if (action === 'fitness' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-fitness');
      return res.json({ fitness: raw ? JSON.parse(raw) : null });
    }

    if (action === 'french' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-french');
      return res.json({ french: raw ? JSON.parse(raw) : null });
    }

    if (action === 'todos' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-todos');
      return res.json({ todos: raw ? JSON.parse(raw) : [] });
    }

    if (action === 'todos' && req.method === 'PUT') {
      const todos = sanitizeTodos((req.body || {}).todos);
      if (!todos) return res.status(400).json({ error: 'Invalid todos' });
      await redis('SET', 'ub-todos', JSON.stringify(todos));
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
