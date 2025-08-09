(function () {
  if (window.FavBoard?.__booted) return;
  window.FavBoard = window.FavBoard || {};
  window.FavBoard.__booted = true;

  const { Storage, DnD } = window.FavBoard;

  const state = Storage.load(); // { theme, density, items:[{id,name,url,tags[],pin}], order:[ids] }
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const uid = () => Math.random().toString(36).slice(2, 10);

  function init() {
    // Theme & density
    applyTheme(state.theme);
    applyDensity(state.density);
    $('#theme').value = state.theme;
    $('#density').value = state.density;

    $('#theme').addEventListener('change', () => {
      state.theme = $('#theme').value;
      Storage.save(state);
      applyTheme(state.theme);
    });
    $('#density').addEventListener('change', () => {
      state.density = $('#density').value;
      Storage.save(state);
      applyDensity(state.density);
    });

    // Controls
    $('#openAll').addEventListener('click', openAllFiltered);
    $('#exportBtn').addEventListener('click', doExport);
    $('#importFile').addEventListener('change', doImport);
    $('#wipeBtn').addEventListener('click', () => {
      if (!confirm('Wipe all data?')) return;
      Storage.wipe();
      Object.assign(state, Storage.load());
      render();
    });

    // Search
    $('#search').addEventListener('input', render);
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && (document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        $('#search').focus();
      } else if (e.key.toLowerCase() === 'n' && (document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        $('#siteName').focus();
      }
    });

    // Add form
    $('#addForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#siteName').value.trim();
      let url = $('#siteUrl').value.trim();
      const tagsRaw = $('#siteTags').value.trim();

      if (!name || !url) return;
      url = ensureProtocol(url);

      const item = {
        id: uid(),
        name,
        url,
        tags: parseTags(tagsRaw),
        pin: false,
        created: Date.now()
      };
      state.items.push(item);
      state.order.push(item.id);
      Storage.save(state);

      $('#siteName').value = '';
      $('#siteUrl').value = '';
      $('#siteTags').value = '';

      render();
    });

    // Prefill profile avatar
    const meAvatar = $('#meAvatar');
    meAvatar.src = 'https://avatars.githubusercontent.com/u/9919?v=4'; // fallback generic GH mark
    fetch('https://api.github.com/users/Johannes61')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.avatar_url) meAvatar.src = u.avatar_url; })
      .catch(()=>{});

    render();
  }

  /* -------- Helpers -------- */
  function ensureProtocol(url) {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
  function parseTags(str) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }
  function filterMatches(item, query) {
    if (!query) return true;
    const q = query.toLowerCase().trim();

    // Tag search: #tag
    const tagQueries = q.split(/\s+/).filter(t => t.startsWith('#')).map(t => t.slice(1));
    const textQueries = q.split(/\s+/).filter(t => !t.startsWith('#'));

    const textBlob = `${item.name} ${item.url} ${item.tags.join(' ')}`.toLowerCase();

    const textOk = textQueries.every(t => textBlob.includes(t));
    const tagOk = tagQueries.every(t => item.tags.map(s => s.toLowerCase()).includes(t));
    return textOk && tagOk;
  }
  function faviconFor(url) {
    // Use DuckDuckGo IP3 favicon proxy for reliability (HTTPS + CORS)
    try {
      const u = new URL(url);
      return `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
    } catch {
      return `https://icons.duckduckgo.com/ip3/${url.replace(/^https?:\/\//,'')}.ico`;
    }
  }

  /* -------- Rendering -------- */
  function render() {
    const cards = $('#cards');
    cards.innerHTML = '';

    // Filter + sort: pinned first, then by order
    const q = $('#search').value || '';
    const byId = new Map(state.items.map(i => [i.id, i]));
    const ordered = state.order.map(id => byId.get(id)).filter(Boolean);

    const filtered = ordered.filter(i => filterMatches(i, q));
    const pinned = filtered.filter(i => i.pin);
    const others = filtered.filter(i => !i.pin);
    const finalList = [...pinned, ...others];

    if (finalList.length === 0) {
      cards.classList.add('empty');
      cards.innerHTML = `
        <div class="empty-state">No matches. Try clearing the search, or add a site.</div>
      `;
    } else {
      cards.classList.remove('empty');
      for (const item of finalList) {
        cards.appendChild(renderCard(item));
      }
    }

    // Enable drag-drop reordering (affects current filtered order):
    DnD.makeGridDroppable(cards, onReorderFromDom);

    // Make each card draggable
    $$('.card').forEach(el => DnD.makeDraggable(el));
  }

  function renderCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;

    const tagsHtml = item.tags.map(t => `<span class="chip">#${escapeHtml(t)}</span>`).join('');
    const fav = faviconFor(item.url);

    card.innerHTML = `
      <div class="row">
        <div class="left" style="display:flex;align-items:center;gap:8px;">
          <img class="favicon" src="${fav}" alt="" onerror="this.style.visibility='hidden'"/>
          <div>
            <div class="name">${escapeHtml(item.name)}</div>
            <div class="url">${escapeHtml(item.url)}</div>
          </div>
        </div>
        <div class="right">
          <button data-act="open" title="Open">Open</button>
        </div>
      </div>

      ${item.tags.length ? `<div class="chips">${tagsHtml}</div>` : ''}

      <div class="actions">
        <button class="ghost" data-act="pin">${item.pin ? 'Unpin' : 'Pin'}</button>
        <button class="ghost" data-act="edit">Edit</button>
        <button class="danger" data-act="delete">Delete</button>
      </div>
    `;

    card.querySelector('[data-act="open"]').addEventListener('click', () => {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    });
    card.querySelector('[data-act="pin"]').addEventListener('click', () => {
      item.pin = !item.pin;
      Storage.save(state);
      render();
    });
    card.querySelector('[data-act="edit"]').addEventListener('click', () => {
      const newName = prompt('Name', item.name); if (newName === null) return;
      const newUrl  = prompt('URL', item.url);  if (newUrl === null) return;
      const newTags = prompt('Tags (comma separated)', item.tags.join(', ')); if (newTags === null) return;
      item.name = newName.trim() || item.name;
      item.url  = ensureProtocol((newUrl.trim() || item.url));
      item.tags = parseTags(newTags);
      Storage.save(state);
      render();
    });
    card.querySelector('[data-act="delete"]').addEventListener('click', () => {
      if (!confirm('Delete this site?')) return;
      state.items = state.items.filter(i => i.id !== item.id);
      state.order = state.order.filter(id => id !== item.id);
      Storage.save(state);
      render();
    });

    return card;
  }

  // After a drag-drop completes, read DOM order and rebuild state.order:
  function onReorderFromDom() {
    const ids = $$('#cards .card').map(el => el.dataset.id);
    // Keep pinned first in the saved order as they appear in DOM
    state.order = ids;
    Storage.save(state);
  }

  /* -------- Actions -------- */
  function openAllFiltered() {
    const q = $('#search').value || '';
    const byId = new Map(state.items.map(i => [i.id, i]));
    const ordered = state.order.map(id => byId.get(id)).filter(Boolean);
    const filtered = ordered.filter(i => filterMatches(i, q));
    filtered.forEach(i => window.open(i.url, '_blank', 'noopener,noreferrer'));
  }

  function doExport() {
    const blob = new Blob([Storage.export()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'favboard-export.json'; a.click(); URL.revokeObjectURL(a.href);
  }

  async function doImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      await Storage.import(file);
      const d = Storage.load();
      Object.assign(state, d);
      applyTheme(state.theme);
      applyDensity(state.density);
      render();
      alert('Imported.');
    } catch (err) {
      alert('Import failed: ' + err);
    } finally {
      e.target.value = '';
    }
  }

  /* -------- Theme & density -------- */
  function applyTheme(t) {
    document.documentElement.classList.toggle('theme-deepblue', t === 'deepblue');
  }
  function applyDensity(d) {
    document.documentElement.classList.toggle('density-compact', d === 'compact');
  }

  /* -------- Utils -------- */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
