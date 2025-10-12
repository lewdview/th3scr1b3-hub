// Utilities module for th3scr1b3-hero
// Handles: search, favorites, sorting, notifications, keyboard shortcuts

// ============================================================================
// SEARCH & FILTER
// ============================================================================

export function createSearchFilter() {
  const state = {
    query: '',
    filterType: 'all', // all, track, album, playlist
    debounceTimer: null
  };

  function search(items, query, filterType = 'all') {
    if (!query && filterType === 'all') return items;
    
    const q = query.toLowerCase().trim();
    return items.filter(item => {
      // Type filter
      if (filterType !== 'all' && item.type !== filterType) return false;
      
      // Search filter
      if (!q) return true;
      const title = (item.title || '').toLowerCase();
      const meta = (item.meta || '').toLowerCase();
      return title.includes(q) || meta.includes(q);
    });
  }

  function debounce(fn, delay = 300) {
    return (...args) => {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => fn(...args), delay);
    };
  }

  return {
    search,
    debounce,
    getState: () => ({ ...state }),
    setQuery: (q) => { state.query = q; },
    setFilter: (f) => { state.filterType = f; }
  };
}

// ============================================================================
// FAVORITES
// ============================================================================

export function createFavoritesManager(storageKey = 'th3scr1b3_favorites') {
  let favorites = new Set();

  function load() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const arr = JSON.parse(stored);
        favorites = new Set(arr);
      }
    } catch (e) {
      console.warn('Failed to load favorites', e);
    }
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...favorites]));
    } catch (e) {
      console.warn('Failed to save favorites', e);
    }
  }

  function toggle(id) {
    if (!id) return false;
    const key = String(id);
    if (favorites.has(key)) {
      favorites.delete(key);
      save();
      return false;
    } else {
      favorites.add(key);
      save();
      return true;
    }
  }

  function has(id) {
    return favorites.has(String(id));
  }

  function getAll() {
    return [...favorites];
  }

  function clear() {
    favorites.clear();
    save();
  }

  load();

  return { toggle, has, getAll, clear, size: () => favorites.size };
}

// ============================================================================
// SORTING
// ============================================================================

export function createSorter() {
  const modes = {
    'newest': (items) => [...items].sort((a, b) => {
      const aDate = a.created_at || a.release_date || a.date || 0;
      const bDate = b.created_at || b.release_date || b.date || 0;
      return bDate - aDate; // newest first
    }),
    'oldest': (items) => [...items].sort((a, b) => {
      const aDate = a.created_at || a.release_date || a.date || 0;
      const bDate = b.created_at || b.release_date || b.date || 0;
      return aDate - bDate; // oldest first
    }),
    'plays': (items) => [...items].sort((a, b) => {
      const aPlays = a.play_count || a.playCount || 0;
      const bPlays = b.play_count || b.playCount || 0;
      return bPlays - aPlays; // most plays first
    }),
    'title': (items) => [...items].sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      return aTitle.localeCompare(bTitle);
    }),
    'shuffle': (items) => {
      const arr = [...items];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  };

  let currentMode = 'newest';

  function sort(items, mode = currentMode) {
    if (!modes[mode]) mode = 'newest';
    currentMode = mode;
    return modes[mode](items);
  }

  function getMode() {
    return currentMode;
  }

  function setMode(mode) {
    if (modes[mode]) currentMode = mode;
  }

  function getModes() {
    return Object.keys(modes);
  }

  return { sort, getMode, setMode, getModes };
}

// ============================================================================
// NOTIFICATIONS / TOASTS
// ============================================================================

