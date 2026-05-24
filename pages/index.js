import { useState, useEffect, useCallback } from 'react';

export default function Home() {
  const [streams, setStreams] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [areaFilter, setAreaFilter] = useState('all');

  const fetchStreams = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/streams?page=${p}&size=30`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setStreams(data.streams || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
      setPage(data.page || p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStreams(1); }, [fetchStreams]);

  const filtered = streams.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      s.name?.toLowerCase().includes(q) ||
      s.liveName?.toLowerCase().includes(q) ||
      s.anchorId?.includes(search);
    const matchArea = areaFilter === 'all' || s.area === areaFilter;
    return matchSearch && matchArea;
  });

  const areas = ['all', ...new Set(streams.map(s => s.area).filter(Boolean))];

  const fmt = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>📺 567TV Stream Browser</h1>
        <p className="subtitle">{total.toLocaleString()} live streams</p>
      </header>

      <div className="controls">
        <input
          type="text"
          placeholder="🔍 Search name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search"
        />
        <div className="area-filter">
          {areas.map(a => (
            <button
              key={a}
              className={`area-btn ${areaFilter === a ? 'active' : ''}`}
              onClick={() => setAreaFilter(a)}
            >
              {a === 'all' ? '🌍 All' : a}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="error">
          ❌ {error} <button onClick={() => fetchStreams(page)}>Retry</button>
        </div>
      )}

      {/* Player Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selected.name}</h2>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <p className="modal-live">{selected.liveName}</p>
            <div className="player-wrapper">
              <iframe
                src={`https://567tv2.com/room/${selected.anchorId}`}
                className="player-iframe"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
            <div className="modal-actions">
              <a
                href={`https://567tv2.com/room/${selected.anchorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                🔗 Open in New Tab
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`https://567tv2.com/room/${selected.anchorId}`);
                }}
              >
                📋 Copy URL
              </button>
            </div>
            <div className="modal-info">
              <span>👥 {fmt(selected.viewers)}</span>
              <span>📍 {selected.showArea || selected.area}</span>
              {selected.gameName && <span>🎮 {selected.gameName}</span>}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          Loading streams...
        </div>
      ) : (
        <div className="grid">
          {filtered.map(s => (
            <div key={s.id} className="card" onClick={() => setSelected(s)}>
              <div className="card-img">
                <img src={s.cover} alt={s.name} loading="lazy" />
                <span className="viewers">👥 {fmt(s.viewers)}</span>
                {s.gameIcon && (
                  <span className="game-badge">
                    <img src={s.gameIcon} alt="" />{s.gameName}
                  </span>
                )}
              </div>
              <div className="card-body">
                <h3>{s.name}</h3>
                <p>{s.liveName}</p>
                <span className="area-tag">{s.showArea || s.area}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => fetchStreams(page - 1)}>
          ← Prev
        </button>
        <span>Page {page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => fetchStreams(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
