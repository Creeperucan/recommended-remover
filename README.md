# Features
- You can enable or disable the recommended videos by clicking the button in the bottom-right corner.
- Your preference will be saved, and recommended videos will remain enabled or disabled on other videos.
- For now, additional language support is available only for Turkish.

### Before
<img width="1855" height="996" alt="Screenshot_3" src="https://github.com/user-attachments/assets/ab571707-b2e3-413f-bb83-452e162c0517" /> 

### After
<img width="1859" height="998" alt="Screenshot_4" src="https://github.com/user-attachments/assets/00a5d871-5ff9-4441-819f-e8fa796f1d64" />

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
