/**
 * Favorites management using localStorage
 * Stores station objects keyed by stationuuid
 */
const Favorites = (() => {
  const KEY = 'myradio7_favorites';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  return {
    getAll() {
      return Object.values(load());
    },

    add(station) {
      const data = load();
      data[station.stationuuid] = {
        stationuuid: station.stationuuid,
        name: station.name,
        url_resolved: station.url_resolved,
        url: station.url,
        favicon: station.favicon,
        tags: station.tags,
        country: station.country,
        countrycode: station.countrycode,
        bitrate: station.bitrate,
        codec: station.codec,
        votes: station.votes,
        savedAt: Date.now()
      };
      save(data);
      window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { id: station.stationuuid, action: 'add' } }));
    },

    remove(stationUUID) {
      const data = load();
      delete data[stationUUID];
      save(data);
      window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { id: stationUUID, action: 'remove' } }));
    },

    toggle(station) {
      if (this.has(station.stationuuid)) {
        this.remove(station.stationuuid);
        return false;
      } else {
        this.add(station);
        return true;
      }
    },

    has(stationUUID) {
      return !!load()[stationUUID];
    },

    count() {
      return Object.keys(load()).length;
    },

    clear() {
      save({});
      window.dispatchEvent(new CustomEvent('favoritesChanged', { detail: { action: 'clear' } }));
    }
  };
})();
