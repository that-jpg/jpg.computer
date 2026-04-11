module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const headers = { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` };

  if (req.method === 'POST') {
    const r = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/pomodoro-sessions`, { headers });
    const { result } = await r.json();
    res.json({ count: result });
  } else {
    const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/pomodoro-sessions`, { headers });
    const { result } = await r.json();
    res.json({ count: result || 0 });
  }
}
