import { useState, useEffect } from 'react';

function formatViewers(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function StreamCard({ stream }) {
  return (
    <a
      className="stream-card"
      href={`https://567tv2.com/room/${stream.anchorId}`}
      target="_blank"
      rel="noopener noreferrer"
    >
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
    </a>
  );
}

export default function Home() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

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

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">📺 567TV Streams</h1>
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
              <StreamCard key={stream.anchorId} stream={stream} />
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

      <footer className="footer">
        Data from 567tv2.com • Opens in 567tv player
      </footer>
    </div>
  );
}
