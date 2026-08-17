const crypto = require('crypto');

const USER = 'root';
const PASSWORD_SHA256 = '53736ddf608f1cda5220bfff8c7d601988d707c0d7e80d7ec6caacc2f942d5ce';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_SECONDS = 60 * 15;
const LOGIN_MAX_ATTEMPTS = 10;
const MAX_CARDS = 1500;
const MAX_WEEK_GOALS = 10;
const MAX_TEXT = 500;
const MAX_DESCRIPTION = 5000;
const MAX_CHECKLIST = 50;
const ARCHIVE_AFTER_DAYS = 7;
const TZ = 'America/Sao_Paulo';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const PROJECT_RE = /^[a-z][a-z0-9-]{0,23}$/;
const PREFIX_RE = /^[A-Z][A-Z0-9]{0,7}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;
const COLUMNS = ['backlog', 'todo', 'doing', 'done'];
const KINDS = ['task', 'routine', 'auto-routine'];
const STATUSES = ['active', 'paused', 'archived'];
const SIGNALS = ['food', 'weighin', 'anki', 'agares', 'training', 'stolas_low', 'ig'];

function redis(...command) {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  return fetch(UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    body: JSON.stringify(command),
  }).then(r => r.json()).then(({ result }) => result);
}

async function readJson(key, fallback) {
  const raw = await redis('GET', key);
  return raw ? JSON.parse(raw) : fallback;
}

function writeJson(key, value) {
  return redis('SET', key, JSON.stringify(value));
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

function isBotToken(token) {
  const bot = process.env.UB_BOT_TOKEN || '';
  if (!bot || bot.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(bot));
}

async function authenticate(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  if (isBotToken(token)) return 'bot';
  const valid = await redis('GET', `ub-session:${token}`);
  if (!valid) return null;
  await redis('EXPIRE', `ub-session:${token}`, SESSION_TTL_SECONDS);
  return token;
}

function localToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now);
}

function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dayOfMonth(iso) {
  return Number(iso.slice(8, 10));
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isoFromMs(ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms));
}

