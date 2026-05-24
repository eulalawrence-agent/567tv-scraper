import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

function formatViewers(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// Extract m3u8 by loading 567tv room page in hidden iframe
function useM3u8Extractor() {
  const iframeRef = useRef(null);
  const [m3u8Map, setM3u8Map] = useState({});

  const extract = useCallback((anchorId) => {
    return new Promise((resolve) => {
      // Check cache first
      if (m3u8Map[anchorId]) {
        resolve(m3u8Map[anchorId]);
        return;
      }

      // Create hidden iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `https://567tv2.com/room/${anchorId}`;
      document.body.appendChild(iframe);
      iframeRef.current = iframe;

      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 25000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      };

      // Poll performance entries for m3u8
      const check = setInterval(() => {
        try {
          // Can't access iframe cross-origin perf entries
          // But we can check if the iframe loaded
        } catch {}
      }, 1000);

      iframe.onload = () => {
        // After iframe loads, we can't access cross-origin content
        // But the m3u8 request will appear in our own performance entries
        setTimeout(() => {
          const entries = performance.getEntries();
          const m3u8Entry = entries.find(
            (e) => e.name.includes('.m3u8') && e.name.includes('cdnsi')
          );
          clearInterval(check);
          cleanup();
          if (m3u8Entry) {
            setM3u8Map((prev) => ({ ...prev, [anchorId]: m3u8Entry.name }));
            resolve(m3u8Entry.name);
          } else {
            resolve(null);
          }
        }, 10000);
      };
    });
  }, [m3u8Map]);

  return { extract, m3u8Map };
}

function Player({ anchorId, name, onBack }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [m3u8, setM3u8] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState('');

  const fetchM3u8 = async () => {
    setLoading(true);
    setError(null);
    setMethod('');

    try {
      // Method 1: Try backend API (Playwright-based)
      const resp = await fetch(`/api/stream/${anchorId}`);
      const data = await resp.json();
      if (data.m3u8) {
        setM3u8(data.m3u8);
        setMethod('backend');
        return;
      }
    } catch {}

    // Method 2: Try iframe extraction (frontend)
    try {
      setMethod('iframe');
      const iframe = document.createElement('iframe');
      iframe.style.cssText =
        'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;';
      iframe.src = `https://567tv2.com/room/${anchorId}`;
      document.body.appendChild(iframe);

      // Wait for iframe to load and stream to start
      await new Promise((r) => setTimeout(r, 20000));

      // Check performance entries
      const entries = performance.getEntries();
      const m3u8Entry = entries.find(
        (e) => e.name.includes('.m3u8') && e.name.includes('cdnsi')
      );

      document.body.removeChild(iframe);

      if (m3u8Entry) {
        setM3u8(m3u8Entry.name);
        setMethod('iframe-success');
        return;
      }
    } catch {}

    setError('Could not extract m3u8 URL. Try again.');
    setMethod('failed');
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
        liveSyncDuration: 3,
        liveMaxLatencyDuration: 15,
        enableWorker: true,
      });
      hls.loadSource(m3u8);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            fetchM3u8(); // Auto-refresh on expiry
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
          🔄
        </button>
      </div>

      {loading && (
        <div className="player-loading">
          <div className="spinner" />
          <p>Loading stream... ({method || 'trying'})</p>
        </div>
      )}
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
            <summary>M3U8 URL ({method})</summary>
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
            e.target.src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect fill="%23222" width="200" height="200"/></svg>';
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

  const fetchStreams = async (p = 1) => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/streams?page=${p}&size=30`);
      const data = await resp.json();
      setStreams(data.streams);
      setTotalPages(data.pages);
      setPage(p);
    } catch {
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
        <h1 className="title">📺 567TV</h1>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </header>

      {loading ? (
        <div className="loading">Loading...</div>
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
            <button disabled={page <= 1} onClick={() => fetchStreams(page - 1)}>
              ←
            </button>
            <span>
              {page}/{totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => fetchStreams(page + 1)}
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
