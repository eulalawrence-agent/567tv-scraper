// Stream list API - fetches from 567tv
const STREAM_API = 'https://api.fnccdn.com/539/api/plr/h5/v3/public/live/lrl';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { page = 1, size = 30 } = req.query;

  try {
    const url = `${STREAM_API}?pageNum=${page}&pageSize=${size}&merchantId=539&area=ID&lang=IND&t=${Date.now()}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://567tv2.com/',
      },
    });

    const data = await resp.json();

    if (!data.records) {
      return res.status(500).json({ error: 'Invalid API response', detail: data });
    }

    const streams = data.records.map((r) => ({
      id: r.id,
      anchorId: r.anchorId,
      name: r.anchorNickname,
      liveName: r.liveName,
      viewers: r.onlineCount,
      cover: r.coverUrl,
      area: r.showUiArea,
      gameName: r.gameName,
    }));

    return res.status(200).json({
      streams,
      total: data.total,
      page: data.current,
      pages: data.pages,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
