(function () {
  const STORE_KEY = 'favboard:v3';

  const Storage = {
    load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return { theme: 'light', density: 'comfort', sort: 'custom', items: [], order: [] };
        const d = JSON.parse(raw);
        return {
          theme: d.theme || 'light',
          density: d.density || 'comfort',
          sort: d.sort || 'custom',
          items: Array.isArray(d.items) ? d.items : [],
          order: Array.isArray(d.order) ? d.order : [],
        };
      } catch {
        return { theme: 'light', density: 'comfort', sort: 'custom', items: [], order: [] };
      }
    },
    save(data) { localStorage.setItem(STORE_KEY, JSON.stringify(data)); },
    export() { return JSON.stringify(Storage.load(), null, 2); },
    async import(file) {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.order)) throw new Error('Invalid file');
      localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
    },
    wipe() { localStorage.removeItem(STORE_KEY); }
  };

  window.FavBoard = window.FavBoard || {};
  window.FavBoard.Storage = Storage;
})();
