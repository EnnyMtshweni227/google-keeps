/**
 * Scratch — Quick Notes
 * ---------------------------------------------------------------
 * A small notes application: create, edit, colour, pin, archive,
 * soft-delete (bin), restore, and permanently delete notes.
 * Notes persist to localStorage. No build step, no dependencies.
 * ---------------------------------------------------------------
 */

(() => {
  "use strict";

  /** localStorage key. Bumped from prior clones to avoid stale data shapes. */
  const STORAGE_KEY = "scratch-notes-v1";

  /** Available note colours. `value` is stored on the note; `hex` drives the swatch UI. */
  const SWATCHES = [
    { value: "default", hex: "var(--surface)", label: "Default" },
    { value: "sage", hex: "var(--swatch-sage)", label: "Sage" },
    { value: "sand", hex: "var(--swatch-sand)", label: "Sand" },
    { value: "blush", hex: "var(--swatch-blush)", label: "Blush" },
    { value: "sky", hex: "var(--swatch-sky)", label: "Sky" },
    { value: "lilac", hex: "var(--swatch-lilac)", label: "Lilac" },
    { value: "coral", hex: "var(--swatch-coral)", label: "Coral" },
  ];

  /** Accent bar colour (left edge of card) per swatch, distinct from the fill. */
  const ACCENT_BY_SWATCH = {
    default: "var(--pine)",
    sage: "#6f9c7f",
    sand: "#c99a4a",
    blush: "#c97b6a",
    sky: "#5f8faa",
    lilac: "#8a72a3",
    coral: "#c9673f",
  };

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------

  /**
   * @typedef {Object} Note
   * @property {string} id
   * @property {string} title
   * @property {string} text
   * @property {string} color        - one of SWATCHES[].value
   * @property {boolean} pinned
   * @property {boolean} archived
   * @property {boolean} deleted
   * @property {string} createdAt    - ISO timestamp
   * @property {string} updatedAt    - ISO timestamp
   */

  const state = {
    /** @type {Note[]} */
    notes: loadNotes(),
    editingId: /** @type {string|null} */ (null),
    currentView: /** @type {"notes"|"archive"|"bin"} */ ("notes"),
    searchTerm: "",
    isListView: false,
    composerColor: "default",
    composerPinned: false,
  };

  /** Holds a note pending permanent removal so "Undo" can restore it. */
  let pendingDeletion = null;
  let toastTimer = null;

  // -----------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------

  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");
  const navItems = document.querySelectorAll(".nav-item[data-view]");

  const searchInput = document.getElementById("searchInput");
  const viewToggle = document.getElementById("viewToggle");

  const composerForm = document.getElementById("composerForm");
  const composerTitle = document.getElementById("composerTitle");
  const composerText = document.getElementById("composerText");
  const composerSwatches = document.getElementById("composerSwatches");
  const composerPinBtn = document.getElementById("composerPin");
  const composerCancelBtn = document.getElementById("composerCancel");

  const emptyState = document.getElementById("emptyState");
  const emptyStateText = document.getElementById("emptyStateText");
  const notesList = document.getElementById("notesList");

  const noteModal = document.getElementById("noteModal");
  const editForm = document.getElementById("editForm");
  const editTitle = document.getElementById("editTitle");
  const editText = document.getElementById("editText");
  const editSwatches = document.getElementById("editSwatches");
  const editPinBtn = document.getElementById("editPin");
  const modalTimestamp = document.getElementById("modalTimestamp");
  const cancelEditBtn = document.getElementById("cancelEdit");

  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");
  const toastAction = document.getElementById("toastAction");

  const sectionTitleEl = document.querySelector(".brand h1");
  const binTools = document.getElementById("binTools");
  const emptyBinBtn = document.getElementById("emptyBinBtn");

  // -----------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------

  /** @returns {Note[]} */
  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.warn("Scratch: could not read saved notes.", error);
      return [];
    }
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
    } catch (error) {
      console.warn("Scratch: could not save notes.", error);
    }
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  /** Escapes text so note content can never be interpreted as HTML. */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatTimestamp(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function findNote(id) {
    return state.notes.find((note) => note.id === id) || null;
  }

  function showToast(message, { actionLabel = "", onAction = null } = {}) {
    clearTimeout(toastTimer);
    toastMessage.textContent = message;

    if (actionLabel && onAction) {
      toastAction.hidden = false;
      toastAction.textContent = actionLabel;
      toastAction.onclick = () => {
        onAction();
        hideToast();
      };
    } else {
      toastAction.hidden = true;
      toastAction.onclick = null;
    }

    toast.classList.remove("hidden");
    toastTimer = setTimeout(hideToast, 5000);
  }

  function hideToast() {
    toast.classList.add("hidden");
    clearTimeout(toastTimer);
  }

  // -----------------------------------------------------------------
  // Swatch UI (shared builder for composer + edit modal)
  // -----------------------------------------------------------------

  function buildSwatchRow(container, selectedValue, onSelect) {
    container.innerHTML = SWATCHES.map(
      (swatch) => `
        <button
          type="button"
          class="swatch"
          data-color="${swatch.value}"
          style="background:${swatch.hex};"
          role="radio"
          aria-checked="${swatch.value === selectedValue}"
          aria-label="${swatch.label}"
          data-tooltip="${swatch.label}"
        ></button>
      `,
    ).join("");

    container.querySelectorAll(".swatch").forEach((btn) => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".swatch").forEach((el) => el.setAttribute("aria-checked", "false"));
        btn.setAttribute("aria-checked", "true");
        onSelect(btn.dataset.color);
      });
    });
  }

  // -----------------------------------------------------------------
  // Composer (inline "take a note" box)
  // -----------------------------------------------------------------

  function expandComposer() {
    composerForm.dataset.expanded = "true";
    buildSwatchRow(composerSwatches, state.composerColor, (color) => {
      state.composerColor = color;
    });
    composerTitle.focus();
  }

  function resetComposer() {
    composerForm.reset();
    composerForm.dataset.expanded = "false";
    state.composerColor = "default";
    state.composerPinned = false;
    composerPinBtn.setAttribute("aria-pressed", "false");
    composerText.style.height = "";
  }

  function handleComposerSubmit(event) {
    event.preventDefault();

    const title = composerTitle.value.trim();
    const text = composerText.value.trim();

    if (title || text) {
      const now = new Date().toISOString();
      state.notes.unshift({
        id: makeId(),
        title,
        text,
        color: state.composerColor,
        pinned: state.composerPinned,
        archived: false,
        deleted: false,
        createdAt: now,
        updatedAt: now,
      });
      saveNotes();
      render();
    }

    resetComposer();
  }

  // -----------------------------------------------------------------
  // Edit modal
  // -----------------------------------------------------------------

  function openEditModal(note) {
    state.editingId = note.id;
    editTitle.value = note.title;
    editText.value = note.text;
    modalTimestamp.textContent = note.updatedAt ? `Edited ${formatTimestamp(note.updatedAt)}` : "";

    buildSwatchRow(editSwatches, note.color || "default", (color) => {
      applyModalAccent(color);
      updateNoteField(note.id, { color });
    });

    editPinBtn.setAttribute("aria-pressed", String(!!note.pinned));
    applyModalAccent(note.color || "default");

    noteModal.classList.remove("hidden");
    editTitle.focus();
  }

  function applyModalAccent(colorValue) {
    const swatch = SWATCHES.find((item) => item.value === colorValue) || SWATCHES[0];
    document.querySelector(".modal-card").style.setProperty("--modal-accent", swatch.hex);
  }

  function closeEditModal() {
    noteModal.classList.add("hidden");
    editForm.reset();
    state.editingId = null;
  }

  function handleEditSubmit(event) {
    event.preventDefault();
    if (!state.editingId) return;

    updateNoteField(state.editingId, {
      title: editTitle.value.trim(),
      text: editText.value.trim(),
      updatedAt: new Date().toISOString(),
    });

    closeEditModal();
    render();
  }

  /** Merges a partial update into the note with the given id, then persists. */
  function updateNoteField(id, patch) {
    state.notes = state.notes.map((note) => (note.id === id ? { ...note, ...patch } : note));
    saveNotes();
  }

  // -----------------------------------------------------------------
  // Note actions (archive / delete / restore / pin)
  // -----------------------------------------------------------------

  function softDelete(id) {
    updateNoteField(id, { deleted: true, deletedAt: new Date().toISOString() });
    render();
    showToast("Note moved to Trash", {
      actionLabel: "Undo",
      onAction: () => {
        updateNoteField(id, { deleted: false });
        render();
      },
    });
  }

  function toggleArchive(id) {
    const note = findNote(id);
    if (!note) return;
    updateNoteField(id, { archived: !note.archived });
    render();
  }

  function togglePin(id) {
    const note = findNote(id);
    if (!note) return;
    updateNoteField(id, { pinned: !note.pinned });
    render();
  }

  function restoreFromBin(id) {
    updateNoteField(id, { deleted: false });
    render();
  }

  function deleteForever(id) {
    const note = findNote(id);
    if (!note) return;

    pendingDeletion = note;
    state.notes = state.notes.filter((item) => item.id !== id);
    saveNotes();
    render();

    showToast("Note deleted forever", {
      actionLabel: "Undo",
      onAction: () => {
        if (pendingDeletion) {
          state.notes.unshift(pendingDeletion);
          saveNotes();
          render();
          pendingDeletion = null;
        }
      },
    });
  }

  function emptyBin() {
    const binCount = state.notes.filter((note) => note.deleted).length;
    if (binCount === 0) return;

    const confirmed = window.confirm(`Permanently delete ${binCount} note(s) from Trash? This cannot be undone.`);
    if (!confirmed) return;

    state.notes = state.notes.filter((note) => !note.deleted);
    saveNotes();
    render();
  }

  // -----------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------

  function noteMatchesView(note) {
    if (state.currentView === "bin") return note.deleted;
    if (state.currentView === "archive") return note.archived && !note.deleted;
    return !note.archived && !note.deleted;
  }

  function noteMatchesSearch(note) {
    const term = state.searchTerm.trim().toLowerCase();
    if (!term) return true;
    return `${note.title} ${note.text}`.toLowerCase().includes(term);
  }

  function getVisibleNotes() {
    const filtered = state.notes.filter((note) => noteMatchesView(note) && noteMatchesSearch(note));

    if (state.currentView === "bin") return filtered;

    // Pinned notes first, both groups keep insertion order (newest first).
    const pinned = filtered.filter((n) => n.pinned);
    const rest = filtered.filter((n) => !n.pinned);
    return [...pinned, ...rest];
  }

  function noteActionsMarkup(note) {
    if (state.currentView === "bin") {
      return `
        <button class="icon-btn" data-action="restore" type="button" data-tooltip="Restore">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 10a8 8 0 1 1 2.34 5.66" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 4v6h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="icon-btn" data-action="delete-forever" type="button" data-tooltip="Delete forever">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      `;
    }

    const pinPressed = note.pinned ? "true" : "false";
    const archiveTooltip = note.archived ? "Unarchive" : "Archive";

    return `
      <button class="icon-btn" data-action="pin" type="button" data-tooltip="${note.pinned ? "Unpin" : "Pin"}" aria-pressed="${pinPressed}">
        <svg viewBox="0 0 24 24" fill="${note.pinned ? "currentColor" : "none"}"><path d="M13.5 3.5 20.5 10.5 17 14l-1 6-3-5-5 5 5-5-5-3 6-1 3.5-3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      </button>
      <button class="icon-btn" data-action="archive" type="button" data-tooltip="${archiveTooltip}">
        <svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="4.5" width="17" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" stroke="currentColor" stroke-width="1.6"/><path d="M10 13h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
      <button class="icon-btn" data-action="delete" type="button" data-tooltip="Delete">
        <svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    `;
  }

  function noteCardMarkup(note) {
    const swatch = SWATCHES.find((item) => item.value === note.color) || SWATCHES[0];
    const accent = ACCENT_BY_SWATCH[note.color] || ACCENT_BY_SWATCH.default;
    const title = escapeHtml(note.title || "");
    const text = escapeHtml(note.text || "");
    const pinnedClass = note.pinned && state.currentView !== "bin" ? " is-pinned" : "";

    return `
      <li class="note-card${pinnedClass}"
          data-id="${note.id}"
          style="--card-accent:${accent}; background:${swatch.hex};"
          tabindex="0"
          role="button"
          aria-label="Open note ${title || "(untitled)"}">
        ${note.pinned && state.currentView !== "bin"
          ? `<span class="note-pin-flag"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 3.5 20.5 10.5 17 14l-1 6-3-5-5 5 5-5-5-3 6-1 3.5-3.5Z"/></svg></span>`
          : ""}
        <div class="note-body">
          ${title ? `<h3 class="note-title">${title}</h3>` : ""}
          ${text ? `<p class="note-text">${text}</p>` : ""}
        </div>
        <p class="note-meta">${formatTimestamp(note.updatedAt || note.createdAt)}</p>
        <div class="note-actions">${noteActionsMarkup(note)}</div>
      </li>
    `;
  }

  const VIEW_LABELS = { notes: "Scratch", archive: "Archive", bin: "Trash" };
  const EMPTY_MESSAGES = {
    notes: { plain: "Nothing here yet — start with a note above.", search: "No notes match your search." },
    archive: { plain: "Archived notes will show up here.", search: "No archived notes match your search." },
    bin: { plain: "Trash is empty.", search: "No notes in Trash match your search." },
  };

  function render() {
    const visibleNotes = getVisibleNotes();
    const term = state.searchTerm.trim();

    sectionTitleEl.textContent = VIEW_LABELS[state.currentView];
    document.querySelector(".composer-section").style.display = state.currentView === "notes" ? "" : "none";
    binTools.classList.toggle("hidden", state.currentView !== "bin");

    if (visibleNotes.length === 0) {
      emptyState.classList.remove("hidden");
      notesList.innerHTML = "";
      const messages = EMPTY_MESSAGES[state.currentView];
      emptyStateText.textContent = term ? messages.search : messages.plain;
    } else {
      emptyState.classList.add("hidden");
      notesList.innerHTML = visibleNotes.map(noteCardMarkup).join("");
    }

    notesList.classList.toggle("list-view", state.isListView);
  }

  // -----------------------------------------------------------------
  // Event wiring
  // -----------------------------------------------------------------

  // Composer
  composerText.addEventListener("focus", expandComposer);
  composerTitle.addEventListener("focus", expandComposer);
  composerText.addEventListener("input", () => {
    composerText.style.height = "auto";
    composerText.style.height = `${composerText.scrollHeight}px`;
  });
  composerForm.addEventListener("submit", handleComposerSubmit);
  composerCancelBtn.addEventListener("click", resetComposer);
  composerPinBtn.addEventListener("click", () => {
    state.composerPinned = !state.composerPinned;
    composerPinBtn.setAttribute("aria-pressed", String(state.composerPinned));
  });

  document.addEventListener("click", (event) => {
    if (
      composerForm.dataset.expanded === "true" &&
      !composerForm.contains(event.target)
    ) {
      handleComposerSubmit(new Event("submit", { cancelable: true }));
    }
  });
  composerForm.addEventListener("click", (event) => event.stopPropagation());

  // Notes grid: open-for-edit, or route to an action button
  notesList.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("button[data-action]");
    const card = event.target.closest(".note-card");
    if (!card) return;

    const id = card.dataset.id;

    if (actionBtn) {
      event.stopPropagation();
      const action = actionBtn.dataset.action;
      if (action === "pin") togglePin(id);
      if (action === "archive") toggleArchive(id);
      if (action === "delete") softDelete(id);
      if (action === "restore") restoreFromBin(id);
      if (action === "delete-forever") deleteForever(id);
      return;
    }

    if (state.currentView === "bin") return;
    const note = findNote(id);
    if (note) openEditModal(note);
  });

  notesList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".note-card");
    if (!card || event.target.closest("button")) return;
    event.preventDefault();
    if (state.currentView === "bin") return;
    const note = findNote(card.dataset.id);
    if (note) openEditModal(note);
  });

  // Edit modal
  editForm.addEventListener("submit", handleEditSubmit);
  cancelEditBtn.addEventListener("click", closeEditModal);
  editPinBtn.addEventListener("click", () => {
    if (!state.editingId) return;
    const note = findNote(state.editingId);
    const nextState = !note.pinned;
    updateNoteField(state.editingId, { pinned: nextState });
    editPinBtn.setAttribute("aria-pressed", String(nextState));
  });
  noteModal.addEventListener("click", (event) => {
    if (event.target === noteModal) closeEditModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!noteModal.classList.contains("hidden")) closeEditModal();
      else if (composerForm.dataset.expanded === "true") resetComposer();
    }
  });

  // Search
  searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value;
    render();
  });

  // Grid / list toggle
  viewToggle.addEventListener("click", () => {
    state.isListView = !state.isListView;
    viewToggle.setAttribute("aria-pressed", String(state.isListView));
    viewToggle.dataset.tooltip = state.isListView ? "Switch to grid view" : "Switch to list view";
    render();
  });

  // Sidebar navigation
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navItems.forEach((item) => item.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.currentView = btn.dataset.view;
      render();
    });
  });

  emptyBinBtn.addEventListener("click", emptyBin);

  // Sidebar collapse (mobile-friendly)
  menuToggle.addEventListener("click", () => {
    const collapsed = sidebar.classList.toggle("is-collapsed");
    menuToggle.setAttribute("aria-expanded", String(!collapsed));
  });

  // -----------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------

  render();
})();