function cleanText(text, max = MAX_TEXT) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanGoalText(text) {
  return cleanText(text, 200);
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

function normalizeChecklist(list) {
  if (!Array.isArray(list)) return null;
  const items = [];
  for (const raw of list.slice(0, MAX_CHECKLIST)) {
    if (!raw || typeof raw !== 'object') return null;
    const text = cleanText(raw.text, 200);
    if (!text) return null;
    items.push({
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : crypto.randomUUID(),
      text,
      done: Boolean(raw.done),
    });
  }
  return items;
}

function normalizeCard(raw, index) {
  const legacyState = raw.state === 'doing' ? 'doing'
    : (raw.state === 'done' || raw.done === true) ? 'done' : 'todo';
  const column = COLUMNS.includes(raw.column) ? raw.column : legacyState;
  const kind = raw.kind === 'daily' ? 'routine' : KINDS.includes(raw.kind) ? raw.kind : 'task';
  const date = DATE_RE.test(String(raw.date || '')) ? raw.date
    : DATE_RE.test(String(raw.due || '')) ? raw.due : null;
  const doneOn = DATE_RE.test(String(raw.doneOn || '')) ? raw.doneOn : null;
  return {
    id: String(raw.id),
    text: typeof raw.text === 'string' ? raw.text : '',
    kind,
    project: raw.project && PROJECT_RE.test(String(raw.project)) ? raw.project : null,
    column,
    date,
    expires: Boolean(raw.expires),
    key: typeof raw.key === 'string' && raw.key ? raw.key : null,
    description: typeof raw.description === 'string' ? raw.description : '',
    checklist: normalizeChecklist(raw.checklist) || [],
    template: typeof raw.template === 'string' && raw.template ? raw.template : null,
    signal: typeof raw.signal === 'string' && raw.signal ? raw.signal : null,
    order: typeof raw.order === 'number' ? raw.order : index,
    todayOrder: typeof raw.todayOrder === 'number' ? raw.todayOrder : null,
    created: typeof raw.created === 'number' ? raw.created : Date.now(),
    doneOn,
    doneVia: ['tap', 'expiry', 'signal'].includes(raw.doneVia) ? raw.doneVia : (column === 'done' ? 'tap' : null),
    journaled: Boolean(raw.journaled),
  };
}

function serializeCard(card) {
  return {
    ...card,
    state: card.column === 'backlog' ? 'todo' : card.column,
    done: card.column === 'done',
  };
}

function legacyView(card) {
  return { ...serializeCard(card), due: card.date };
}

function dedupeSpawned(cards) {
  const seen = new Set();
  const kept = [];
  let dropped = false;
  for (const card of [...cards].sort((a, b) => a.created - b.created)) {
    if (card.template && card.date) {
      const key = `${card.template}|${card.date}`;
      if (seen.has(key)) {
        dropped = true;
        continue;
      }
      seen.add(key);
    }
    kept.push(card);
  }
  if (!dropped) return { cards, dropped };
  const keptIds = new Set(kept.map(c => c.id));
  return { cards: cards.filter(c => keptIds.has(c.id)), dropped };
}

async function readCards() {
  const raw = await readJson('ub-todos', []);
  const normalized = raw.map((item, i) => normalizeCard(item, i));
  return dedupeSpawned(normalized).cards;
}

function writeCards(cards) {
  return writeJson('ub-todos', cards.map(serializeCard));
}

function emptyRegistry() {
  return { updated: null, lastRollover: null, projects: [], away: [] };
}

function normalizeTemplate(raw) {
  const rule = raw.rule && typeof raw.rule === 'object' ? raw.rule : { type: 'daily' };
  return {
    id: String(raw.id),
    title: cleanText(raw.title, 200),
    kind: raw.kind === 'auto-routine' ? 'auto-routine' : 'routine',
    rule: rule.type === 'weekdays'
      ? { type: 'weekdays', days: Array.isArray(rule.days) ? rule.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [] }
      : rule.type === 'monthly'
        ? { type: 'monthly', dom: Number.isInteger(rule.dom) ? rule.dom : 1 }
        : { type: 'daily' },
    whileAway: Boolean(raw.whileAway),
    signal: raw.kind === 'auto-routine' && SIGNALS.includes(raw.signal) ? raw.signal : null,
    mode: raw.kind === 'auto-routine' ? (raw.mode === 'on-signal' ? 'on-signal' : 'always') : null,
  };
}

function normalizeProject(raw, index) {
  return {
    slug: String(raw.slug),
    title: cleanText(raw.title, 80) || String(raw.slug),
    prefix: PREFIX_RE.test(String(raw.prefix || '')) ? raw.prefix : defaultPrefix(String(raw.slug)),
    note: cleanText(raw.note, 200),
    status: STATUSES.includes(raw.status) ? raw.status : 'active',
    order: typeof raw.order === 'number' ? raw.order : index,
    counter: Number.isInteger(raw.counter) && raw.counter >= 0 ? raw.counter : 0,
    templates: Array.isArray(raw.templates) ? raw.templates.map(normalizeTemplate) : [],
  };
}

function normalizeRegistry(raw) {
  const registry = raw && typeof raw === 'object' ? raw : emptyRegistry();
  return {
    updated: registry.updated || null,
    lastRollover: DATE_RE.test(String(registry.lastRollover || '')) ? registry.lastRollover : null,
    projects: (Array.isArray(registry.projects) ? registry.projects : [])
      .filter(p => p && PROJECT_RE.test(String(p.slug)))
      .map(normalizeProject),
    away: (Array.isArray(registry.away) ? registry.away : [])
      .filter(r => r && DATE_RE.test(String(r.start)) && DATE_RE.test(String(r.end)))
      .map(r => ({ start: r.start, end: r.end })),
  };
}

function defaultPrefix(slug) {
  const letters = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return /^[A-Z]/.test(letters) ? letters : `P${letters}`.slice(0, 8);
}

async function readRegistry() {
  return normalizeRegistry(await readJson('ub-board-registry', null));
}

function writeRegistry(registry) {
  registry.updated = new Date().toISOString();
  return writeJson('ub-board-registry', registry);
}

async function readSignals() {
  const raw = await readJson('ub-board-signals', null);
  if (!raw || !DATE_RE.test(String(raw.date || ''))) return null;
  return { date: raw.date, updated: raw.updated || null, signals: raw.signals && typeof raw.signals === 'object' ? raw.signals : {} };
}

function archiveKey(month) {
  return `ub-board-archive:${month}`;
}

function ruleHits(rule, iso) {
  if (!rule || rule.type === 'daily') return true;
  if (rule.type === 'weekdays') return rule.days.includes(weekdayOf(iso));
  if (rule.type === 'monthly') return dayOfMonth(iso) === rule.dom;
  return false;
}

function isAway(registry, iso) {
  return registry.away.some(r => r.start <= iso && iso <= r.end);
}

function signalValue(signals, name, today) {
  if (!signals || signals.date !== today || !name) return null;
  return Boolean(signals.signals[name]);
}

function inToday(card, today) {
  if (card.kind !== 'task') return card.date === today;
  if (card.column === 'done') return card.doneOn === today;
  return Boolean(card.date) && card.date <= today;
}

function findProject(registry, slug) {
  return registry.projects.find(p => p.slug === slug) || null;
}

function mintKey(project) {
  project.counter += 1;
  return `${project.prefix}-${project.counter}`;
}

function nextOrder(cards, project, column) {
  const orders = cards.filter(c => c.project === project && c.column === column).map(c => c.order);
  return orders.length ? Math.min(...orders) - 1 : 0;
}

function spawnedCard(template, project, today, cards) {
  return {
    id: crypto.randomUUID(),
    text: template.title,
    kind: template.kind,
    project: project.slug,
    column: 'todo',
    date: today,
    expires: false,
    key: null,
    description: '',
    checklist: [],
    template: template.id,
    signal: template.signal,
    order: nextOrder(cards, project.slug, 'todo'),
    todayOrder: null,
    created: Date.now(),
    doneOn: null,
    doneVia: null,
    journaled: false,
  };
}

function rollover(cards, registry, signals, today) {
  const before = JSON.stringify(cards);
  const archived = {};
  const cutoff = addDays(today, -ARCHIVE_AFTER_DAYS);

  for (const card of cards) {
    if (card.expires && card.date && card.date < today && card.column !== 'done') {
      card.column = 'done';
      card.doneOn = card.date;
      card.doneVia = 'expiry';
    }
  }

  const live = [];
  for (const card of cards) {
    let leaving = false;
    if (card.kind !== 'task') {
      leaving = Boolean(card.date) && card.date < today;
    } else if (card.column === 'done') {
      if (!card.doneOn) card.doneOn = isoFromMs(card.created);
      leaving = card.doneOn < cutoff;
    }
    if (leaving) {
      const month = (card.doneOn || card.date || isoFromMs(card.created)).slice(0, 7);
      (archived[month] = archived[month] || []).push(card);
    } else {
      live.push(card);
    }
  }
  cards = live;

  const away = isAway(registry, today);
  for (const project of registry.projects) {
    if (project.status !== 'active') continue;
    for (const template of project.templates) {
      if (!ruleHits(template.rule, today)) continue;
      if (away && !template.whileAway) continue;
      const exists = cards.some(c => c.template === template.id && c.date === today);
      if (exists) continue;
      if (template.kind === 'auto-routine' && template.mode === 'on-signal'
          && signalValue(signals, template.signal, today) !== true) continue;
      cards.push(spawnedCard(template, project, today, cards));
    }
  }

  for (const card of cards) {
    if (card.kind !== 'auto-routine' || card.date !== today) continue;
    const value = signalValue(signals, card.signal, today);
    if (value === true && card.column !== 'done') {
      card.column = 'done';
      card.doneOn = today;
      card.doneVia = 'signal';
    } else if (value === false && card.column === 'done' && card.doneVia === 'signal') {
      card.column = 'todo';
      card.doneOn = null;
      card.doneVia = null;
    }
  }

  for (const card of cards) {
    if (card.kind === 'task' && card.column === 'doing' && !card.date) card.date = today;
    if (card.todayOrder !== null && !inToday(card, today)) card.todayOrder = null;
  }

  const registryChanged = registry.lastRollover !== today;
  registry.lastRollover = today;
  return {
    cards,
    archived,
    cardsChanged: JSON.stringify(cards) !== before,
    registryChanged,
  };
}

async function persistRollover(result, registry) {
  const writes = [];
  if (result.cardsChanged) writes.push(writeCards(result.cards));
  if (result.registryChanged) writes.push(writeRegistry(registry));
  for (const [month, cards] of Object.entries(result.archived)) {
    const existing = await readJson(archiveKey(month), []);
    const ids = new Set(existing.map(c => c.id));
    for (const card of cards) if (!ids.has(card.id)) existing.push(serializeCard(card));
    writes.push(writeJson(archiveKey(month), existing));
  }
  await Promise.all(writes);
}

async function loadBoard() {
  const today = localToday();
  const [rawCards, registry, signals] = await Promise.all([readCards(), readRegistry(), readSignals()]);
  const result = rollover(rawCards, registry, signals, today);
  await persistRollover(result, registry);
  return { today, cards: result.cards, registry, signals };
}

function columnRank(column) {
  return column === 'doing' ? 0 : column === 'todo' ? 1 : column === 'backlog' ? 2 : 3;
}

function legacyList(cards, registry, today) {
  const projectOrder = new Map(
    [...registry.projects].sort((a, b) => a.order - b.order).map((p, i) => [p.slug, i]),
  );
  const rank = card => {
    if (card.kind !== 'task') return [2, 0, columnRank(card.column), card.todayOrder ?? card.order];
    if (!card.project) return [0, 0, columnRank(card.column), card.order];
    return [1, projectOrder.has(card.project) ? projectOrder.get(card.project) : 999, columnRank(card.column), card.order];
  };
  const visible = cards.filter(c => c.kind === 'task' || c.date === today);
  return visible
    .map(card => ({ card, r: rank(card) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.r[2] - b.r[2] || a.r[3] - b.r[3])
    .map(({ card }) => legacyView(card));
}

function applyDone(card, today, doneOn) {
  card.column = 'done';
  card.doneOn = doneOn || today;
  card.doneVia = card.doneVia === 'signal' ? 'signal' : 'tap';
}

function applyUndone(card, column) {
  card.column = column;
  card.doneOn = null;
  card.doneVia = null;
}

function moveColumn(card, column, today) {
  if (column === 'done') {
    applyDone(card, today, null);
    return;
  }
  if (card.column === 'done') applyUndone(card, column);
  card.column = column;
  if (column === 'doing' && !card.date) card.date = today;
  if (column === 'backlog') card.date = null;
}

function validateChecklist(body) {
  if (body.checklist === undefined) return { ok: true, value: undefined };
  const value = normalizeChecklist(body.checklist);
  return value ? { ok: true, value } : { ok: false };
}

async function handleCards(req, res, board) {
  const { cards, registry, today } = board;
  const respond = async (changed, extra = {}) => {
    if (changed) await writeCards(cards);
    return res.json({ cards: cards.map(serializeCard), ...extra });
  };

  if (req.method === 'POST') {
    const body = req.body || {};
    const text = cleanText(body.text);
    if (!text) return res.status(400).json({ error: 'Invalid card' });
    if (cards.length >= MAX_CARDS) return res.status(400).json({ error: 'Too many cards' });
    const project = body.project == null ? null : String(body.project);
    let target = null;
    if (project !== null) {
      target = findProject(registry, project);
      if (!target || target.status === 'archived') return res.status(400).json({ error: 'Invalid project' });
    }
    if (body.date != null && !DATE_RE.test(String(body.date))) return res.status(400).json({ error: 'Invalid date' });
    if (body.date != null && project === null) return res.status(400).json({ error: 'Date needs a project' });
    const checklist = validateChecklist(body);
    if (!checklist.ok) return res.status(400).json({ error: 'Invalid checklist' });
    const date = body.date == null ? null : body.date;
    const column = project === null ? 'todo'
      : date ? 'todo'
      : body.column === 'todo' ? 'todo' : 'backlog';
    const card = {
      id: crypto.randomUUID(),
      text,
      kind: 'task',
      project,
      column,
      date,
      expires: Boolean(body.expires),
      key: target ? mintKey(target) : null,
      description: typeof body.description === 'string' ? body.description.slice(0, MAX_DESCRIPTION) : '',
      checklist: checklist.value || [],
      template: null,
      signal: null,
      order: nextOrder(cards, project, column),
      todayOrder: null,
      created: Date.now(),
      doneOn: null,
      doneVia: null,
      journaled: false,
    };
    cards.push(card);
    if (target) await writeRegistry(registry);
    return respond(true, { card: serializeCard(card) });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const card = cards.find(c => c.id === body.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    if (card.kind === 'auto-routine') return res.status(400).json({ error: 'Read-only card' });
    const routineOnly = ['column', 'order', 'todayOrder', 'id'];
    if (card.kind === 'routine' && Object.keys(body).some(k => !routineOnly.includes(k))) {
      return res.status(400).json({ error: 'Routine cards accept only column and order' });
    }
    let registryChanged = false;

    if (body.text !== undefined) {
      const text = cleanText(body.text);
      if (!text) return res.status(400).json({ error: 'Invalid text' });
      card.text = text;
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string') return res.status(400).json({ error: 'Invalid description' });
      card.description = body.description.slice(0, MAX_DESCRIPTION);
    }
    const checklist = validateChecklist(body);
    if (!checklist.ok) return res.status(400).json({ error: 'Invalid checklist' });
    if (checklist.value !== undefined) card.checklist = checklist.value;
    if (body.expires !== undefined) card.expires = Boolean(body.expires);
    if (body.journaled !== undefined) card.journaled = Boolean(body.journaled);
    if (body.order !== undefined) {
      if (typeof body.order !== 'number') return res.status(400).json({ error: 'Invalid order' });
      card.order = body.order;
    }
    if (body.todayOrder !== undefined) {
      if (body.todayOrder !== null && typeof body.todayOrder !== 'number') {
        return res.status(400).json({ error: 'Invalid todayOrder' });
      }
      card.todayOrder = body.todayOrder;
    }
    if (body.project !== undefined) {
      if (body.project === null) {
        card.project = null;
        if (card.column === 'backlog') card.column = 'todo';
      } else {
        const target = findProject(registry, String(body.project));
        if (!target || target.status === 'archived') return res.status(400).json({ error: 'Invalid project' });
        const fromInbox = card.project === null;
        card.project = target.slug;
        if (card.kind === 'task' && !card.key) {
          card.key = mintKey(target);
          registryChanged = true;
        }
        if (fromInbox && card.column !== 'done') card.column = card.date ? 'todo' : 'backlog';
        card.order = nextOrder(cards.filter(c => c !== card), card.project, card.column);
      }
    }
    if (body.date !== undefined) {
      if (body.date !== null && !DATE_RE.test(String(body.date))) return res.status(400).json({ error: 'Invalid date' });
      card.date = body.date;
      if (card.date && card.column === 'backlog') card.column = 'todo';
    }
    if (card.project === null && card.date) return res.status(400).json({ error: 'Date needs a project' });
    if (body.column !== undefined) {
      if (!COLUMNS.includes(body.column)) return res.status(400).json({ error: 'Invalid column' });
      if (body.column === 'backlog' && (card.project === null || card.kind !== 'task')) {
        return res.status(400).json({ error: 'Backlog needs a project task' });
      }
      if (body.column === 'doing' && card.project === null) {
        return res.status(400).json({ error: 'Doing needs a project' });
      }
      if (body.column !== card.column) {
        moveColumn(card, body.column, today);
        if (body.column === 'done' && body.doneOn !== undefined && DATE_RE.test(String(body.doneOn))) {
          card.doneOn = body.doneOn;
        }
      }
    }
    if (registryChanged) await writeRegistry(registry);
    return respond(true, { card: serializeCard(card) });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    const idx = cards.findIndex(c => c.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    cards.splice(idx, 1);
    return respond(true);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function applyOrder(group, order, field) {
  const pos = new Map(order.map((id, i) => [id, i]));
  const named = group.filter(c => pos.has(c.id)).sort((a, b) => pos.get(a.id) - pos.get(b.id));
  const unnamed = group.filter(c => !pos.has(c.id)).sort((a, b) => a[field] - b[field]);
  [...named, ...unnamed].forEach((card, i) => { card[field] = i; });
}

function validOrder(order) {
  return Array.isArray(order) && order.length <= MAX_CARDS && order.every(x => typeof x === 'string');
}

async function handleRegistry(req, res, action, board) {
  const { registry } = board;
  const respond = async () => {
    await writeRegistry(registry);
    return res.json({ registry });
  };

  if (action === 'projects' && req.method === 'POST') {
    const body = req.body || {};
    const slug = String(body.slug || '');
    if (!PROJECT_RE.test(slug) || findProject(registry, slug)) return res.status(400).json({ error: 'Invalid slug' });
    const prefix = body.prefix ? String(body.prefix).toUpperCase() : defaultPrefix(slug);
    if (!PREFIX_RE.test(prefix) || registry.projects.some(p => p.prefix === prefix)) {
      return res.status(400).json({ error: 'Invalid prefix' });
    }
    const title = cleanText(body.title, 80) || slug;
    const order = registry.projects.length ? Math.max(...registry.projects.map(p => p.order)) + 1 : 0;
    registry.projects.push({ slug, title, prefix, note: cleanText(body.note, 200), status: 'active', order, counter: 0, templates: [] });
    return respond();
  }

  if (action === 'projects' && req.method === 'PATCH') {
    const body = req.body || {};
    const project = findProject(registry, String(body.slug || ''));
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (body.title !== undefined) {
      const title = cleanText(body.title, 80);
      if (!title) return res.status(400).json({ error: 'Invalid title' });
      project.title = title;
    }
    if (body.note !== undefined) project.note = cleanText(body.note, 200);
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ error: 'Invalid status' });
      project.status = body.status;
    }
    if (body.order !== undefined) {
      if (typeof body.order !== 'number') return res.status(400).json({ error: 'Invalid order' });
      project.order = body.order;
    }
    if (body.prefix !== undefined) {
      const prefix = String(body.prefix).toUpperCase();
      if (project.counter > 0) return res.status(400).json({ error: 'Prefix is immutable once a key exists' });
      if (!PREFIX_RE.test(prefix) || registry.projects.some(p => p !== project && p.prefix === prefix)) {
        return res.status(400).json({ error: 'Invalid prefix' });
      }
      project.prefix = prefix;
    }
    return respond();
  }

  if (action === 'projects-order' && req.method === 'PUT') {
    const order = (req.body || {}).order;
    if (!validOrder(order)) return res.status(400).json({ error: 'Invalid order' });
    const pos = new Map(order.map((slug, i) => [slug, i]));
    const named = registry.projects.filter(p => pos.has(p.slug)).sort((a, b) => pos.get(a.slug) - pos.get(b.slug));
    const unnamed = registry.projects.filter(p => !pos.has(p.slug)).sort((a, b) => a.order - b.order);
    [...named, ...unnamed].forEach((p, i) => { p.order = i; });
    return respond();
  }

  if (action === 'templates' && ['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    const body = req.method === 'DELETE' ? req.query : (req.body || {});
    const project = findProject(registry, String(body.project || ''));
    if (!project) return res.status(404).json({ error: 'Not found' });
    if (req.method === 'POST') {
      const template = normalizeTemplate({ ...body, id: crypto.randomUUID() });
      if (!template.title) return res.status(400).json({ error: 'Invalid title' });
      if (template.kind === 'auto-routine' && !template.signal) return res.status(400).json({ error: 'Invalid signal' });
      project.templates.push(template);
      return respond();
    }
    const template = project.templates.find(t => t.id === String(body.id || ''));
    if (!template) return res.status(404).json({ error: 'Not found' });
    if (req.method === 'DELETE') {
      project.templates = project.templates.filter(t => t !== template);
      return respond();
    }
    const merged = normalizeTemplate({ ...template, ...body, id: template.id, kind: body.kind ?? template.kind });
    if (!merged.title) return res.status(400).json({ error: 'Invalid title' });
    if (merged.kind === 'auto-routine' && !merged.signal) return res.status(400).json({ error: 'Invalid signal' });
    Object.assign(template, merged);
    return respond();
  }

  if (action === 'away' && req.method === 'PUT') {
    const ranges = (req.body || {}).ranges;
    if (!Array.isArray(ranges) || ranges.length > 50) return res.status(400).json({ error: 'Invalid ranges' });
    const clean = [];
    for (const r of ranges) {
      if (!r || !DATE_RE.test(String(r.start)) || !DATE_RE.test(String(r.end)) || r.end < r.start) {
        return res.status(400).json({ error: 'Invalid ranges' });
      }
      clean.push({ start: r.start, end: r.end });
    }
    registry.away = clean.sort((a, b) => (a.start < b.start ? -1 : 1));
    return respond();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleLegacyTodos(req, res, board) {
  const { cards, registry, today } = board;
  const respond = async (changed) => {
    if (changed) await writeCards(cards);
    return res.json({ todos: legacyList(cards, registry, today) });
  };

  if (req.method === 'GET') return respond(false);

  if (req.method === 'POST') {
    const body = req.body || {};
    const text = cleanText(body.text);
    if (!text) return res.status(400).json({ error: 'Invalid todo' });
    if (body.project != null && !PROJECT_RE.test(String(body.project))) return res.status(400).json({ error: 'Invalid project' });
    if (body.due != null && !DATE_RE.test(String(body.due))) return res.status(400).json({ error: 'Invalid due' });
    if (cards.length >= MAX_CARDS) return res.status(400).json({ error: 'Too many todos' });
    const project = body.project != null ? String(body.project) : null;
    const target = project ? findProject(registry, project) : null;
    const date = body.due != null ? body.due : null;
    const column = project ? (date ? 'todo' : 'backlog') : 'todo';
    cards.push({
      id: crypto.randomUUID(),
      text,
      kind: 'task',
      project,
      column,
      date,
      expires: false,
      key: target ? mintKey(target) : null,
      description: '',
      checklist: [],
      template: null,
      signal: null,
      order: nextOrder(cards, project, column),
      todayOrder: null,
      created: Date.now(),
      doneOn: null,
      doneVia: null,
      journaled: false,
    });
    if (target) await writeRegistry(registry);
    return respond(true);
  }

  if (req.method === 'PATCH') {
    const { id, state, doneOn, project, due } = req.body || {};
    const card = cards.find(c => c.id === id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    if (state !== undefined) {
      if (!['todo', 'doing', 'done'].includes(state)) return res.status(400).json({ error: 'Invalid state' });
      if (state !== card.column) moveColumn(card, state, today);
    }
    if (doneOn !== undefined) {
      if (doneOn !== null && !DATE_RE.test(String(doneOn))) return res.status(400).json({ error: 'Invalid doneOn' });
      if (card.kind === 'routine') {
        if (doneOn) applyDone(card, today, doneOn);
        else if (card.column === 'done') applyUndone(card, 'todo');
      } else if (card.column === 'done' && doneOn) {
        card.doneOn = doneOn;
      }
    }
    if (project !== undefined) {
      if (project !== null && !PROJECT_RE.test(String(project))) return res.status(400).json({ error: 'Invalid project' });
      const target = project === null ? null : findProject(registry, project);
      const fromInbox = card.project === null;
      card.project = project;
      if (target && card.kind === 'task' && !card.key) {
        card.key = mintKey(target);
        await writeRegistry(registry);
      }
      if (project && fromInbox && card.column !== 'done') card.column = card.date ? 'todo' : 'backlog';
      if (!project && card.column === 'backlog') card.column = 'todo';
    }
    if (due !== undefined) {
      if (due !== null && !DATE_RE.test(String(due))) return res.status(400).json({ error: 'Invalid due' });
      card.date = due;
      if (card.date && card.column === 'backlog') card.column = 'todo';
    }
    return respond(true);
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    const idx = cards.findIndex(c => c.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    cards.splice(idx, 1);
    return respond(true);
  }

  if (req.method === 'PUT') {
    const order = (req.body || {}).order;
    if (!validOrder(order)) return res.status(400).json({ error: 'Invalid order' });
    const named = cards.filter(c => order.includes(c.id));
    const groups = new Map();
    for (const card of named) {
      const key = `${card.project}|${card.column}`;
      (groups.get(key) || groups.set(key, []).get(key)).push(card);
    }
    for (const [key] of groups) {
      const [project, column] = key.split('|');
      const group = cards.filter(c => String(c.project) === project && c.column === column);
      applyOrder(group, order, 'order');
    }
    return respond(true);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = async function handler(req, res) {
  const { action } = req.query;
  try {
    if (action === 'login' && req.method === 'POST') return await login(req, res);

    const token = await authenticate(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    if (action === 'logout' && req.method === 'POST') {
      if (token !== 'bot') await redis('DEL', `ub-session:${token}`);
      return res.json({ ok: true });
    }

    const passthrough = {
      fitness: 'ub-fitness',
      french: 'ub-french',
      finance: 'ub-finance',
      goals: 'ub-goals',
      projects: 'ub-projects',
      ventures: 'ub-ventures',
      calendar: 'ub-calendar',
      fisica3: 'ub-fisica3',
    };
    if (passthrough[action] && req.method === 'GET') {
      return res.json({ [action]: await readJson(passthrough[action], null) });
    }

    if (action === 'calendar-done' && req.method === 'GET') {
      return res.json({ done: normalizeCalDone(await readJson('ub-calendar-done', {})) });
    }

    if (action === 'calendar-done' && req.method === 'POST') {
      const body = req.body || {};
      const { date, key } = body;
      const state = body.state !== undefined ? body.state : (body.done ? 'done' : 'todo');
      if (!DATE_RE.test(String(date)) || typeof key !== 'string' || !key || key.length > 400
          || !['todo', 'doing', 'done'].includes(state)) {
        return res.status(400).json({ error: 'Invalid event' });
      }
      const map = normalizeCalDone(await readJson('ub-calendar-done', {}));
      const day = map[date] || {};
      if (state === 'todo') delete day[key];
      else day[key] = state;
      if (Object.keys(day).length > 200) {
        return res.status(400).json({ error: 'Too many crossed events' });
      }
      map[date] = day;
      const cutoff = addDays(date, -8);
      for (const dayKey of Object.keys(map)) {
        if (dayKey < cutoff || Object.keys(map[dayKey]).length === 0) delete map[dayKey];
      }
      await writeJson('ub-calendar-done', map);
      return res.json({ done: map });
    }

    if (action === 'week-goals' && req.method === 'GET') {
      return res.json({ weekGoals: await readJson('ub-week-goals', null) });
    }

    if (action === 'week-goals' && req.method === 'PUT') {
      const week = String((req.body || {}).week || '');
      if (!WEEK_RE.test(week)) return res.status(400).json({ error: 'Invalid week' });
      const weekGoals = (await readJson('ub-week-goals', null)) || { goals: [] };
      weekGoals.week = week;
      weekGoals.goals = weekGoals.goals.filter(g => !g.done);
      await writeJson('ub-week-goals', weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'week-goals' && req.method === 'POST') {
      const text = cleanGoalText((req.body || {}).text);
      if (!text) return res.status(400).json({ error: 'Invalid goal' });
      const weekGoals = await readJson('ub-week-goals', null);
      if (!weekGoals || !weekGoals.week) return res.status(400).json({ error: 'No week started' });
      if (weekGoals.goals.length >= MAX_WEEK_GOALS) {
        return res.status(400).json({ error: 'Too many goals' });
      }
      weekGoals.goals.push({ id: crypto.randomUUID(), text, done: false });
      await writeJson('ub-week-goals', weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'week-goals' && req.method === 'PATCH') {
      const { id, done, text } = req.body || {};
      const weekGoals = await readJson('ub-week-goals', null);
      const goal = weekGoals && weekGoals.goals.find(g => g.id === id);
      if (!goal) return res.status(404).json({ error: 'Not found' });
      if (done !== undefined) goal.done = Boolean(done);
      if (text !== undefined) {
        const clean = cleanGoalText(text);
        if (!clean) return res.status(400).json({ error: 'Invalid goal' });
        goal.text = clean;
      }
      await writeJson('ub-week-goals', weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'week-goals' && req.method === 'DELETE') {
      const id = String(req.query.id || '');
      const weekGoals = await readJson('ub-week-goals', null);
      if (!weekGoals) return res.status(404).json({ error: 'Not found' });
      const remaining = weekGoals.goals.filter(g => g.id !== id);
      if (remaining.length === weekGoals.goals.length) {
        return res.status(404).json({ error: 'Not found' });
      }
      weekGoals.goals = remaining;
      await writeJson('ub-week-goals', weekGoals);
      return res.json({ weekGoals });
    }

    if (action === 'archive' && req.method === 'GET') {
      const month = String(req.query.month || '');
      if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'Invalid month' });
      return res.json({ cards: await readJson(archiveKey(month), []) });
    }

    if (action === 'boards' && req.method === 'GET') {
      return res.json({ registry: await readRegistry() });
    }

    if (action === 'all' && req.method === 'GET') {
      const board = await loadBoard();
      const [weekGoals, calendar, calendarDone, goals] = await Promise.all([
        readJson('ub-week-goals', null),
        readJson('ub-calendar', null),
        readJson('ub-calendar-done', {}),
        readJson('ub-goals', null),
      ]);
      return res.json({
        today: board.today,
        now: new Date().toISOString(),
        cards: board.cards.map(serializeCard),
        registry: board.registry,
        signals: board.signals ? { date: board.signals.date, updated: board.signals.updated } : null,
        weekGoals,
        calendar,
        calendarDone: normalizeCalDone(calendarDone),
        notes: goals && goals.notes ? goals.notes : null,
      });
    }

    if (action === 'rollover' && req.method === 'POST') {
      const board = await loadBoard();
      return res.json({ today: board.today, cards: board.cards.map(serializeCard), registry: board.registry });
    }

    if (action === 'cards' && ['POST', 'PATCH', 'DELETE'].includes(req.method)) {
      return await handleCards(req, res, await loadBoard());
    }

    if (action === 'cards-order' && req.method === 'PUT') {
      const body = req.body || {};
      if (!validOrder(body.order) || !COLUMNS.includes(body.column)) {
        return res.status(400).json({ error: 'Invalid order' });
      }
      const project = body.project == null ? null : String(body.project);
      const board = await loadBoard();
      const group = board.cards.filter(c => c.project === project && c.column === body.column);
      applyOrder(group, body.order, 'order');
      await writeCards(board.cards);
      return res.json({ cards: board.cards.map(serializeCard) });
    }

    if (action === 'today-order' && req.method === 'PUT') {
      const body = req.body || {};
      if (!validOrder(body.order)) return res.status(400).json({ error: 'Invalid order' });
      const board = await loadBoard();
      const group = board.cards.filter(c => inToday(c, board.today) && c.column !== 'done');
      const pos = new Map(body.order.map((id, i) => [id, i]));
      for (const card of group) card.todayOrder = pos.has(card.id) ? pos.get(card.id) : card.todayOrder;
      await writeCards(board.cards);
      return res.json({ cards: board.cards.map(serializeCard) });
    }

    if (['projects', 'projects-order', 'templates', 'away'].includes(action) && req.method !== 'GET') {
      return await handleRegistry(req, res, action, await loadBoard());
    }

    if (action === 'todos') {
      return await handleLegacyTodos(req, res, await loadBoard());
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};
