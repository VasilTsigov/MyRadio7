/**
 * radio-browser.info API wrapper
 * Docs: https://api.radio-browser.info/
 */
const RadioAPI = (() => {
  // Known stable servers as fallback
  const FALLBACK_SERVERS = [
    'de1.api.radio-browser.info',
    'nl1.api.radio-browser.info',
    'at1.api.radio-browser.info'
  ];

  let baseURL = null;

  // Discover the best available server
  async function getBaseURL() {
    if (baseURL) return baseURL;
    try {
      const res = await fetch('https://all.api.radio-browser.info/json/servers', {
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const servers = await res.json();
        if (servers.length > 0) {
          // Pick a random server for load balancing
          const picked = servers[Math.floor(Math.random() * Math.min(servers.length, 3))];
          baseURL = `https://${picked.name}/json`;
          return baseURL;
        }
      }
    } catch (_) {
      // Fall through to fallback
    }
    // Use first available fallback
    baseURL = `https://${FALLBACK_SERVERS[0]}/json`;
    return baseURL;
  }

  async function request(path, params = {}) {
    const base = await getBaseURL();
    const url = new URL(`${base}/${path}`);
    // Always add these for better results
    params.hidebroken = 'true';
    params.order = params.order || 'votes';
    params.reverse = 'true';
    if (params.is_https === undefined) params.is_https = 'true';
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'myRadio7/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  return {
    /**
     * Get top stations globally
     */
    getTopStations(limit = 40) {
      return request('stations/search', {
        limit,
        order: 'votes',
        reverse: 'true',
        is_https: 'true'
      });
    },

    /**
     * Get trending (most clicked recently)
     */
    getTrending(limit = 20) {
      return request('stations/topclick', { limit });
    },

    /**
     * Search stations
     * @param {string} query - station name
     * @param {object} filters - { countrycode, tag, limit }
     */
    searchStations(query, filters = {}) {
      return request('stations/search', {
        name: query || undefined,
        countrycode: filters.countrycode || undefined,
        tag: filters.tag || undefined,
        limit: filters.limit || 50,
        order: 'votes'
      });
    },

    /**
     * Get stations by tag (genre)
     */
    getByTag(tag, limit = 40) {
      return request('stations/bytag/' + encodeURIComponent(tag), { limit });
    },

    /**
     * Get stations by country code (ISO 3166)
     */
    getByCountry(countrycode, limit = 40) {
      return request('stations/search', { countrycode, limit });
    },

    /**
     * Get featured Bulgarian stations — searches by name from a large BG pool
     */
    async getFeaturedBulgarian() {
      const all = await request('stations/search', { countrycode: 'BG', limit: 200 });
      // Search terms mapped to display names for better matching
      const targets = [
        'btv radio',
        'nova news',
        'horizont',
        'bgradio',
        'bg radio',
        'radio 1',
        'hristo botev',
        'klasicheskite',
        'класически'
      ];
      const found = [];
      const used = new Set();
      for (const target of targets) {
        const match = all.find(s =>
          s.name.toLowerCase().includes(target) && !used.has(s.stationuuid)
        );
        if (match) {
          found.push(match);
          used.add(match.stationuuid);
        }
      }
      // Return featured first, then the rest
      const rest = all.filter(s => !used.has(s.stationuuid));
      return { featured: found, all: [...found, ...rest] };
    },

    /**
     * Get list of available tags (genres) - top 50
     */
    async getTags(limit = 50) {
      const base = await getBaseURL();
      const url = `${base}/tags?order=stationcount&reverse=true&limit=${limit}&hidebroken=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Tags fetch failed');
      return res.json();
    },

    /**
     * Get list of countries with stations
     */
    async getCountries(limit = 60) {
      const base = await getBaseURL();
      const url = `${base}/countries?order=stationcount&reverse=true&limit=${limit}&hidebroken=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Countries fetch failed');
      return res.json();
    },

    /**
     * Click/play a station (informs the API, helps ranking)
     */
    async clickStation(stationUUID) {
      try {
        const base = await getBaseURL();
        await fetch(`${base}/url/${stationUUID}`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
      } catch (_) { /* non-critical */ }
    },

    /**
     * Get stations by multiple UUIDs (for favorites)
     */
    async getStationsByUUIDs(uuids) {
      if (!uuids.length) return [];
      const base = await getBaseURL();
      const url = `${base}/stations/byuuid?uuids=${uuids.join(',')}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('UUID fetch failed');
      return res.json();
    }
  };
})();
