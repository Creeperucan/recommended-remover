(() => {
	const RELEASE_URL = 'https://api.github.com/repos/Creeperucan/recommended-remover/releases/latest';
	const status = document.getElementById('update-status');
	const message = document.getElementById('update-message');

	function localized(key, fallback, substitutions) {
		return chrome.i18n.getMessage(key, substitutions) || fallback;
	}

	function parseVersion(value) {
		const match = String(value).trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
		return match ? match.slice(1).map(part => Number(part || 0)) : null;
	}

	function isNewerVersion(latest, current) {
		const latestParts = parseVersion(latest);
		const currentParts = parseVersion(current);
        
		if (!latestParts || !currentParts) return null;

		for (let index = 0; index < 3; index += 1) {
			if (latestParts[index] !== currentParts[index]) return latestParts[index] > currentParts[index];
		}

		return false;
	}

	function showStatus(state, text) {
		status.dataset.state = state;
		message.textContent = text;
	}

	async function checkForUpdates() {
		try {
			const response = await fetch(RELEASE_URL, {
				headers: { Accept: 'application/vnd.github+json' },
				cache: 'no-store'
			});

			if (!response.ok) throw new Error(`GitHub returned ${response.status}`);

			const release = await response.json();
			const latestVersion = release.tag_name;
			const comparison = isNewerVersion(latestVersion, chrome.runtime.getManifest().version);

			if (comparison === null) throw new Error('Unrecognized release version');

			if (comparison) {
				showStatus('available', localized('updateAvailable', `Update available (${latestVersion}).`, [latestVersion]));
				const link = document.createElement('a');

				link.href = release.html_url || 'https://github.com/Creeperucan/recommended-remover/releases';
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.textContent = localized('updateViewRelease', 'View release');

				status.appendChild(link);

			} else {
				showStatus('current', localized('updateCurrent', `Extension is up to date (${chrome.runtime.getManifest().version}).`, [chrome.runtime.getManifest().version]));
			}

		} catch {
			showStatus('error', localized('updateCheckFailed', 'Could not check for updates.'));
		}
	}

	showStatus('checking', localized('updateChecking', 'Checking for updates...'));
	checkForUpdates();
})();
