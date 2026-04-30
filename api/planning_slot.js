const MAX_ENTRIES = 50;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  const headers = {
    Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
    'Content-Type': 'application/json',
  };
  const key = 'planning-slot-feed';

  try {
    if (req.method === 'POST') {
      const { symbols, playerId } = req.body;
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Invalid symbols' });
      }

      const entry = JSON.stringify({
        symbols,
        playerId: String(playerId || 'anon').slice(0, 16),
        ts: Date.now(),
      });

      await fetch(`${UPSTASH_REDIS_REST_URL}/lpush/${key}`, {
        method: 'POST',
        headers,
        body: JSON.stringify([entry]),
      });

      await fetch(`${UPSTASH_REDIS_REST_URL}/ltrim/${key}/0/${MAX_ENTRIES - 1}`, {
        method: 'POST',
        headers,
        body: JSON.stringify([]),
      });

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const r = await fetch(
        `${UPSTASH_REDIS_REST_URL}/lrange/${key}/0/${MAX_ENTRIES - 1}`,
        { headers }
      );
      const { result } = await r.json();
      const entries = (result || []).map(s => {
        try { return JSON.parse(s); } catch { return null; }
      }).filter(Boolean);

      return res.json({ entries });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Redis unavailable' });
  }
};
