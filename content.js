(() => {
  const STORAGE_KEY = 'rr_hidden_globally';
  let observer = null;

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

  function isHidden(cb) {
    if (!isContextValid()) { selfDestruct(); return; }
    try {
      chrome.storage.local.get([STORAGE_KEY], (r) => {
        if (chrome.runtime.lastError) return;
        cb(!!r[STORAGE_KEY]);
      });
    } catch { selfDestruct(); }
  }

  function setHidden(val) {
    if (!isContextValid()) { selfDestruct(); return; }
    try { chrome.storage.local.set({ [STORAGE_KEY]: val }); } catch { selfDestruct(); }
  }

  function getTarget() {
    return document.querySelector('div.style-scope.ytd-watch-flexy#secondary');
  }

  function applyVisibility(hidden) {
    const el = getTarget();
    if (el) el.style.display = hidden ? 'none' : '';
  }

  function updateBtn(hidden) {
    const btn = document.getElementById('rr-btn');
    if (!btn) return;
    btn.classList.toggle('rr-on', !hidden);
    btn.querySelector('span').textContent = hidden ? i18n('btnShow') : i18n('btnHide');
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
      isHidden((hidden) => {
        const next = !hidden;
        setHidden(next);
        applyVisibility(next);
        updateBtn(next);
      });
    });

    document.body.appendChild(btn);
    isHidden((hidden) => { applyVisibility(hidden); updateBtn(hidden); });
  }

  function cleanup() {
    const btn = document.getElementById('rr-btn');
    if (btn) btn.remove();
  }

  function run() {
    if (!isContextValid()) { selfDestruct(); return; }
    if (!location.pathname.startsWith('/watch')) { cleanup(); return; }
    injectButton();
    isHidden((hidden) => { applyVisibility(hidden); updateBtn(hidden); });
  }

  let lastUrl = location.href;

  observer = new MutationObserver(() => {
    if (!isContextValid()) { selfDestruct(); return; }
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(run, 900);
      return;
    }
    if (!document.getElementById('rr-btn') && location.pathname.startsWith('/watch')) {
      injectButton();
    }
    isHidden((hidden) => applyVisibility(hidden));
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(run, 1200);
})();
