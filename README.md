# 567TV Stream Browser + HLS Player

Browse and watch 567TV live streams with built-in HLS player.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Vercel Frontend │────▶│  Vercel API      │────▶│  VPS Scraper │
│  (Next.js + HLS) │     │  /api/m3u8       │     │  (CloakBrowser│
│                  │     │  /api/streams    │     │   + Python)  │
└─────────────────┘     └──────────────────┘     └──────────────┘
```

- **Frontend**: Next.js + HLS.js player
- **Stream list API**: Proxies 567tv's stream list API
- **M3U8 scraper**: VPS runs CloakBrowser to extract m3u8 URLs

## Setup

### 1. Deploy Frontend to Vercel

```bash
npm install
npx vercel
```

Set environment variable in Vercel:
- `SCRAPER_URL` = `http://YOUR_VPS_IP:9876`

### 2. Run VPS Scraper

```bash
# Install dependencies
pip install cloakbrowser --break-system-packages
python3 -m cloakbrowser install

# Start Xvfb (if headless server)
Xvfb :99 -screen 0 1920x1080x24 -ac &
export DISPLAY=:99

# Run scraper
M3U8_PORT=9876 python3 scraper/m3u8_scraper.py
```

### 3. Open Firewall

```bash
# Allow port 9876
iptables -A INPUT -p tcp --dport 9876 -j ACCEPT
# or
ufw allow 9876
```

## API Endpoints

### Vercel API
- `GET /api/streams?page=1&size=30` — Stream list
- `GET /api/m3u8?anchorId=XXX` — Get m3u8 URL (proxies to VPS)

### VPS Scraper
- `GET /health` — Health check
- `GET /m3u8/:anchorId` — Extract m3u8 URL
- `GET /cache` — View cached entries

## How It Works

1. User clicks a stream card
2. Frontend calls `/api/m3u8?anchorId=XXX`
3. Vercel API proxies to VPS scraper
4. VPS launches CloakBrowser, navigates to 567tv room page
5. Captures m3u8 URL from network requests (WebSocket protobuf delivers it)
6. Returns m3u8 URL with 5min cache
7. Frontend plays m3u8 with HLS.js