export function createNotificationSystem(containerId = 'notifications-container') {
  let container = document.getElementById(containerId);

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.setAttribute('role', 'region');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-label', 'Notifications');
      container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
        max-width: min(92vw, 400px);
      `;
      document.body.appendChild(container);
    }
  }

  function show(message, type = 'info', duration = 4000) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = `notification notification--${type}`;
    toast.setAttribute('role', 'status');
    toast.style.cssText = `
      background: var(--glass);
      backdrop-filter: blur(12px) saturate(140%);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 14px 18px;
      box-shadow: var(--shadow-lg);
      color: var(--text);
      font-weight: 600;
      font-size: 0.95rem;
      pointer-events: auto;
      opacity: 0;
      transform: translateX(100px);
      transition: opacity 260ms var(--transition-smooth), transform 260ms var(--transition-spring);
      cursor: pointer;
    `;

    // Type-specific styling
    if (type === 'success') {
      toast.style.borderColor = 'rgba(41, 255, 182, 0.35)';
      toast.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35), 0 0 18px rgba(41, 255, 182, 0.2)';
    } else if (type === 'error') {
      toast.style.borderColor = 'rgba(255, 0, 110, 0.35)';
      toast.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35), 0 0 18px rgba(255, 0, 110, 0.2)';
    } else if (type === 'warning') {
      toast.style.borderColor = 'rgba(255, 230, 0, 0.35)';
      toast.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35), 0 0 18px rgba(255, 230, 0, 0.2)';
    }

    toast.textContent = message;

    // Click to dismiss
    toast.addEventListener('click', () => dismiss(toast));

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    // Auto dismiss
    if (duration > 0) {
      setTimeout(() => dismiss(toast), duration);
    }

    return toast;
  }

  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  function success(message, duration) {
    return show(message, 'success', duration);
  }

  function error(message, duration) {
    return show(message, 'error', duration);
  }

  function warning(message, duration) {
    return show(message, 'warning', duration);
  }

  function info(message, duration) {
    return show(message, 'info', duration);
  }

  return { show, success, error, warning, info, dismiss };
}

// ============================================================================
// KEYBOARD SHORTCUTS MODAL
// ============================================================================

export function createKeyboardShortcutsModal() {
  const shortcuts = [
    { category: 'Player', keys: ['Space'], description: 'Play/Pause' },
    { category: 'Player', keys: ['S'], description: 'Stop playback' },
    { category: 'Player', keys: ['←', '→'], description: 'Seek backward/forward' },
    { category: 'Player', keys: ['↑', '↓'], description: 'Volume up/down' },
    { category: 'Player', keys: ['M'], description: 'Toggle mute' },
    { category: 'Player', keys: ['L'], description: 'Toggle loop' },
    { category: 'Visualizer', keys: ['V'], description: 'Cycle visualizer mode' },
    { category: 'Visualizer', keys: ['1', '2', '3', '4', '5', '6'], description: 'Select visualizer mode' },
    { category: 'Navigation', keys: ['G', '1-4'], description: 'Go to page (chord)' },
    { category: 'Navigation', keys: ['Esc'], description: 'Close page/modal' },
    { category: 'Navigation', keys: ['?'], description: 'Show keyboard shortcuts' },
    { category: 'Carousel', keys: ['Tab'], description: 'Navigate tracks' },
    { category: 'Carousel', keys: ['Enter'], description: 'Play selected track' },
    { category: 'Search', keys: ['/', 'Ctrl+F'], description: 'Focus search' },
    { category: 'General', keys: ['F'], description: 'Toggle favorite' },
  ];

  let modal = null;

  function create() {
    const overlay = document.createElement('div');
    overlay.id = 'keyboard-shortcuts-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-labelledby', 'shortcuts-title');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 240ms var(--transition-smooth);
    `;

    const panel = document.createElement('div');
    panel.style.cssText = `
      background: var(--glass);
      backdrop-filter: blur(16px) saturate(150%);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      box-shadow: var(--shadow-lg);
      padding: 32px;
      max-width: 640px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      color: var(--text);
    `;

    const title = document.createElement('h2');
    title.id = 'shortcuts-title';
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = `
      margin: 0 0 24px 0;
      font-size: 1.8rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    `;

    const content = document.createElement('div');
    const grouped = shortcuts.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([category, items]) => {
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom: 24px;';

      const catTitle = document.createElement('h3');
      catTitle.textContent = category;
      catTitle.style.cssText = `
        margin: 0 0 12px 0;
        font-size: 1rem;
        font-weight: 800;
        opacity: 0.85;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      `;

      const list = document.createElement('div');
      list.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

      items.forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
        `;

        const desc = document.createElement('span');
        desc.textContent = item.description;
        desc.style.cssText = 'flex: 1; opacity: 0.9;';

        const keys = document.createElement('div');
        keys.style.cssText = 'display: flex; gap: 6px;';
        item.keys.forEach(k => {
          const kbd = document.createElement('kbd');
          kbd.textContent = k;
          kbd.style.cssText = `
            padding: 4px 8px;
            border-radius: 4px;
            background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06));
            border: 1px solid rgba(255,255,255,0.15);
            font-size: 0.85rem;
            font-weight: 700;
            font-family: ui-monospace, monospace;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          `;
          keys.appendChild(kbd);
        });

        row.appendChild(desc);
        row.appendChild(keys);
        list.appendChild(row);
      });

      section.appendChild(catTitle);
      section.appendChild(list);
      content.appendChild(section);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close shortcuts');
    closeBtn.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(0,0,0,0.5);
      color: var(--text);
      font-size: 24px;
      line-height: 1;
      font-weight: 900;
      cursor: pointer;
      transition: all 180ms var(--transition-smooth);
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.background = 'rgba(255,255,255,0.1)';
      closeBtn.style.transform = 'scale(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.background = 'rgba(0,0,0,0.5)';
      closeBtn.style.transform = 'scale(1)';
    });

    closeBtn.addEventListener('click', close);
    panel.style.position = 'relative';
    panel.appendChild(closeBtn);
    panel.appendChild(title);
    panel.appendChild(content);
    overlay.appendChild(panel);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Escape to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
    });

    modal = overlay;
    return overlay;
  }

  function close() {
    if (!modal) return;
    modal.style.opacity = '0';
    setTimeout(() => {
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      modal = null;
    }, 260);
  }

  function toggle() {
    if (modal) {
      close();
    } else {
      create();
    }
  }

  return { open: create, close, toggle };
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

export function createSkeletonLoader() {
  function createSkeleton(count = 8) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'tile tile--skeleton';
      skeleton.style.cssText = `
        position: relative;
        width: 120px;
        height: 120px;
        flex: 0 0 auto;
        border-radius: 12px;
        background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
        background-size: 200% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
        overflow: hidden;
      `;
      frag.appendChild(skeleton);
    }
    return frag;
  }

  // Add shimmer keyframes if not present
  const styleId = 'skeleton-shimmer-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return { createSkeleton };
}

// ============================================================================
// QUEUE SYSTEM
// ============================================================================

export function createQueueManager() {
  let queue = [];
  let currentIndex = -1;

  function add(item) {
    queue.push(item);
  }

  function remove(index) {
    if (index >= 0 && index < queue.length) {
      queue.splice(index, 1);
      if (currentIndex >= index) currentIndex--;
    }
  }

  function clear() {
    queue = [];
    currentIndex = -1;
  }

  function next() {
    if (currentIndex < queue.length - 1) {
      currentIndex++;
      return queue[currentIndex];
    }
    return null;
  }

  function previous() {
    if (currentIndex > 0) {
      currentIndex--;
      return queue[currentIndex];
    }
    return null;
  }

  function current() {
    return queue[currentIndex] || null;
  }

  function getQueue() {
    return [...queue];
  }

  function shuffle() {
    const current = queue[currentIndex];
    // Shuffle everything except current
    const before = queue.slice(0, currentIndex);
    const after = queue.slice(currentIndex + 1);
    const shuffled = [...before, ...after];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    queue = current ? [current, ...shuffled] : shuffled;
    currentIndex = current ? 0 : -1;
  }

  function setQueue(items, startIndex = 0) {
    queue = [...items];
    currentIndex = Math.max(0, Math.min(startIndex, queue.length - 1));
  }

  return { add, remove, clear, next, previous, current, getQueue, shuffle, setQueue };
}
