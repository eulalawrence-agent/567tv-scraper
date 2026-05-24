#!/usr/bin/env python3
"""
567TV M3U8 Scraper Service
Runs on VPS, exposes REST API for m3u8 extraction.
Uses CloakBrowser to bypass age gate and capture m3u8 from network requests.
"""

import json, time, threading, hashlib, os, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from cloakbrowser import launch

# Config
PORT = int(os.environ.get("M3U8_PORT", 9876))
CACHE_TTL = 300  # 5 minutes (m3u8 urls expire ~30min)
MAX_CONCURRENT = 2

# Cache: {anchor_id: {"m3u8": url, "ts": timestamp, "expires": expire_ts}}
cache = {}
cache_lock = threading.Lock()
semaphore = threading.Semaphore(MAX_CONCURRENT)

XVFB_DISPLAY = os.environ.get("DISPLAY", ":99")


def extract_m3u8(anchor_id: str, timeout: int = 45) -> dict:
    """Navigate to 567tv room page and capture m3u8 URL."""
    result = {"anchor_id": anchor_id, "m3u8": None, "error": None}

    try:
        browser = launch(headless=False, stealth_args=True)
        page = browser.new_page()

        cdp = page.context.new_cdp_session(page)
        cdp.send("Network.enable", {})

        m3u8_urls = []

        def on_req(params):
            url = params.get("request", {}).get("url", "")
            if ".m3u8" in url:
                m3u8_urls.append(url)

        cdp.on("Network.requestWillBeSent", on_req)

        # Navigate
        page.goto(
            f"https://567tv2.com/room/{anchor_id}",
            timeout=60000,
            wait_until="domcontentloaded",
        )
        time.sleep(6)

        # Bypass age gate
        page.evaluate("""() => {
            const entry = document.querySelector('.r18-entry');
            if (entry) entry.click();
        }""")
        time.sleep(15)

        # Check performance entries as fallback
        if not m3u8_urls:
            perf = page.evaluate("""() => {
                return performance.getEntriesByType('resource')
                    .filter(e => e.name.includes('.m3u8'))
                    .map(e => e.name);
            }""")
            m3u8_urls.extend(perf)

        if m3u8_urls:
            m3u8 = m3u8_urls[0]
            # Parse expire time from URL
            try:
                from urllib.parse import parse_qs as pq
                parsed = urlparse(m3u8)
                qs = pq(parsed.query)
                expire = int(qs.get("expire", [0])[0])
            except:
                expire = int(time.time()) + 1800

            result["m3u8"] = m3u8
            result["expires"] = expire
        else:
            result["error"] = "No m3u8 found (stream might be offline)"

        browser.close()

    except Exception as e:
        result["error"] = str(e)

    return result


def get_m3u8(anchor_id: str) -> dict:
    """Get m3u8 with caching."""
    now = time.time()

    # Check cache
    with cache_lock:
        if anchor_id in cache:
            entry = cache[anchor_id]
            if now - entry["ts"] < CACHE_TTL and entry["m3u8"]:
                return {
                    "anchor_id": anchor_id,
                    "m3u8": entry["m3u8"],
                    "cached": True,
                    "expires": entry.get("expires", 0),
                }

    # Scrape fresh
    with semaphore:
        result = extract_m3u8(anchor_id)

    # Update cache
    if result.get("m3u8"):
        with cache_lock:
            cache[anchor_id] = {
                "m3u8": result["m3u8"],
                "ts": now,
                "expires": result.get("expires", 0),
            }

    return result


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/health":
            self._json(200, {"status": "ok", "cached": len(cache)})
            return

        if parsed.path.startswith("/m3u8/"):
            anchor_id = parsed.path.split("/")[-1]
            if not anchor_id.isdigit():
                self._json(400, {"error": "Invalid anchor ID"})
                return
            result = get_m3u8(anchor_id)
            status = 200 if result.get("m3u8") else 404
            self._json(status, result)
            return

        if parsed.path == "/cache":
            with cache_lock:
                items = {
                    k: {"m3u8": v["m3u8"][:80] + "...", "age": int(time.time() - v["ts"])}
                    for k, v in cache.items()
                }
            self._json(200, {"cache_size": len(cache), "items": items})
            return

        self._json(404, {"error": "Not found"})

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Quieter logging
        if "/health" not in args[0]:
            sys.stderr.write(f"[scraper] {args[0]}\n")


def main():
    print(f"[567tv-m3u8-scraper] Starting on port {PORT}...")
    print(f"[567tv-m3u8-scraper] Cache TTL: {CACHE_TTL}s, Max concurrent: {MAX_CONCURRENT}")
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
