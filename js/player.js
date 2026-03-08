/**
 * Audio player for live radio streams
 */
const Player = (() => {
  let audio = null;
  let currentStation = null;
  let state = 'idle'; // idle | loading | playing | paused | error
  let volume = 0.8;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  let waitingTimer = null;

  // Callbacks
  const listeners = {
    stateChange: [],
    stationChange: []
  };

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function setState(newState) {
    state = newState;
    emit('stateChange', { state, station: currentStation });
  }

  function createAudio() {
    clearTimeout(waitingTimer);
    waitingTimer = null;
    if (audio) {
      audio.pause();
      audio.src = '';
      audio.load();
    }
    audio = new Audio();
    audio.volume = volume;
    audio.preload = 'none';

    audio.addEventListener('playing', () => {
      clearTimeout(waitingTimer);
      waitingTimer = null;
      retryCount = 0;
      setState('playing');
    });

    audio.addEventListener('waiting', () => {
      if (state !== 'playing' && state !== 'loading') return;
      setState('loading');
      clearTimeout(waitingTimer);
      waitingTimer = setTimeout(() => {
        // Browser hasn't recovered — reconnect to live edge
        if (audio && currentStation && state === 'loading') {
          const src = audio.src;
          audio.src = '';
          audio.src = src;
          audio.play().catch(() => setState('error'));
        }
      }, 2500);
    });

    audio.addEventListener('stalled', () => {
      if (state !== 'playing' && state !== 'loading') return;
      setState('loading');
      clearTimeout(waitingTimer);
      waitingTimer = setTimeout(() => {
        if (audio && currentStation && state === 'loading') {
          const src = audio.src;
          audio.src = '';
          audio.src = src;
          audio.play().catch(() => setState('error'));
        }
      }, 2500);
    });

    audio.addEventListener('error', () => {
      if (retryCount < MAX_RETRIES && currentStation) {
        retryCount++;
        setTimeout(() => {
          if (currentStation && state !== 'idle') {
            // Try alternate URL on retry
            const url = retryCount > 1 ? (currentStation.url || currentStation.url_resolved)
                                        : (currentStation.url_resolved || currentStation.url);
            audio.src = url;
            audio.load();
            audio.play().catch(() => setState('error'));
          }
        }, 1500 * retryCount);
      } else {
        setState('error');
      }
    });

    audio.addEventListener('ended', () => {
      // Live streams shouldn't end; reconnect
      if (currentStation) {
        setTimeout(() => load(currentStation), 2000);
      }
    });

    return audio;
  }

  function load(station) {
    currentStation = station;
    retryCount = 0;
    setState('loading');
    emit('stationChange', station);

    createAudio();

    // Inform the API about the play (non-blocking)
    RadioAPI.clickStation(station.stationuuid);

    const streamURL = station.url_resolved || station.url;
    audio.src = streamURL;
    // Do NOT call audio.load() here — it resets the element mid-load and causes
    // a 1-2s stutter on live streams. Setting src is enough to trigger loading.

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        // Autoplay blocked — show play button, user must tap
        if (err.name === 'NotAllowedError') {
          setState('paused');
        } else {
          setState('error');
        }
      });
    }
  }

  function play() {
    if (!currentStation) return;
    if (audio && audio.src) {
      setState('loading');
      audio.play().catch(() => setState('error'));
    } else {
      load(currentStation);
    }
  }

  function pause() {
    clearTimeout(waitingTimer);
    waitingTimer = null;
    if (audio) {
      audio.pause();
      setState('paused');
    }
  }

  function stop() {
    clearTimeout(waitingTimer);
    waitingTimer = null;
    if (audio) {
      audio.pause();
      audio.src = '';
      audio.load();
    }
    currentStation = null;
    setState('idle');
  }

  function togglePlay() {
    if (state === 'playing' || state === 'loading') {
      pause();
    } else {
      play();
    }
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (audio) audio.volume = volume;
  }

  function getState() { return state; }
  function getStation() { return currentStation; }
  function isPlaying() { return state === 'playing'; }
  function isLoading() { return state === 'loading'; }

  // Media Session API (lock screen controls, notification)
  function updateMediaSession(station) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: [station.tags, station.country].filter(Boolean).join(' • '),
      album: 'myRadio7 — Live Radio',
      artwork: station.favicon ? [
        { src: station.favicon, sizes: '96x96', type: 'image/png' },
        { src: station.favicon, sizes: '256x256', type: 'image/png' }
      ] : []
    });

    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('stop', stop);
  }

  // Update media session when station changes
  on('stationChange', updateMediaSession);
  on('stateChange', ({ state: s }) => {
    if (!('mediaSession' in navigator)) return;
    if (s === 'playing') navigator.mediaSession.playbackState = 'playing';
    else if (s === 'paused') navigator.mediaSession.playbackState = 'paused';
    else navigator.mediaSession.playbackState = 'none';
  });

  return { load, play, pause, stop, togglePlay, setVolume, on, getState, getStation, isPlaying, isLoading };
})();
