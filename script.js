// script.js – Google Keep clone application logic
(function() {
  const STORAGE_KEY = 'keep-clone-v1';
  let notes = loadNotes();
  let view = 'notes';    // 'notes' | 'reminders' | 'labels' | 'archive' | 'bin'
  let query = '';
  let editingId = null;

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const listEl = document.getElementById('notesList');
  const searchField = document.getElementById('searchInput');
  const composerInput = document.getElementById('composerInput');
  const newNoteBtn = document.getElementById('newNoteBtn');
  const modal = document.getElementById('noteModal');
  const form = document.getElementById('noteForm');
  const titleField = document.getElementById('noteTitle');
  const textField = document.getElementById('noteText');
  const modalTitle = document.getElementById('modalTitle');
  const modalTimestamp = document.getElementById('modalTimestamp');
  const cancelBtn = document.getElementById('cancelNote');
  const binNotice = document.getElementById('binNotice');
  const layoutToggle = document.getElementById('layoutToggle');
  const refreshBtn = document.getElementById('refreshButton');
  const sideLinks = document.querySelectorAll('.side-link');
  const sidebarMenuToggle = document.getElementById('sidebarMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  const brandText = document.getElementById('brandText');

  let sidebarVisible = true;

  // Sidebar toggle (hamburger)
  sidebarMenuToggle.addEventListener('click', () => {
    sidebarVisible = !sidebarVisible;
    sidebar.style.transform = sidebarVisible ? 'translateX(0)' : 'translateX(-100%)';
    if (window.innerWidth <= 600) {
      sidebar.style.display = sidebarVisible ? 'flex' : 'none';
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 600 && sidebar.style.display === 'none') {
      sidebar.style.display = 'flex';
      sidebarVisible = true;
      sidebar.style.transform = 'translateX(0)';
    }
    if (window.innerWidth <= 600 && sidebarVisible === false) {
      sidebar.style.display = 'none';
    }
  });

  function visibleNotes() {
    const term = query.trim().toLowerCase();
    if (view === 'reminders' || view === 'labels') {
      return notes.filter(n => {
        if (n.deleted) return false;
        if (!term) return true;
        return (n.title + ' ' + n.text).toLowerCase().includes(term);
      });
    }
    return notes.filter(n => {
      const matchView = view === 'bin' ? n.deleted : view === 'archive' ? (n.archived && !n.deleted) : (!n.archived && !n.deleted);
      if (!matchView) return false;
      if (!term) return true;
      return (n.title + ' ' + n.text).toLowerCase().includes(term);
    });
  }

  function render() {
    const items = visibleNotes();
    const showComposer = (view === 'notes');
    document.querySelector('.composer-section').style.display = showComposer ? '' : 'none';
    binNotice.classList.toggle('hidden', view !== 'bin');

    const headingMap = {
      'notes': 'Keep',
      'reminders': 'Reminders',
      'labels': 'Edit labels',
      'archive': 'Archive',
      'bin': 'Bin'
    };
    brandText.textContent = headingMap[view] || 'Keep';

    if (items.length === 0) {
      let msg = query.trim() ? 'No matching notes' : 'No notes yet';
      if (view === 'archive') msg = query.trim() ? 'No archived notes match' : 'No archived notes';
      else if (view === 'bin') msg = query.trim() ? 'No items in bin match' : 'Bin is empty';
      else if (view === 'reminders') msg = query.trim() ? 'No reminders match' : 'No reminders yet';
      else if (view === 'labels') msg = query.trim() ? 'No labels match' : 'No labels yet';
      listEl.innerHTML = `<div class="empty-note">${msg}</div>`;
    } else {
      listEl.innerHTML = items.map((n, idx) => {
        const title = esc(n.title || '');
        const text = esc(n.text || '');
        let actions = '';
        if (view === 'bin') {
          actions = `
            <button data-action="restore" title="Restore"><svg viewBox="0 0 24 24"><path d="M4 10a8 8 0 1 1 2.34 5.66" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4 4v6h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
            <button data-action="wipe" title="Delete forever"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
          `;
        } else {
          const archiveLabel = n.archived ? 'Unarchive' : 'Archive';
          actions = `
            <button data-action="edit" title="Edit"><svg viewBox="0 0 24 24"><path d="M4 20h4L18 10l-4-4L4 16v4Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg></button>
            <button data-action="archive" title="${archiveLabel}"><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="4" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M10 12.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            <button data-action="delete" title="Move to Bin"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></button>
          `;
        }
        return `
          <div class="note-card" data-id="${n.id}" tabindex="0">
            ${title ? `<div class="note-title">${title}</div>` : ''}
            ${text ? `<div class="note-text">${text}</div>` : ''}
            <div class="note-footer">
              <span class="note-timestamp">${fmtDate(n.updatedAt || n.createdAt)}</span>
              <div class="note-actions">${actions}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function runAction(action, id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    if (action === 'edit') {
      openModal(note);
      return;
    }
    if (action === 'archive') {
      note.archived = !note.archived;
      save(); render();
      return;
    }
    if (action === 'delete') {
      note.deleted = true;
      save(); render();
      return;
    }
    if (action === 'restore') {
      note.deleted = false;
      save(); render();
      return;
    }
    if (action === 'wipe') {
      if (confirm('Delete permanently?')) {
        notes = notes.filter(n => n.id !== id);
        save(); render();
      }
    }
  }

  function openModal(note = null) {
    if (note) {
      editingId = note.id;
      modalTitle.textContent = 'Edit note';
      titleField.value = note.title || '';
      textField.value = note.text || '';
      modalTimestamp.textContent = note.updatedAt ? `Edited ${fmtDate(note.updatedAt)}` : '';
    } else {
      editingId = null;
      modalTitle.textContent = 'New note';
      form.reset();
      modalTimestamp.textContent = '';
    }
    modal.classList.remove('hidden');
    titleField.focus();
  }
  function closeModal() {
    modal.classList.add('hidden');
    form.reset();
    editingId = null;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleField.value.trim();
    const text = textField.value.trim();
    if (!title && !text) { closeModal(); return; }
    const now = new Date().toISOString();
    if (editingId) {
      notes = notes.map(n => n.id === editingId ? { ...n, title, text, updatedAt: now } : n);
    } else {
      notes.unshift({ id: uid(), title, text, archived: false, deleted: false, createdAt: now, updatedAt: now });
    }
    save(); render(); closeModal();
  });

  composerInput.addEventListener('click', () => openModal());
  newNoteBtn.addEventListener('click', () => openModal());
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.note-card');
    if (!card) return;
    const id = card.dataset.id;
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      runAction(actionBtn.dataset.action, id);
      return;
    }
    if (view === 'bin' || view === 'reminders' || view === 'labels') return;
    const note = notes.find(n => n.id === id);
    if (note) openModal(note);
  });

  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.note-card');
    if (!card || e.target.closest('button')) return;
    e.preventDefault();
    if (view === 'bin' || view === 'reminders' || view === 'labels') return;
    const note = notes.find(n => n.id === card.dataset.id);
    if (note) openModal(note);
  });

  searchField.addEventListener('input', (e) => { query = e.target.value; render(); });

  refreshBtn.addEventListener('click', () => {
    notes = loadNotes();
    render();
  });

  layoutToggle.addEventListener('click', () => {
    listEl.classList.toggle('is-list');
    const isList = listEl.classList.contains('is-list');
    layoutToggle.innerHTML = isList
      ? `<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`
      : `<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`;
    layoutToggle.setAttribute('data-tooltip', isList ? 'Grid view' : 'List view');
  });

  sideLinks.forEach(link => {
    link.addEventListener('click', () => {
      sideLinks.forEach(l => l.classList.remove('is-active'));
      link.classList.add('is-active');
      view = link.dataset.section;
      render();
    });
  });

  render();

  if (notes.length === 0) {
    const demo = [
      { id: uid(), title: 'Welcome to Keep', text: 'Click "Take a note" to create your first note. Try archiving or moving to bin.', archived: false, deleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uid(), title: 'Shopping list', text: '• Milk\n• Eggs\n• Bread', archived: false, deleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    notes = demo;
    save();
    render();
  }
})();