const test = require('node:test');
const assert = require('node:assert/strict');

const store = new Map();
process.env.UPSTASH_REDIS_REST_URL = 'http://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 't';
process.env.UB_BOT_TOKEN = 'b'.repeat(64);

global.fetch = async (_url, init) => {
  const [cmd, key, value, ...rest] = JSON.parse(init.body);
  let result = null;
  if (cmd === 'GET') result = store.has(key) ? store.get(key) : null;
  else if (cmd === 'SET') { store.set(key, value); result = 'OK'; }
  else if (cmd === 'DEL') { result = store.delete(key) ? 1 : 0; }
  else if (cmd === 'INCR') { const n = Number(store.get(key) || 0) + 1; store.set(key, String(n)); result = n; }
  else if (cmd === 'EXPIRE') result = 1;
  void rest;
  return { json: async () => ({ result }) };
};

const handler = require('../../api/ub.js');

const SESSION = 'a'.repeat(64);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const daysAgo = n => {
  const [y, m, d] = TODAY.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

function seedSession() {
  store.set(`ub-session:${SESSION}`, '1');
}

async function call(method, action, { body, query = {}, token = SESSION } = {}) {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler({ method, query: { action, ...query }, body, headers: { authorization: `Bearer ${token}` } }, res);
  return res;
}

function readKey(key) {
  return store.has(key) ? JSON.parse(store.get(key)) : null;
}

test.beforeEach(() => {
  store.clear();
  seedSession();
});

test('rejects unknown tokens, accepts the bot token', async () => {
  assert.equal((await call('GET', 'all', { token: 'c'.repeat(64) })).statusCode, 401);
  const res = await call('GET', 'all', { token: 'b'.repeat(64) });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.cards, []);
});

test('legacy items normalize to cards and stay readable through todos', async () => {
  store.set('ub-todos', JSON.stringify([
    { id: 'a', text: 'old open', state: 'todo', done: false, created: 1, kind: 'global', doneOn: null, project: 'iwa', due: daysAgo(2) },
    { id: 'b', text: 'old done', state: 'done', done: true, created: 2, kind: 'global', doneOn: daysAgo(1) },
    { id: 'c', text: 'legacy daily', state: 'todo', done: false, created: 3, kind: 'daily', doneOn: null },
  ]));
  const all = await call('GET', 'all');
  const byId = Object.fromEntries(all.payload.cards.map(c => [c.id, c]));
  assert.equal(byId.a.column, 'todo');
  assert.equal(byId.a.kind, 'task');
  assert.equal(byId.a.date, daysAgo(2));
  assert.equal(byId.a.project, 'iwa');
  assert.equal(byId.b.column, 'done');
  assert.equal(byId.b.state, 'done');
  assert.equal(byId.b.done, true);
  assert.equal(byId.c.kind, 'routine');
  const todos = await call('GET', 'todos');
  const legacy = todos.payload.todos.find(t => t.id === 'a');
  assert.equal(legacy.due, daysAgo(2));
  assert.equal(legacy.state, 'todo');
});

