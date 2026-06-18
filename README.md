# Features
- You can enable or disable the recommended videos by clicking the button in the bottom-right corner.
- Your preference will be saved, and recommended videos will remain enabled or disabled on other videos.
- For now, additional language support is available only for Turkish.

# Installation
1. Download the ZIP and extract it.
2. Open Chrome and navigate to:
   
```
   chrome://extensions
```
3. Enable Developer mode using the toggle in the top-right corner.
4. Click "Load unpacked" and select the `recommended-remover` folder.
5. Done!

# Adding a New Language
1. Create a new folder under `_locales/` using the language code (e.g. `de` for German):

```
   _locales/de/messages.json
```
2. Copy the contents of `_locales/en/messages.json` and translate the `"message"` values.
3. Reload the extension from `chrome://extensions`.
