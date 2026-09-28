(() => {
  const BADGES_ENABLED_KEY = 'rr_badges_enabled';
  const BUTTON_TEXT_KEY = 'rr_show_button_text';
  const THEME_KEY = 'rr_theme';
  const badgesInput = document.getElementById('badges-enabled');
  const buttonTextInput = document.getElementById('button-text-enabled');
  const themeOptions = [...document.querySelectorAll('[data-theme-option]')];

  function message(key, fallback) {
    return chrome.i18n.getMessage(key) || fallback;
  }

  function localize() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      element.textContent = message(element.dataset.i18n, element.textContent);
    });

    badgesInput.closest('.switch').setAttribute('aria-label', message('settingsBadges', 'Channel badges'));
    buttonTextInput.closest('.switch').setAttribute('aria-label', message('settingsButtonText', 'Recommendation button text'));
    document.querySelector('.theme-options').setAttribute('aria-label', message('settingsTheme', 'Color theme'));
    document.title = message('settingsTitle', 'Settings');
  }

  function applyTheme(theme) {
    const selectedTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = selectedTheme;

    themeOptions.forEach(option => {
      option.setAttribute('aria-pressed', String(option.dataset.themeOption === selectedTheme));
    });
  }

  localize();

  chrome.storage.local.get({
    [BADGES_ENABLED_KEY]: false,
    [BUTTON_TEXT_KEY]: true,
    [THEME_KEY]: 'light'
  }, preferences => {
    badgesInput.checked = preferences[BADGES_ENABLED_KEY] !== false;
    buttonTextInput.checked = preferences[BUTTON_TEXT_KEY] !== false;
    applyTheme(preferences[THEME_KEY]);
  });

  badgesInput.addEventListener('change', () => {
    chrome.storage.local.set({ [BADGES_ENABLED_KEY]: badgesInput.checked });
  });

  buttonTextInput.addEventListener('change', () => {
    chrome.storage.local.set({ [BUTTON_TEXT_KEY]: buttonTextInput.checked });
  });

  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.themeOption;
      applyTheme(theme);
      chrome.storage.local.set({ [THEME_KEY]: theme });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[BADGES_ENABLED_KEY]) {
      badgesInput.checked = changes[BADGES_ENABLED_KEY].newValue !== false;
    }

    if (changes[BUTTON_TEXT_KEY]) {
      buttonTextInput.checked = changes[BUTTON_TEXT_KEY].newValue !== false;
    }
    
    if (changes[THEME_KEY]) {
      applyTheme(changes[THEME_KEY].newValue);
    }
  });
})();