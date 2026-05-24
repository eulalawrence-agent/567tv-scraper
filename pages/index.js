import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

function formatViewers(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function Player({ anchorId, name, onBack }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [m3u8, setM3u8] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchM3u8 = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/stream/${anchorId}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setM3u8(data.m3u8);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchM3u8();
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [anchorId]);

  useEffect(() => {
    if (!m3u8 || !videoRef.current) return;

    const video = videoRef.current;

    if (hlsRef.current) hlsRef.current.destroy();

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 10,
        enableWorker: true,
      });
      hls.loadSource(m3u8);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Auto-refresh m3u8 on network error (likely expired)
            fetchM3u8();
          } else {
            setError('Stream error: ' + data.details);
          }
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = m3u8;
      video.addEventListener('loadedmetadata', () => video.play().catch(() => {}));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [m3u8]);

  return (
    <div className="player-container">
      <div className="player-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <span className="player-name">{name}</span>
        <button className="refresh-btn" onClick={fetchM3u8} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="player-loading">Loading stream...</div>}
      {error && (
        <div className="player-error">
          <p>❌ {error}</p>
          <button onClick={fetchM3u8}>Retry</button>
        </div>
      )}

      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxHeight: '70vh', background: '#000' }}
      />

      {m3u8 && (
        <div className="m3u8-info">
          <details>
            <summary>M3U8 URL</summary>
            <code>{m3u8}</code>
          </details>
        </div>
      )}
    </div>
  );
}

function StreamCard({ stream, onClick }) {
  return (
    <div className="stream-card" onClick={() => onClick(stream)}>
      <div className="stream-cover-wrap">
        <img
          src={stream.cover}
          alt={stream.name}
          className="stream-cover"
          loading="lazy"
          onError={(e) => {
            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23222" width="200" height="200"/><text fill="%23666" x="100" y="100" text-anchor="middle" dy=".3em">No Image</text></svg>';
          }}
        />
        <div className="stream-live-badge">LIVE</div>
        <div className="stream-viewers">{formatViewers(stream.viewers)}</div>
      </div>
      <div className="stream-info">
        <div className="stream-name">{stream.name}</div>
        <div className="stream-area">{stream.area}</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const fetchStreams = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/streams?page=${p}&size=30`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setStreams(data.streams);
      setTotalPages(data.pages);
      setPage(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  const filtered = streams.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.liveName.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <div className="app">
        <Player
          anchorId={selected.anchorId}
          name={selected.name}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">📺 567TV Stream Viewer</h1>
        <div className="controls">
          <input
            type="text"
            placeholder="Search streams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </header>

      {error && <div className="error-banner">❌ {error}</div>}

      {loading ? (
        <div className="loading">Loading streams...</div>
      ) : (
        <>
          <div className="stream-grid">
            {filtered.map((stream) => (
              <StreamCard
                key={stream.anchorId}
                stream={stream}
                onClick={setSelected}
              />
            ))}
          </div>

          <div className="pagination">
            <button
              disabled={page <= 1}
              onClick={() => fetchStreams(page - 1)}
            >
              ← Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => fetchStreams(page + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}

      <footer className="footer">
        <p>Streams from 567tv2.com • Auto-refreshes on expiry</p>
      </footer>
    </div>
  );
}
