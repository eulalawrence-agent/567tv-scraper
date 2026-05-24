const STREAM_API = 'https://api.fnccdn.com/539/api/plr/h5/v3/public/live/lrl';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { page = 1, size = 30 } = req.query;

  try {
    const url = `${STREAM_API}?pageNum=${page}&pageSize=${size}&merchantId=539`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Origin': 'https://567tv2.com',
        'Referer': 'https://567tv2.com/',
      },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ error: `Upstream ${resp.status}` });
    }

    const data = await resp.json();

    if (!data.records) {
      return res.status(500).json({ error: 'Invalid response', raw: data });
    }

    const streams = data.records.map((r) => ({
      id: r.id,
      anchorId: r.anchorId,
      name: r.anchorNickname,
      liveName: r.liveName,
      viewers: r.onlineCount,
      cover: r.coverUrl,
      area: r.area,
      showArea: r.showUiArea,
      gameName: r.gameName,
      gameIcon: r.gameIconUrl,
      isLive: !r.bauble,
    }));

    return res.status(200).json({
      streams,
      total: data.total,
      page: data.current,
      pages: data.pages,
      size: data.size,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
