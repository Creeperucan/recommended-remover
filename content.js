(() => {
  const STORAGE_KEY = 'rr_hidden_globally';
  let observer = null;
  let cachedHidden = false;
  let debounceTimer = null;

  function isContextValid() {
    try { return !!chrome.runtime.id; } catch { return false; }
  }

  function selfDestruct() {
    if (observer) { observer.disconnect(); observer = null; }
    const btn = document.getElementById('rr-btn');
    if (btn) btn.remove();
  }

  function i18n(key) {
    try { return chrome.i18n.getMessage(key) || key; } catch { return key; }
  }

  function loadHidden(cb) {
    if (!isContextValid()) { selfDestruct(); return; }
    try {
      chrome.storage.local.get([STORAGE_KEY], (r) => {
        if (chrome.runtime.lastError) return;
        cachedHidden = !!r[STORAGE_KEY];
        cb(cachedHidden);
      });
    } catch { selfDestruct(); }
  }

  function setHidden(val) {
    if (!isContextValid()) { selfDestruct(); return; }
    cachedHidden = val;
    try { chrome.storage.local.set({ [STORAGE_KEY]: val }); } catch { selfDestruct(); }
  }

  function getTarget() {
    return document.querySelector('div.style-scope.ytd-watch-flexy#secondary');
  }

  function applyVisibility(hidden) {
    const el = getTarget();
    if (!el) return;
    const newDisplay = hidden ? 'none' : '';
    if (el.style.display === newDisplay) return;
    el.style.display = newDisplay;
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function updateBtn(hidden) {
    const btn = document.getElementById('rr-btn');
    if (!btn) return;
    btn.classList.toggle('rr-on', !hidden);
    btn.querySelector('span').textContent = hidden ? i18n('btnShow') : i18n('btnHide');
    btn.style.display = isFullscreen() ? 'none' : '';
  }

  function injectButton() {
    if (document.getElementById('rr-btn')) return;
    if (!location.pathname.startsWith('/watch')) return;

    const btn = document.createElement('button');
    btn.id = 'rr-btn';
    btn.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      </svg>
      <span>${i18n('btnHide')}</span>
    `;

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
    if (!isContextValid()) { selfDestruct(); return; }
    if (!location.pathname.startsWith('/watch')) { cleanup(); return; }
    loadHidden((hidden) => {
      injectButton();
      applyVisibility(hidden);
      updateBtn(hidden);
    });
  }

  let lastUrl = location.href;

  observer = new MutationObserver(() => {
    if (!isContextValid()) { selfDestruct(); return; }

    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(run, 900);
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

  setTimeout(run, 1200);
})();
