const TYPES = ['work', 'learning', 'general'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

  if (req.method === 'POST') {
    const type = req.query.type && TYPES.includes(req.query.type) ? req.query.type : 'general';
    await fetch(`${UPSTASH_REDIS_REST_URL}/incr/pomodoro-${type}`, { headers });
  }

  const results = await Promise.all(
    TYPES.map(t =>
      fetch(`${UPSTASH_REDIS_REST_URL}/get/pomodoro-${t}`, { headers })
        .then(r => r.json())
        .then(({ result }) => [t, parseInt(result) || 0])
    )
  );

  res.json(Object.fromEntries(results));
}
