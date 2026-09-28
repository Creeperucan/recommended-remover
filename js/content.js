(() => {
  const STORAGE_KEY = 'rr_hidden_globally';
  const BUTTON_TEXT_KEY = 'rr_show_button_text';
  
  let observer = null;
  let cachedHidden = false;
  let showButtonText = true;
  let debounceTimer = null;

  function isContextValid() {
    try { 
      return !!chrome.runtime.id; 
    } catch { 
      return false; 
    }
  }

  function selfDestruct() {
    if (observer) { 
      observer.disconnect(); observer = null; 
    }

    const btn = document.getElementById('rr-btn');
    if (btn) btn.remove();
  }

  function i18n(key) {
    try { 
      return chrome.i18n.getMessage(key) || key; 
    } catch { 
      return key; 
    }
  }

  function loadHidden(cb) {
    if (!isContextValid()) { 
      selfDestruct(); 
      return; 
    }

    try {
      chrome.storage.local.get([STORAGE_KEY, BUTTON_TEXT_KEY], (r) => {
        if (chrome.runtime.lastError) return;

        cachedHidden = !!r[STORAGE_KEY];
        showButtonText = r[BUTTON_TEXT_KEY] !== false;
        cb(cachedHidden);
      });

    } catch { 
      selfDestruct(); 
    }
  }

  function setHidden(val) {
    if (!isContextValid()) { 
      selfDestruct(); 
      return; 
    }

    cachedHidden = val;
    try { 
      chrome.storage.local.set({ [STORAGE_KEY]: val }); 
    } catch { 
      selfDestruct(); 
    }
  }

  function getTargets() {
    const el1 = document.querySelector('div.style-scope.ytd-watch-flexy#secondary');
    const el2 = document.querySelector('div.style-scope.ytd-watch-flexy#fixed-side-menu');

    return [el1, el2].filter(el => el !== null);
  }

  function applyVisibility(hidden) {
    const elements = getTargets();
    if (elements.length === 0) return;

    const newDisplay = hidden ? 'none' : '';
    let stateChanged = false;

    elements.forEach(el => {
     if (el.style.display !== newDisplay) {
       el.style.display = newDisplay;
       stateChanged = true;
     }
    });

    if (stateChanged) {
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }

  function refreshBadges() {
    if (window.RecommendedRemoverBadges) {
      window.RecommendedRemoverBadges.refresh();
    }
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function updateBtn(hidden) {
    const btn = document.getElementById('rr-btn');
    if (!btn) return;

    btn.classList.toggle('rr-on', !hidden);
    const label = hidden ? i18n('btnShow') : i18n('btnHide');

    const text = btn.querySelector('span');
    text.textContent = showButtonText ? label : '';
    text.hidden = !showButtonText;

    btn.setAttribute('aria-label', label);
    btn.title = label;

    btn.querySelector('svg').outerHTML = hidden
      ? '<svg class="rr-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" aria-hidden="true"><path fill="currentColor" d="M572.52 241.4C518.29 135.59 407.76 64 288 64S57.71 135.59 3.48 241.4a32.35 32.35 0 0 0 0 29.2C57.71 376.41 168.24 448 288 448s230.29-71.59 284.52-177.4a32.35 32.35 0 0 0 0-29.2zM288 400a144 144 0 1 1 144-144 144.16 144.16 0 0 1-144 144zm0-240a95.31 95.31 0 0 0-25.31 3.79 47.85 47.85 0 0 1-66.49 66.49A95.78 95.78 0 1 0 288 160z"/></svg>'
      : '<svg class="rr-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" aria-hidden="true"><path fill="currentColor" d="M320 400c-75.1 0-136-60.9-136-136 0-15.2 2.5-29.8 7.1-43.4L78.7 101.2C33.5 134.4 0 181.4 0 256c0 44.3 17.3 86.8 47.9 118.7C110.3 438.6 210.8 480 320 480c54.8 0 106.8-12.1 151.9-33.7l-83.4-83.4C365.6 385.9 343.6 400 320 400zM633.8 458.1 45.7 5.1C37.2-1.5 24.9.2 18.3 8.7L3.9 27.3C-2.7 35.8-1 48.1 7.5 54.7l588.1 453c8.5 6.6 20.8 4.9 27.4-3.6l14.4-18.6c6.6-8.5 4.9-20.8-3.6-27.4zM640 256c0-44.3-17.3-86.8-47.9-118.7C529.7 73.4 429.2 32 320 32c-54.8 0-106.8 12.1-151.9 33.7l83.4 83.4C274.4 126.1 296.4 112 320 112c75.1 0 136 60.9 136 136 0 15.2-2.5 29.8-7.1 43.4l113.4 113.4C607.5 371.8 640 317 640 256z"/></svg>';
    btn.style.display = isFullscreen() ? 'none' : '';
  }

  function injectButton() {
    if (document.getElementById('rr-btn')) return;
    if (!location.pathname.startsWith('/watch')) return;

    const btn = document.createElement('button');
    btn.id = 'rr-btn';
    btn.innerHTML = `<svg class="rr-icon" aria-hidden="true"></svg><span>${i18n('btnHide')}</span>`;

    btn.addEventListener('click', () => {
      const next = !cachedHidden;
      setHidden(next);
      applyVisibility(next);
      updateBtn(next);
    });

    document.body.appendChild(btn);
    applyVisibility(cachedHidden);
    updateBtn(cachedHidden);
  }

  function cleanup() {
    const btn = document.getElementById('rr-btn');
    if (btn) btn.remove();
  }

  function run() {
    if (!isContextValid()) { 
      selfDestruct(); 
      return; 
    }

    if (!location.pathname.startsWith('/watch')) { 
      cleanup(); 
      return; 
    }

    loadHidden((hidden) => {
      injectButton();
      applyVisibility(hidden);
      updateBtn(hidden);
    });
  }

  let lastUrl = location.href;
  observer = new MutationObserver(() => {
    if (!isContextValid()) { 
      selfDestruct(); 
      return; 
    }

    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(run, 900);
      refreshBadges();
      return;
    }

    if (!document.getElementById('rr-btn') && location.pathname.startsWith('/watch')) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        injectButton();
        applyVisibility(cachedHidden);
        updateBtn(cachedHidden);
      }, 200);
    }
    
    applyVisibility(cachedHidden);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  function onFullscreenChange() {
    const btn = document.getElementById('rr-btn');
    if (!btn) return;

    const entering = !!(document.fullscreenElement || document.webkitFullscreenElement);
    btn.style.display = entering ? 'none' : '';
  }
  
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[STORAGE_KEY]) {
      cachedHidden = changes[STORAGE_KEY].newValue === true;
      applyVisibility(cachedHidden);
    }
    if (changes[BUTTON_TEXT_KEY]) {
      showButtonText = changes[BUTTON_TEXT_KEY].newValue !== false;
    }
    if (changes[STORAGE_KEY] || changes[BUTTON_TEXT_KEY]) updateBtn(cachedHidden);
  });

  setTimeout(run, 1200);
  setTimeout(refreshBadges, 1200);
})();
