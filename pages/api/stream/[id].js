// M3U8 stream URL extractor
// Uses @sparticuz/chromium + playwright-core for Vercel serverless

// In-memory cache: anchorId -> { url, expiresAt }
const cache = new Map();

async function getBrowser() {
  const chromium = require('@sparticuz/chromium');
  const { chromium: playwright } = require('playwright-core');
  const executablePath = await chromium.executablePath();
  return playwright.launch({
    executablePath,
    headless: true,
    args: chromium.args || ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function fetchM3u8FromRoom(anchorId) {
  const cached = cache.get(anchorId);
  if (cached && cached.expiresAt > Date.now() + 300_000) {
    return { url: cached.url, cached: true };
  }

  const browser = await getBrowser();
  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    let m3u8Url = null;
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.m3u8') && url.includes('cdnsi')) {
        m3u8Url = url;
      }
    });

    // Visit homepage first to pass age gate
    await page.goto('https://567tv2.com/home', {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);

    // Click age verification
    try {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('*')) {
          if (
            (el.innerText || '').trim() === 'Saya sudah berusia 18 tahun' &&
            el.tagName !== 'P'
          ) {
            el.click();
            return;
          }
        }
      });
      await page.waitForTimeout(3000);
    } catch {}

    // Navigate to room
    await page.goto(`https://567tv2.com/room/${anchorId}`, {
      timeout: 15000,
      waitUntil: 'domcontentloaded',
    });

    // Wait for m3u8 (up to 20s)
    for (let i = 0; i < 20 && !m3u8Url; i++) {
      await page.waitForTimeout(1000);
    }

    // Fallback: check performance entries
    if (!m3u8Url) {
      try {
        const perfUrls = await page.evaluate(() =>
          performance
            .getEntries()
            .filter((e) => e.name.includes('.m3u8'))
            .map((e) => e.name)
        );
        if (perfUrls.length > 0) m3u8Url = perfUrls[0];
      } catch {}
    }

    await context.close();

    if (m3u8Url) {
      let expiresAt = Date.now() + 3600_000;
      try {
        const urlObj = new URL(m3u8Url);
        const expire = parseInt(urlObj.searchParams.get('expire') || '0');
        if (expire > 0) expiresAt = expire * 1000;
      } catch {}
      cache.set(anchorId, { url: m3u8Url, expiresAt });
      return { url: m3u8Url, cached: false };
    }

    return null;
  } finally {
    await browser.close();
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing anchorId' });

  try {
    const result = await fetchM3u8FromRoom(id);
    if (!result) {
      return res.status(404).json({ error: 'Could not extract m3u8 URL' });
    }
    return res.status(200).json({ m3u8: result.url, cached: result.cached });
  } catch (err) {
    console.error('Stream extraction error:', err);
    return res.status(500).json({ error: err.message });
  }
}
