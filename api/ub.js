const crypto = require('crypto');

const USER = 'root';
const PASSWORD_SHA256 = '53736ddf608f1cda5220bfff8c7d601988d707c0d7e80d7ec6caacc2f942d5ce';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_SECONDS = 60 * 15;
const LOGIN_MAX_ATTEMPTS = 10;
const MAX_TODOS = 500;
const MAX_WEEK_GOALS = 10;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PROJECT_RE = /^[a-z][a-z0-9-]{0,23}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;

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

function normalizeCalDone(map) {
  const result = {};
  for (const [date, value] of Object.entries(map)) {
    result[date] = Array.isArray(value)
      ? Object.fromEntries(value.map(key => [key, 'done']))
      : value;
  }
  return result;
}

async function readTodos() {
  const raw = await redis('GET', 'ub-todos');
  return raw ? JSON.parse(raw) : [];
}

function writeTodos(todos) {
  return redis('SET', 'ub-todos', JSON.stringify(todos));
}

async function readWeekGoals() {
  const raw = await redis('GET', 'ub-week-goals');
  return raw ? JSON.parse(raw) : null;
}

function writeWeekGoals(weekGoals) {
  return redis('SET', 'ub-week-goals', JSON.stringify(weekGoals));
}

function cleanGoalText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
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

    if (action === 'finance' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-finance');
      return res.json({ finance: raw ? JSON.parse(raw) : null });
    }

    if (action === 'goals' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-goals');
      return res.json({ goals: raw ? JSON.parse(raw) : null });
    }

    if (action === 'projects' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-projects');
      return res.json({ projects: raw ? JSON.parse(raw) : null });
    }

    if (action === 'ventures' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-ventures');
      return res.json({ ventures: raw ? JSON.parse(raw) : null });
    }

    if (action === 'calendar' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-calendar');
      return res.json({ calendar: raw ? JSON.parse(raw) : null });
    }

    if (action === 'calendar-done' && req.method === 'GET') {
      const raw = await redis('GET', 'ub-calendar-done');
      return res.json({ done: normalizeCalDone(raw ? JSON.parse(raw) : {}) });
    }

    if (action === 'calendar-done' && req.method === 'POST') {
      const body = req.body || {};
      const { date, key } = body;
      const state = body.state !== undefined ? body.state : (body.done ? 'done' : 'todo');
      if (!DATE_RE.test(String(date)) || typeof key !== 'string' || !key || key.length > 400
          || !['todo', 'doing', 'done'].includes(state)) {
        return res.status(400).json({ error: 'Invalid event' });
      }
      const raw = await redis('GET', 'ub-calendar-done');
      const map = normalizeCalDone(raw ? JSON.parse(raw) : {});
      const day = map[date] || {};
      if (state === 'todo') delete day[key];
      else day[key] = state;
      if (Object.keys(day).length > 200) {
        return res.status(400).json({ error: 'Too many crossed events' });
      }
      map[date] = day;
      const cutoff = new Date(new Date(`${date}T12:00:00Z`).getTime() - 8 * 86400000)
        .toISOString().slice(0, 10);
      for (const dayKey of Object.keys(map)) {
        if (dayKey < cutoff || Object.keys(map[dayKey]).length === 0) delete map[dayKey];
      }
      await redis('SET', 'ub-calendar-done', JSON.stringify(map));
      return res.json({ done: map });
    }

    if (action === 'week-goals' && req.method === 'GET') {
      return res.json({ weekGoals: await readWeekGoals() });
    }

    if (action === 'week-goals' && req.method === 'PUT') {
      const week = String((req.body || {}).week || '');
      if (!WEEK_RE.test(week)) return res.status(400).json({ error: 'Invalid week' });
      const weekGoals = (await readWeekGoals()) || { goals: [] };
      weekGoals.week = week;
      weekGoals.goals = weekGoals.goals.filter(g => !g.done);
      await writeWeekGoals(weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'week-goals' && req.method === 'POST') {
      const text = cleanGoalText((req.body || {}).text);
      if (!text) return res.status(400).json({ error: 'Invalid goal' });
      const weekGoals = await readWeekGoals();
      if (!weekGoals || !weekGoals.week) return res.status(400).json({ error: 'No week started' });
      if (weekGoals.goals.length >= MAX_WEEK_GOALS) {
        return res.status(400).json({ error: 'Too many goals' });
      }
      weekGoals.goals.push({ id: crypto.randomUUID(), text, done: false });
      await writeWeekGoals(weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'week-goals' && req.method === 'PATCH') {
      const { id, done, text } = req.body || {};
      const weekGoals = await readWeekGoals();
      const goal = weekGoals && weekGoals.goals.find(g => g.id === id);
      if (!goal) return res.status(404).json({ error: 'Not found' });
      if (done !== undefined) goal.done = Boolean(done);
      if (text !== undefined) {
        const clean = cleanGoalText(text);
        if (!clean) return res.status(400).json({ error: 'Invalid goal' });
        goal.text = clean;
      }
      await writeWeekGoals(weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'week-goals' && req.method === 'DELETE') {
      const id = String(req.query.id || '');
      const weekGoals = await readWeekGoals();
      if (!weekGoals) return res.status(404).json({ error: 'Not found' });
      const remaining = weekGoals.goals.filter(g => g.id !== id);
      if (remaining.length === weekGoals.goals.length) {
        return res.status(404).json({ error: 'Not found' });
      }
      weekGoals.goals = remaining;
      await writeWeekGoals(weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'todos' && req.method === 'GET') {
      return res.json({ todos: await readTodos() });
    }

    if (action === 'todos' && req.method === 'POST') {
      const body = req.body || {};
      const text = typeof body.text === 'string'
        ? body.text.replace(/\s+/g, ' ').trim().slice(0, 500)
        : '';
      if (!text) return res.status(400).json({ error: 'Invalid todo' });
      if (body.project != null && !PROJECT_RE.test(String(body.project))) {
        return res.status(400).json({ error: 'Invalid project' });
      }
      if (body.due != null && !DATE_RE.test(String(body.due))) {
        return res.status(400).json({ error: 'Invalid due' });
      }
      const todos = await readTodos();
      if (todos.length >= MAX_TODOS) return res.status(400).json({ error: 'Too many todos' });
      const todo = {
        id: crypto.randomUUID(),
        text,
        state: 'todo',
        done: false,
        created: Date.now(),
        kind: body.kind === 'daily' ? 'daily' : 'global',
        doneOn: null,
      };
      if (body.project != null) todo.project = body.project;
      if (body.due != null) todo.due = body.due;
      todos.unshift(todo);
      await writeTodos(todos);
      return res.json({ todos });
    }

    if (action === 'todos' && req.method === 'PATCH') {
      const { id, state, doneOn, project, due } = req.body || {};
      const todos = await readTodos();
      const todo = todos.find(t => t.id === id);
      if (!todo) return res.status(404).json({ error: 'Not found' });
      if (state !== undefined) {
        if (!['todo', 'doing', 'done'].includes(state)) {
          return res.status(400).json({ error: 'Invalid state' });
        }
        todo.state = state;
        todo.done = state === 'done';
      }
      if (doneOn !== undefined) {
        if (doneOn !== null && !DATE_RE.test(String(doneOn))) {
          return res.status(400).json({ error: 'Invalid doneOn' });
        }
        todo.doneOn = doneOn;
      }
      if (project !== undefined) {
        if (project !== null && !PROJECT_RE.test(String(project))) {
          return res.status(400).json({ error: 'Invalid project' });
        }
        if (project === null) delete todo.project;
        else todo.project = project;
      }
      if (due !== undefined) {
        if (due !== null && !DATE_RE.test(String(due))) {
          return res.status(400).json({ error: 'Invalid due' });
        }
        if (due === null) delete todo.due;
        else todo.due = due;
      }
      await writeTodos(todos);
      return res.json({ todos });
    }

    if (action === 'todos' && req.method === 'DELETE') {
      const id = String(req.query.id || '');
      const todos = await readTodos();
      const remaining = todos.filter(t => t.id !== id);
      if (remaining.length === todos.length) return res.status(404).json({ error: 'Not found' });
      await writeTodos(remaining);
      return res.json({ todos: remaining });
    }

    if (action === 'todos' && req.method === 'PUT') {
      const order = (req.body || {}).order;
      if (!Array.isArray(order) || order.length > MAX_TODOS || order.some(x => typeof x !== 'string')) {
        return res.status(400).json({ error: 'Invalid order' });
      }
      const pos = new Map(order.map((id, i) => [id, i]));
      const todos = await readTodos();
      const known = todos.filter(t => pos.has(t.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
      const unknown = todos.filter(t => !pos.has(t.id));
      const reordered = [...unknown, ...known];
      await writeTodos(reordered);
      return res.json({ todos: reordered });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
