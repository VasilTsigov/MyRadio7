/**
 * NowPlaying — reads ICY stream metadata (StreamTitle) from live radio streams.
 * Works for stations that expose CORS headers and ICY metadata.
 * Fails silently when CORS/metadata is unavailable.
 */
const NowPlaying = (function () {
  'use strict';

  let _pollTimer = null;
  let _currentUrl = null;
  let _lastTitle = null;
  const _listeners = {};

  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
  }

  function emit(event, data) {
    (_listeners[event] || []).forEach(cb => cb(data));
  }

  async function fetchICYTitle(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        headers: { 'Icy-MetaData': '1' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const metaint = parseInt(res.headers.get('Icy-Metaint') || '0', 10);
      if (!metaint) {
        res.body.cancel();
        return null;
      }

      // Read metaint audio bytes + 1 length byte + up to 255*16 metadata bytes
      const needed = metaint + 1 + 255 * 16;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;

      while (received < needed) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
      }
      reader.cancel();

      // Flatten chunks
      const buf = new Uint8Array(received);
      let pos = 0;
      for (const c of chunks) { buf.set(c, pos); pos += c.length; }

      if (buf.length <= metaint) return null;

      const metaLen = buf[metaint] * 16;
      if (!metaLen || buf.length < metaint + 1 + metaLen) return null;

      const meta = new TextDecoder().decode(buf.slice(metaint + 1, metaint + 1 + metaLen));
      const m = meta.match(/StreamTitle='([^']*)'/);
      const title = m && m[1].trim() ? m[1].trim() : null;

      // Filter out generic placeholder titles
      if (title && (title === '-' || title === ' - ' || title.toLowerCase() === 'unknown')) return null;
      return title;

    } catch (_) {
      clearTimeout(timeout);
      return null;
    }
  }

  async function doPoll() {
    const url = _currentUrl;
    if (!url) return;
    const title = await fetchICYTitle(url);
    if (_currentUrl !== url) return; // station changed during fetch
    if (title !== _lastTitle) {
      _lastTitle = title;
      emit('update', title);
    }
  }

  function start(station) {
    stop();
    _currentUrl = station.url_resolved || station.url;
    _lastTitle = null;
    emit('update', null);
    // Delay first poll so the audio stream can fully buffer before we open
    // a second connection to the same URL (avoids competing for bandwidth).
    _pollTimer = setTimeout(() => {
      if (!_currentUrl) return;
      doPoll();
      _pollTimer = setInterval(doPoll, 30000);
    }, 8000);
  }

  function stop() {
    clearInterval(_pollTimer);
    _pollTimer = null;
    _currentUrl = null;
    if (_lastTitle !== null) {
      _lastTitle = null;
      emit('update', null);
    }
  }

  return { on, start, stop };
})();
