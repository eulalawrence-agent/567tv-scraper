import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const HlsPlayer = dynamic(() => import('../components/HlsPlayer'), { ssr: false });

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
  const [m3u8, setM3u8] = useState(null);
  const [m3u8Loading, setM3u8Loading] = useState(false);
  const [m3u8Error, setM3u8Error] = useState(null);

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

  const fetchM3u8 = async (anchorId) => {
    setM3u8Loading(true);
    setM3u8Error(null);
    setM3u8(null);
    try {
      const resp = await fetch(`/api/m3u8?anchorId=${anchorId}`);
      const data = await resp.json();
      if (data.m3u8) {
        setM3u8(data.m3u8);
      } else {
        setM3u8Error(data.error || 'M3U8 not found');
      }
    } catch (err) {
      setM3u8Error(err.message);
    } finally {
      setM3u8Loading(false);
    }
  };

  const openStream = (stream) => {
    setSelected(stream);
    setM3u8(null);
    setM3u8Error(null);
    // Auto-fetch m3u8
    fetchM3u8(stream.anchorId);
  };

  const closeModal = () => {
    setSelected(null);
    setM3u8(null);
    setM3u8Error(null);
    setM3u8Loading(false);
  };

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
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selected.name}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <p className="modal-live">{selected.liveName}</p>

            {/* HLS Player */}
            <div className="player-wrapper">
              {m3u8Loading && (
                <div className="player-loading">
                  <div className="spinner" />
                  <p>Extracting stream URL...</p>
                  <p className="player-loading-sub">This may take 20-30 seconds</p>
                </div>
              )}
              {m3u8Error && (
                <div className="player-error">
                  <p>⚠️ {m3u8Error}</p>
                  <a
                    href={`https://567tv2.com/room/${selected.anchorId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    🔗 Watch on 567TV
                  </a>
                </div>
              )}
              {m3u8 && <HlsPlayer src={m3u8} />}
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => fetchM3u8(selected.anchorId)}
                disabled={m3u8Loading}
              >
                🔄 Refresh Stream
              </button>
              <a
                href={`https://567tv2.com/room/${selected.anchorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                🔗 Open on 567TV
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (m3u8) navigator.clipboard.writeText(m3u8);
                }}
              >
                📋 Copy M3U8
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
            <div key={s.id} className="card" onClick={() => openStream(s)}>
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