test('creating a project and cards mints keys and lands columns per the rules', async () => {
  let res = await call('POST', 'projects', { body: { slug: 'iwa', title: 'iwa', prefix: 'IWA' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.registry.projects[0].prefix, 'IWA');

  res = await call('POST', 'cards', { body: { text: 'glaze test', project: 'iwa' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.card.key, 'IWA-1');
  assert.equal(res.payload.card.column, 'todo');
  res = await call('POST', 'cards', { body: { text: 'someday', project: 'iwa', column: 'backlog' } });
  assert.equal(res.payload.card.column, 'backlog');

  res = await call('POST', 'cards', { body: { text: 'kiln pickup', project: 'iwa', date: TODAY, expires: true } });
  assert.equal(res.payload.card.key, 'IWA-3');
  assert.equal(res.payload.card.column, 'todo');
  assert.equal(res.payload.card.expires, true);

  res = await call('POST', 'cards', { body: { text: 'inbox thing' } });
  assert.equal(res.payload.card.key, null);
  assert.equal(res.payload.card.project, null);
  const inboxId = res.payload.card.id;

  res = await call('POST', 'cards', { body: { text: 'dated inbox', date: TODAY } });
  assert.equal(res.statusCode, 400);

  res = await call('PATCH', 'cards', { body: { id: inboxId, project: 'iwa' } });
  assert.equal(res.payload.card.key, 'IWA-4');
  assert.equal(res.payload.card.column, 'todo');

  res = await call('PATCH', 'cards', { body: { id: inboxId, column: 'doing' } });
  assert.equal(res.payload.card.column, 'doing');
  assert.equal(res.payload.card.date, TODAY);

  res = await call('PATCH', 'cards', { body: { id: inboxId, column: 'done' } });
  assert.equal(res.payload.card.doneOn, TODAY);
  assert.equal(res.payload.card.doneVia, 'tap');

  res = await call('PATCH', 'cards', { body: { id: inboxId, column: 'todo' } });
  assert.equal(res.payload.card.doneOn, null);
  assert.equal(res.payload.card.date, TODAY);

  res = await call('PATCH', 'cards', { body: { id: inboxId, project: 'nope' } });
  assert.equal(res.statusCode, 400);

  const registry = readKey('ub-board-registry');
  assert.equal(registry.projects[0].counter, 4);
});

test('undated todo cards belong to today; backlog and future-dated ones do not', async () => {
  await call('POST', 'projects', { body: { slug: 'iwa', prefix: 'IWA' } });
  const undated = (await call('POST', 'cards', { body: { text: 'u', project: 'iwa' } })).payload.card;
  const future = (await call('POST', 'cards', { body: { text: 'f', project: 'iwa', date: '2099-01-01' } })).payload.card;
  const backlog = (await call('POST', 'cards', { body: { text: 'b', project: 'iwa', column: 'backlog' } })).payload.card;
  const res = await call('PUT', 'today-order', { body: { order: [backlog.id, future.id, undated.id] } });
  const today = Object.fromEntries(res.payload.cards.map(x => [x.id, x.todayOrder]));
  assert.equal(today[undated.id], 2);
  assert.equal(today[future.id], null);
  assert.equal(today[backlog.id], null);
});

test('rollover spawns routines, honours away and on-signal, evaluates auto-routines, expires and archives', async () => {
  await call('POST', 'projects', { body: { slug: 'fitness', prefix: 'FIT' } });
  await call('POST', 'templates', { body: { project: 'fitness', title: 'stretch', kind: 'routine', rule: { type: 'daily' } } });
  await call('POST', 'templates', { body: { project: 'fitness', title: 'food logged', kind: 'auto-routine', signal: 'food', mode: 'always' } });
  await call('POST', 'templates', { body: { project: 'fitness', title: 'training logged', kind: 'auto-routine', signal: 'training', mode: 'on-signal' } });
  await call('POST', 'templates', { body: { project: 'fitness', title: 'never today', kind: 'routine', rule: { type: 'weekdays', days: [] } } });

  store.set('ub-todos', JSON.stringify([
    { id: 'exp', text: 'expiring', kind: 'task', project: 'fitness', column: 'todo', date: daysAgo(1), expires: true, created: 1 },
    { id: 'carry', text: 'carrying', kind: 'task', project: 'fitness', column: 'todo', date: daysAgo(1), expires: false, created: 2 },
    { id: 'olddone', text: 'old done', kind: 'task', project: 'fitness', column: 'done', doneOn: daysAgo(9), created: 3 },
    { id: 'missed', text: 'stretch', kind: 'routine', project: 'fitness', column: 'todo', date: daysAgo(1), template: 'x', created: 4 },
  ]));
  store.set('ub-board-signals', JSON.stringify({ date: TODAY, updated: 'now', signals: { food: true, training: false } }));

  let all = await call('GET', 'all');
  let cards = all.payload.cards;
  const titles = cards.filter(c => c.date === TODAY && c.template).map(c => c.text).sort();
  assert.deepEqual(titles, ['food logged', 'stretch']);
  const food = cards.find(c => c.text === 'food logged');
  assert.equal(food.column, 'done');
  assert.equal(food.doneVia, 'signal');
  const exp = cards.find(c => c.id === 'exp');
  assert.equal(exp.column, 'done');
  assert.equal(exp.doneVia, 'expiry');
  assert.equal(exp.doneOn, daysAgo(1));
  assert.ok(cards.find(c => c.id === 'carry'), 'carrying card stays live');
  assert.equal(cards.find(c => c.id === 'olddone'), undefined, 'old done archived');
  assert.equal(cards.find(c => c.id === 'missed'), undefined, 'missed routine archived');
  const archiveMonths = [...store.keys()].filter(k => k.startsWith('ub-board-archive:'));
  const archived = archiveMonths.flatMap(k => readKey(k));
  assert.deepEqual(archived.map(c => c.id).sort(), ['missed', 'olddone']);
  assert.equal(readKey('ub-board-registry').lastRollover, TODAY);

  store.set('ub-board-signals', JSON.stringify({ date: TODAY, updated: 'later', signals: { food: false, training: true } }));
  all = await call('GET', 'all');
  cards = all.payload.cards;
  assert.equal(cards.find(c => c.text === 'food logged').column, 'todo');
  assert.equal(cards.find(c => c.text === 'training logged').column, 'done');
  assert.equal(cards.filter(c => c.text === 'stretch' && c.date === TODAY).length, 1, 'idempotent spawn');

  await call('PUT', 'away', { body: { ranges: [{ start: TODAY, end: TODAY }] } });
  store.set('ub-todos', JSON.stringify([]));
  all = await call('GET', 'all');
  assert.equal(all.payload.cards.filter(c => c.template).length, 0, 'away suppresses spawns');
});

test('routine cards accept only column and order edits; auto-routines are read-only', async () => {
  await call('POST', 'projects', { body: { slug: 'french', prefix: 'FRE' } });
  await call('POST', 'templates', { body: { project: 'french', title: 'anki', kind: 'routine' } });
  await call('POST', 'templates', { body: { project: 'french', title: 'agares', kind: 'auto-routine', signal: 'agares' } });
  const all = await call('GET', 'all');
  const routine = all.payload.cards.find(c => c.text === 'anki');
  const auto = all.payload.cards.find(c => c.text === 'agares');
  assert.equal((await call('PATCH', 'cards', { body: { id: routine.id, text: 'x' } })).statusCode, 400);
  const done = await call('PATCH', 'cards', { body: { id: routine.id, column: 'done' } });
  assert.equal(done.payload.card.doneOn, TODAY);
  assert.equal((await call('PATCH', 'cards', { body: { id: auto.id, column: 'done' } })).statusCode, 400);
});

test('legacy todos endpoints keep the bot flow working', async () => {
  await call('POST', 'projects', { body: { slug: 'home', prefix: 'HOME' } });
  let res = await call('POST', 'todos', { body: { text: 'from vassago', kind: 'global' } });
  assert.equal(res.statusCode, 200);
  const item = res.payload.todos.find(t => t.text === 'from vassago');
  assert.equal(item.project, null);
  assert.equal(item.state, 'todo');
  res = await call('PATCH', 'todos', { body: { id: item.id, state: 'done' } });
  assert.equal(res.payload.todos.find(t => t.id === item.id).done, true);
  res = await call('PATCH', 'todos', { body: { id: item.id, project: 'home' } });
  assert.equal(res.payload.todos.find(t => t.id === item.id).key, 'HOME-1');
  res = await call('DELETE', 'todos', { query: { id: item.id } });
  assert.equal(res.payload.todos.find(t => t.id === item.id), undefined);
});

test('cards-order and today-order persist positions', async () => {
  await call('POST', 'projects', { body: { slug: 'iwa', prefix: 'IWA' } });
  const a = (await call('POST', 'cards', { body: { text: 'a', project: 'iwa', column: 'todo' } })).payload.card;
  const b = (await call('POST', 'cards', { body: { text: 'b', project: 'iwa', column: 'todo' } })).payload.card;
  const c = (await call('POST', 'cards', { body: { text: 'c', project: 'iwa', column: 'todo' } })).payload.card;
  let res = await call('PUT', 'cards-order', { body: { project: 'iwa', column: 'todo', order: [c.id, a.id] } });
  const orders = Object.fromEntries(res.payload.cards.map(x => [x.id, x.order]));
  assert.ok(orders[c.id] < orders[a.id] && orders[a.id] < orders[b.id]);
  await call('PATCH', 'cards', { body: { id: a.id, date: TODAY } });
  await call('PATCH', 'cards', { body: { id: b.id, date: TODAY } });
  res = await call('PUT', 'today-order', { body: { order: [b.id, a.id] } });
  const today = Object.fromEntries(res.payload.cards.map(x => [x.id, x.todayOrder]));
  assert.equal(today[b.id], 0);
  assert.equal(today[a.id], 1);
  assert.equal(today[c.id], null);
});

test('project status and prefix rules', async () => {
  await call('POST', 'projects', { body: { slug: 'iwa', prefix: 'IWA' } });
  assert.equal((await call('POST', 'projects', { body: { slug: 'iwa2', prefix: 'IWA' } })).statusCode, 400);
  await call('POST', 'cards', { body: { text: 'x', project: 'iwa' } });
  assert.equal((await call('PATCH', 'projects', { body: { slug: 'iwa', prefix: 'IW' } })).statusCode, 400);
  const res = await call('PATCH', 'projects', { body: { slug: 'iwa', status: 'archived' } });
  assert.equal(res.payload.registry.projects[0].status, 'archived');
  assert.equal((await call('POST', 'cards', { body: { text: 'y', project: 'iwa' } })).statusCode, 400);
});
