// Proxy to VPS m3u8 scraper service
// Set SCRAPER_URL env var in Vercel to your VPS scraper endpoint
// e.g. http://36.69.185.224:9876

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://36.69.185.224:9876';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { anchorId } = req.query;

  if (!anchorId) {
    return res.status(400).json({ error: 'anchorId required' });
  }

  try {
    const resp = await fetch(`${SCRAPER_URL}/m3u8/${anchorId}`, {
      signal: AbortSignal.timeout(60000), // 60s timeout (scraping takes time)
    });

    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    // If scraper is unreachable, return fallback info
    return res.status(502).json({
      error: 'Scraper unavailable',
      message: err.message,
      fallback: `https://567tv2.com/room/${anchorId}`,
    });
  }
}
