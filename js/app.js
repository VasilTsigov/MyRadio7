/**
 * myRadio7 — Main Application Controller
 */
(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────
  const state = {
    currentView: 'home',
    homeStations: [],
    homeFeatured: [],
    homeCategory: 'bg',
    searchResults: [],
    searchQuery: '',
    searchCountry: '',
    searchTag: '',
    tags: [],
    countries: [],
    isLoading: false
  };

  // ─── DOM references ──────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const DOM = {
    views: { home: $('view-home'), search: $('view-search'), favorites: $('view-favorites') },
    navBtns: document.querySelectorAll('.nav-btn'),
    miniPlayer: $('mini-player'),
    miniLogo: $('mini-logo'),
    miniLogoFallback: document.querySelector('.mini-logo-fallback'),
    miniName: $('mini-name'),
    miniMeta: $('mini-meta'),
    miniPlayBtn: $('mini-play-btn'),
    miniPlayIcon: $('mini-play-icon'),
    miniLoading: $('mini-loading'),
    miniExpand: $('mini-player-expand'),
    fullPlayer: $('full-player'),
    fpClose: $('fp-close'),
    fpFavBtn: $('fp-fav-btn'),
    fpFavIcon: $('fp-fav-icon'),
    fpLogo: $('fp-logo'),
    fpLogoFallback: document.querySelector('.fp-logo-fallback'),
    fpName: $('fp-name'),
    fpMeta: $('fp-meta'),
    fpBitrate: $('fp-bitrate'),
    fpPlayBtn: $('fp-play-btn'),
    fpPlayIcon: $('fp-play-icon'),
    fpSpinner: $('fp-spinner'),
    fpStatus: $('fp-status'),
    fpError: $('fp-error'),
    fpErrorText: $('fp-error-text'),
    radioWaves: $('radio-waves'),
    volumeSlider: $('volume-slider'),
    nowPlayingBadge: $('now-playing-badge'),
    toast: $('toast'),
    fpNowPlaying: $('fp-nowplaying'),
    fpNowPlayingText: $('fp-nowplaying-text')
  };

  // ─── Helpers ─────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg, duration = 2500) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => DOM.toast.classList.add('hidden'), duration);
  }

  function stationLogoHTML(station, size = 50) {
    const r = size < 44 ? '8' : '10';
    return `
      <div class="station-logo-wrap" style="width:${size}px;height:${size}px;border-radius:${r}px">
        ${station.favicon
          ? `<img src="${escapeAttr(station.favicon)}" alt="" loading="lazy"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="station-logo-fallback" ${station.favicon ? 'style="display:none"' : ''}>
          <svg viewBox="0 0 24 24" fill="currentColor">${MUSIC_NOTE_ICON}</svg>
        </div>
      </div>`;
  }

  const PLAY_ICON_PAUSE  = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
  const PLAY_ICON_PLAY   = '<path d="M8 5v14l11-7z"/>';
  const MUSIC_NOTE_ICON  = '<path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>';
  const SEARCH_ICON      = '<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>';
  const ERROR_ICON       = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>';

  const FAV_ICON_ON  = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
  const FAV_ICON_OFF = '<path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/>';

  function updateFavBtn(stationUUID) {
    const isFav = Favorites.has(stationUUID);
    DOM.fpFavIcon.innerHTML = isFav ? FAV_ICON_ON : FAV_ICON_OFF;
    DOM.fpFavBtn.classList.toggle('active', isFav);
  }

  const SEARCH_EMPTY_HTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor">${SEARCH_ICON}</svg>
      <h3>Търси станции</h3>
      <p>Въведи име, жанр или избери страна</p>
    </div>`;

  function updateLogo(imgEl, fallbackEl, favicon) {
    if (favicon) {
      imgEl.src = favicon;
      imgEl.style.display = '';
      fallbackEl.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      fallbackEl.style.display = 'flex';
    }
  }

  function hasActiveSearch() {
    return !!(state.searchQuery || state.searchTag || state.searchCountry);
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatMeta(station) {
    const parts = [];
    if (station.tags) parts.push(station.tags.split(',')[0].trim());
    if (station.country) parts.push(station.country);
    return parts.join(' • ') || 'Radio';
  }

  function formatVotes(n) {
    if (!n) return '';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  function isCurrentStation(station) {
    const cur = Player.getStation();
    return cur && cur.stationuuid === station.stationuuid;
  }

  function skeletonList(count = 8) {
    return `<ul class="skeleton-list">${Array.from({ length: count }, () => `
      <li class="skeleton-card">
        <div class="skeleton-logo"></div>
        <div class="skeleton-text">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
        </div>
      </li>`).join('')}</ul>`;
  }

  // ─── Station card rendering ───────────────────────────────────────────
  function renderStationCard(station) {
    const playing = isCurrentStation(station) && (Player.isPlaying() || Player.isLoading());
    return `
      <li class="station-card${playing ? ' is-playing' : ''}" data-uuid="${escapeAttr(station.stationuuid)}">
        ${stationLogoHTML(station)}
        <div class="station-info">
          <div class="station-name">${escapeAttr(station.name)}</div>
          <div class="station-meta">${escapeAttr(formatMeta(station))}</div>
        </div>
        ${station.votes ? `
          <div class="station-votes">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
            ${formatVotes(station.votes)}
          </div>` : ''}
      </li>`;
  }

  function renderStationList(stations) {
    if (!stations.length) {
      return `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">${ERROR_ICON}</svg>
        <h3>Няма намерени станции</h3>
        <p>Опитай с различни ключови думи или филтри</p>
      </div>`;
    }
    return `<ul class="stations-list">${stations.map(renderStationCard).join('')}</ul>`;
  }

  // ─── Navigation ───────────────────────────────────────────────────────
  function navigate(viewName) {
    if (state.currentView === viewName) return;
    state.currentView = viewName;

    Object.entries(DOM.views).forEach(([name, el]) => {
      el.classList.toggle('active', name === viewName);
    });
    DOM.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    if (viewName === 'home' && !state.homeStations.length) loadHome();
    if (viewName === 'favorites') renderFavoritesView();
    if (viewName === 'search') {
      if (!state.tags.length) loadFilterData();
      setTimeout(() => { const inp = document.getElementById('search-input'); if (inp) inp.focus(); }, 300);
    }
  }

  // ─── Home View ────────────────────────────────────────────────────────
  const HOME_CATEGORIES = [
    { id: 'bg', label: 'България', icon: '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>' },
    { id: 'top', label: 'Топ', icon: '<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm4.24 16L12 15.45 7.77 18l1.12-4.81-3.73-3.23 4.92-.42L12 5l1.92 4.53 4.92.42-3.73 3.23L16.23 18z"/>' },
    { id: 'pop', label: 'Pop', icon: MUSIC_NOTE_ICON },
    { id: 'rock', label: 'Rock', icon: MUSIC_NOTE_ICON },
    { id: 'jazz', label: 'Jazz', icon: MUSIC_NOTE_ICON },
    { id: 'classical', label: 'Класика', icon: MUSIC_NOTE_ICON },
    { id: 'dance', label: 'Dance', icon: MUSIC_NOTE_ICON },
    { id: 'news', label: 'Новини', icon: '<path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>' }
  ];

  function renderHomeView() {
    const isBG = state.homeCategory === 'bg';
    const featuredSection = isBG && state.homeFeatured.length ? `
      <div class="section-header">
        <span class="section-title">Препоръчани</span>
      </div>
      <ul class="stations-list">${state.homeFeatured.map(renderStationCard).join('')}</ul>
      <div class="section-header" style="margin-top:8px">
        <span class="section-title">Всички български</span>
      </div>` : '';

    DOM.views.home.innerHTML = `
      <div class="section-header">
        <span class="section-title">Категории</span>
      </div>
      <div class="category-scroll">
        ${HOME_CATEGORIES.map(c => `
          <button class="category-chip${state.homeCategory === c.id ? ' active' : ''}" data-cat="${c.id}">
            <svg viewBox="0 0 24 24" fill="currentColor">${c.icon}</svg>
            ${c.label}
          </button>`).join('')}
      </div>
      ${!isBG ? `<div class="section-header">
        <span class="section-title">${getCategoryLabel(state.homeCategory)}</span>
      </div>` : ''}
      <div id="home-list">
        ${state.isLoading ? skeletonList() : featuredSection + renderStationList(state.homeStations)}
      </div>`;

    DOM.views.home.querySelectorAll('.category-chip').forEach(chip => {
      chip.addEventListener('click', () => loadHomeCategory(chip.dataset.cat));
    });
  }

  function getCategoryLabel(cat) {
    const map = { top: 'Топ станции', pop: 'Pop', rock: 'Rock', jazz: 'Jazz', classical: 'Класика', dance: 'Dance', news: 'Новини', bg: 'България' };
    return map[cat] || cat;
  }

  async function loadHomeCategory(cat) {
    state.homeCategory = cat;
    state.isLoading = true;
    renderHomeView();
    try {
      if (cat === 'top') {
        state.homeStations = await RadioAPI.getTopStations(50);
        state.homeFeatured = [];
      } else if (cat === 'bg') {
        const result = await RadioAPI.getFeaturedBulgarian();
        state.homeFeatured = result.featured;
        state.homeStations = result.all.filter(s => !result.featured.find(f => f.stationuuid === s.stationuuid));
      } else {
        state.homeStations = await RadioAPI.getByTag(cat, 50);
      }
    } catch (e) {
      state.homeStations = [];
      showToast('Грешка при зареждане');
    }
    state.isLoading = false;
    renderHomeView();
  }

  async function loadHome() {
    await loadHomeCategory('bg');
  }

  // ─── Search View ──────────────────────────────────────────────────────
  async function loadFilterData() {
    try {
      const [tags, countries] = await Promise.all([
        RadioAPI.getTags(30),
        RadioAPI.getCountries(40)
      ]);
      state.tags = tags.filter(t => t.name && t.stationcount > 10);
      state.countries = countries.filter(c => c.name && c.stationcount > 5);
      renderSearchFilters();
    } catch (_) { /* non-critical */ }
  }

  function renderSearchView() {
    DOM.views.search.innerHTML = `
      <div class="search-bar-wrap">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="currentColor">${SEARCH_ICON}</svg>
          <input type="search" id="search-input" placeholder="Търси радио станция..." autocomplete="off" autocorrect="off" value="${escapeAttr(state.searchQuery)}">
        </div>
      </div>
      <div id="search-filters">
        ${renderFiltersHTML()}
      </div>
      <div id="search-results">
        ${hasActiveSearch()
          ? (state.isLoading ? skeletonList() : renderStationList(state.searchResults))
          : SEARCH_EMPTY_HTML}
      </div>`;

    bindSearchInput();
  }

  function renderFiltersHTML() {
    if (!state.tags.length && !state.countries.length) return '';
    return `
      <div class="filter-row">
        <button class="filter-chip${!state.searchTag && !state.searchCountry ? ' active' : ''}" data-filter-type="clear">Всички</button>
        ${state.countries.slice(0, 20).map(c => `
          <button class="filter-chip${state.searchCountry === c.iso_3166_1 ? ' active' : ''}"
            data-filter-type="country" data-filter-val="${escapeAttr(c.iso_3166_1)}">
            ${escapeAttr(c.name)}
          </button>`).join('')}
      </div>
      <div class="filter-row">
        ${state.tags.slice(0, 25).map(t => `
          <button class="filter-chip${state.searchTag === t.name ? ' active' : ''}"
            data-filter-type="tag" data-filter-val="${escapeAttr(t.name)}">
            ${escapeAttr(t.name)}
          </button>`).join('')}
      </div>`;
  }

  function renderSearchFilters() {
    const el = document.getElementById('search-filters');
    if (el) el.innerHTML = renderFiltersHTML();
  }

  let searchDebounce = null;
  function bindSearchInput() {
    const inp = document.getElementById('search-input');
    if (!inp) return;
    inp.addEventListener('input', () => {
      state.searchQuery = inp.value.trim();
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(doSearch, 400);
    });

    document.getElementById('search-filters')?.addEventListener('click', e => {
      const chip = e.target.closest('[data-filter-type]');
      if (!chip) return;
      const type = chip.dataset.filterType;
      if (type === 'clear') {
        state.searchTag = '';
        state.searchCountry = '';
      } else if (type === 'country') {
        state.searchCountry = state.searchCountry === chip.dataset.filterVal ? '' : chip.dataset.filterVal;
        state.searchTag = '';
      } else if (type === 'tag') {
        state.searchTag = state.searchTag === chip.dataset.filterVal ? '' : chip.dataset.filterVal;
        state.searchCountry = '';
      }
      renderSearchFilters();
      doSearch();
    });
  }

  async function doSearch() {
    if (!state.searchQuery && !state.searchTag && !state.searchCountry) {
      state.searchResults = [];
      renderSearchResults();
      return;
    }
    state.isLoading = true;
    renderSearchResults();
    try {
      state.searchResults = await RadioAPI.searchStations(state.searchQuery, {
        countrycode: state.searchCountry,
        tag: state.searchTag,
        limit: 60
      });
    } catch (_) {
      state.searchResults = [];
      showToast('Грешка при търсене');
    }
    state.isLoading = false;
    renderSearchResults();
  }

  function renderSearchResults() {
    const el = document.getElementById('search-results');
    if (!el) return;
    if (!state.searchQuery && !state.searchTag && !state.searchCountry) {
      el.innerHTML = SEARCH_EMPTY_HTML;
      return;
    }
    el.innerHTML = state.isLoading ? skeletonList() : renderStationList(state.searchResults);
  }

  // ─── Favorites View ───────────────────────────────────────────────────
  function renderFavoritesView() {
    const favs = Favorites.getAll();
    DOM.views.favorites.innerHTML = `
      <div class="section-header">
        <span class="section-title">Любими станции</span>
        ${favs.length ? `<span class="badge">${favs.length}</span>` : ''}
      </div>
      ${favs.length
        ? `<ul class="stations-list">${favs.map(renderStationCard).join('')}</ul>`
        : `<div class="empty-state">
            <svg viewBox="0 0 24 24" fill="currentColor">${FAV_ICON_ON}</svg>
            <h3>Няма любими станции</h3>
            <p>Добави станции с натискане на сърцето в плейъра</p>
          </div>`}`;
  }

  // ─── Station list click delegation ───────────────────────────────────
  function handleStationClick(e) {
    const card = e.target.closest('.station-card');
    if (!card) return;
    const uuid = card.dataset.uuid;

    // Find station in all possible lists
    const allLists = [state.homeFeatured, state.homeStations, state.searchResults, Favorites.getAll()];
    let station = null;
    for (const list of allLists) {
      station = list.find(s => s.stationuuid === uuid);
      if (station) break;
    }
    if (!station) return;

    if (isCurrentStation(station)) {
      // Same station: toggle play/pause or open player
      openFullPlayer();
    } else {
      Player.load(station);
      openFullPlayer();
    }
  }

  // ─── Mini Player ──────────────────────────────────────────────────────
  function updateMiniPlayer(station, playerState) {
    if (!station) {
      DOM.miniPlayer.classList.add('hidden');
      DOM.nowPlayingBadge.classList.add('hidden');
      return;
    }

    DOM.miniPlayer.classList.remove('hidden');

    updateLogo(DOM.miniLogo, DOM.miniLogoFallback, station.favicon);

    DOM.miniName.textContent = station.name;
    DOM.miniMeta.textContent = formatMeta(station);

    const isPlaying = playerState === 'playing';
    const isLoading = playerState === 'loading';

    DOM.miniPlayer.classList.toggle('is-playing', isPlaying);
    DOM.miniLoading.classList.toggle('hidden', !isLoading);
    DOM.miniPlayBtn.classList.toggle('hidden', isLoading);

    DOM.miniPlayIcon.innerHTML = isPlaying ? PLAY_ICON_PAUSE : PLAY_ICON_PLAY;

    DOM.nowPlayingBadge.classList.toggle('hidden', !isPlaying);
  }

  function openFullPlayer() {
    DOM.fullPlayer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateFullPlayer(Player.getStation(), Player.getState());
  }

  function closeFullPlayer() {
    DOM.fullPlayer.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ─── Full Player ──────────────────────────────────────────────────────
  function updateFullPlayer(station, playerState) {
    if (!station) return;

    updateLogo(DOM.fpLogo, DOM.fpLogoFallback, station.favicon);

    DOM.fpName.textContent = station.name;
    DOM.fpMeta.textContent = formatMeta(station);
    DOM.fpBitrate.textContent = station.bitrate ? `${station.bitrate} kbps • ${station.codec || ''}` : '';

    const isPlaying = playerState === 'playing';
    const isLoading = playerState === 'loading';
    const isError = playerState === 'error';

    DOM.fpSpinner.classList.toggle('hidden', !isLoading);
    DOM.fpStatus.classList.toggle('hidden', isLoading || isError);
    DOM.fpError.classList.toggle('hidden', !isError);

    DOM.fpPlayBtn.classList.toggle('is-playing', isPlaying);
    DOM.fpPlayIcon.innerHTML = isPlaying ? PLAY_ICON_PAUSE : PLAY_ICON_PLAY;

    DOM.radioWaves.classList.toggle('active', isPlaying);

    // Favorite button
    updateFavBtn(station.stationuuid);

    if (isError) {
      DOM.fpErrorText.textContent = 'Неуспешно свързване. Опитайте пак.';
    }
  }

  function refreshCurrentCards() {
    document.querySelectorAll('.station-card').forEach(card => {
      const s = Player.getStation();
      const playing = s && s.stationuuid === card.dataset.uuid && (Player.isPlaying() || Player.isLoading());
      card.classList.toggle('is-playing', playing);
      if (playing) {
        card.querySelector('.station-name')?.style && (card.querySelector('.station-name').style.color = '');
      }
    });
  }

  // ─── Now Playing ──────────────────────────────────────────────────────
  function updateNowPlayingUI(title) {
    if (title) {
      DOM.fpNowPlayingText.textContent = title;
      DOM.fpNowPlaying.classList.remove('hidden');
    } else {
      DOM.fpNowPlaying.classList.add('hidden');
    }
    const station = Player.getStation();
    if (station) {
      DOM.miniMeta.textContent = title || formatMeta(station);
    }
  }

  NowPlaying.on('update', title => updateNowPlayingUI(title));

  // ─── Player event listeners ───────────────────────────────────────────
  Player.on('stateChange', ({ state: ps, station }) => {
    updateMiniPlayer(station, ps);
    if (!DOM.fullPlayer.classList.contains('hidden')) {
      updateFullPlayer(station, ps);
    }
    refreshCurrentCards();
    if (ps === 'playing' && station) NowPlaying.start(station);
    else if (ps === 'idle' || ps === 'error') NowPlaying.stop();
  });

  Player.on('stationChange', station => {
    NowPlaying.stop();
    updateMiniPlayer(station, Player.getState());
    if (!DOM.fullPlayer.classList.contains('hidden')) {
      updateFullPlayer(station, Player.getState());
    }
    refreshCurrentCards();
  });

  // ─── Favorites events ─────────────────────────────────────────────────
  window.addEventListener('favoritesChanged', () => {
    if (state.currentView === 'favorites') renderFavoritesView();
    const s = Player.getStation();
    if (s && !DOM.fullPlayer.classList.contains('hidden')) {
      updateFavBtn(s.stationuuid);
    }
  });

  // ─── Event bindings ───────────────────────────────────────────────────
  function bindEvents() {
    // Navigation
    DOM.navBtns.forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.view));
    });

    // Station list clicks (delegated to #app)
    document.getElementById('app').addEventListener('click', handleStationClick);

    // Mini player expand
    DOM.miniExpand.addEventListener('click', openFullPlayer);

    // Mini play btn (stop propagation so it doesn't also open player)
    DOM.miniPlayBtn.addEventListener('click', e => {
      e.stopPropagation();
      Player.togglePlay();
    });

    // Full player close
    DOM.fpClose.addEventListener('click', closeFullPlayer);

    // Full player play
    DOM.fpPlayBtn.addEventListener('click', () => {
      const s = Player.getStation();
      if (Player.getState() === 'error' && s) {
        Player.load(s);
      } else {
        Player.togglePlay();
      }
    });

    // Favorite button
    DOM.fpFavBtn.addEventListener('click', () => {
      const s = Player.getStation();
      if (!s) return;
      const added = Favorites.toggle(s);
      showToast(added ? `"${s.name}" добавена в любими` : `"${s.name}" премахната от любими`);
    });

    // Volume
    DOM.volumeSlider.addEventListener('input', () => {
      Player.setVolume(DOM.volumeSlider.value / 100);
    });

    // Close full player on backdrop (swipe down gesture)
    let touchStartY = 0;
    DOM.fullPlayer.addEventListener('touchstart', e => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    DOM.fullPlayer.addEventListener('touchmove', e => {
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 60) closeFullPlayer();
    }, { passive: true });

    // Hash routing
    window.addEventListener('hashchange', handleHash);
  }

  function handleHash() {
    const hash = window.location.hash.slice(1);
    if (['home', 'search', 'favorites'].includes(hash)) navigate(hash);
  }

  // ─── Search view init ─────────────────────────────────────────────────
  function initSearchView() {
    renderSearchView();
    // Re-bind on each navigate to search (already called in renderSearchView > bindSearchInput)
  }

  // (navigate is used directly throughout the app)

  // ─── Service Worker registration ─────────────────────────────────────
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* non-critical */ });
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────
  function init() {
    // Init views with empty state
    renderHomeView();
    initSearchView();
    renderFavoritesView();

    bindEvents();
    registerSW();

    // Handle hash on load
    handleHash();

    // Load home data
    loadHome();

    // Load filter data for search in background
    loadFilterData();
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
