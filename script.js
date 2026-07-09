// script.js – Google Keep clone application logic
(function() {
  const STORAGE_KEY = 'keep-clone-v1';
  const COLORS = ['#fff8dc', '#f28482', '#f691b2', '#fb78d4', '#fde047', '#81c995', '#a7d8de', '#c6c3e1', '#e6c9a8'];
  let notes = loadNotes();
  let view = 'notes';
  let query = '';
  let editingId = null;
  let currentNoteColor = COLORS[0];

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
  const closeModalBtn = document.getElementById('closeModalBtn');
  const binNotice = document.getElementById('binNotice');
  const layoutToggle = document.getElementById('layoutToggle');
  const refreshBtn = document.getElementById('refreshButton');
  const sideLinks = document.querySelectorAll('.side-link');
  const sidebarMenuToggle = document.getElementById('sidebarMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  const brandText = document.getElementById('brandText');

  let sidebarVisible = true;

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
      return notes.filter(n => {});
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
      listEl.innerHTML = `<div class="empty-note">${msg}</div>`;
    } else {
      listEl.innerHTML = items.map((n, idx) => {
        const title = esc(n.title || '');
        const text = esc(n.text || '');
        const bgColor = n.color || COLORS[0];
        let actions = '';
        if (view === 'bin') {
          actions = `<button type="button" data-action="restore" title="Restore"><svg viewBox="0 0 24 24"><path d="M5 11h14M11 7v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
            <button type="button" data-action="wipe" title="Delete forever"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>`;
        } else {
          actions = `<button type="button" data-action="edit" title="Edit"><svg viewBox="0 0 24 24"><path d="m5 19 1-4L17 4l3 3L9 18l-4 1Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg></button>
            <button type="button" data-action="archive" title="Archive"><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="4" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>
            <button type="button" data-action="delete" title="Delete"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.6" fill="none"/></svg></button>`;
        }
        return `
          <div class="note-card" data-id="${n.id}" style="background-color: ${bgColor}" tabindex="0">
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
      notes = notes.filter(n => n.id !== id);
      save(); render();
      return;
    }
  }

  function renderColorPicker() {
    const note = editingId ? notes.find(n => n.id === editingId) : null;
    const currentColor = note?.color || COLORS[0];
    let colorHtml = '<div class="color-picker">';
    COLORS.forEach(color => {
      const isActive = color === currentColor ? 'active' : '';
      colorHtml += `<button type="button" class="color-btn ${isActive}" style="background-color: ${color}" data-color="${color}" title="Color"></button>`;
    });
    colorHtml += '</div>';
    const footer = document.querySelector('.modal-footer');
    let existing = footer.querySelector('.color-picker');
    if (existing) existing.remove();
    footer.insertAdjacentHTML('afterbegin', colorHtml);
    
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentNoteColor = btn.dataset.color;
      });
    });
  }

  function openModal(note = null) {
    if (note) {
      editingId = note.id;
      modalTitle.textContent = 'Edit note';
      titleField.value = note.title || '';
      textField.value = note.text || '';
      currentNoteColor = note.color || COLORS[0];
      modalTimestamp.textContent = note.updatedAt ? `Edited ${fmtDate(note.updatedAt)}` : '';
    } else {
      editingId = null;
      modalTitle.textContent = 'New note';
      form.reset();
      currentNoteColor = COLORS[0];
      modalTimestamp.textContent = '';
    }
    renderColorPicker();
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
      notes = notes.map(n => n.id === editingId ? { ...n, title, text, color: currentNoteColor, updatedAt: now } : n);
    } else {
      notes.unshift({ id: uid(), title, text, color: currentNoteColor, archived: false, deleted: false, createdAt: now, updatedAt: now });
    }
    save(); render(); closeModal();
  });

  composerInput.addEventListener('click', () => openModal());
  newNoteBtn.addEventListener('click', () => openModal());
  cancelBtn.addEventListener('click', closeModal);
  closeModalBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('.note-card');
    if (!card) return;
    const id = card.dataset.id;
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
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
      : `<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    layoutToggle.setAttribute('data-tooltip', isList ? 'Grid view' : 'List view');
  });

  sideLinks.forEach(link => {
    link.addEventListener('click', () => {
      sideLinks.forEach(l => l.classList.remove('is-active'));
      link.classList.add('is-active');
      view = link.dataset.section;
      render();
      if (window.innerWidth <= 600) {
        sidebarVisible = false;
        sidebar.style.display = 'none';
        sidebar.style.transform = 'translateX(-100%)';
      }
    });
  });

  render();

  if (notes.length === 0) {
    const demo = [
      { id: uid(), title: 'Welcome to Keep', text: 'Click "Take a note" to create your first note. Try archiving or moving to bin.', color: COLORS[3], archived: false, deleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: uid(), title: 'Shopping list', text: '• Milk\n• Eggs\n• Bread', color: COLORS[4], archived: false, deleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    notes = demo;
    save();
    render();
  }
})();