(() => {
	const BADGE_RENDERER_CLASS = 'rr-badge-renderer';
	const BADGE_ITEM_CLASS = 'rr-badge-item';
	const METADATA_BADGE_CLASS = 'rr-metadata-badge';
	const BADGES_ENABLED_KEY = 'rr_badges_enabled';
	const CHANNEL_ID_PATTERN = /^UC[\w-]{20,}$/;

	let channelBadges = null;
	let loadPromise = null;
	let videoDataSource = null;
	let videoDataIndex = null;
	let badgesEnabled = false;
	let badgePreferenceLoaded = false;

	function normalize(value) {
		return typeof value === 'string'
			? value.trim().normalize('NFKC').replace(/^@/, '').toLowerCase()
			: '';
	}

	function i18n(key, fallback) {
		try {
			return chrome.i18n.getMessage(key) || fallback;
		} catch {
			return fallback;
		}
	}

	function readBadgeConfig(value) {
		const result = new Map();

		if (Array.isArray(value)) {
			value.forEach(channel => result.set(normalize(channel), {}));

		} else if (value && typeof value === 'object') {
			Object.entries(value).forEach(([channel, info]) => {
				if (info && Array.isArray(info.channels)) {
					info.channels.forEach(groupChannel => {
						result.set(normalize(groupChannel), { why: info.why });
					});

					return;
				}

				result.set(normalize(channel), info && typeof info === 'object' ? info : {});
			});
		}
		return result;
	}

	function loadChannels() {
		if (loadPromise) return loadPromise;

		loadPromise = fetch(chrome.runtime.getURL('channels.json'))
			.then(response => response.ok ? response.json() : {})
			.then(channels => {
				channelBadges = {
					AI: readBadgeConfig(channels.AIBadge),
					PE: readBadgeConfig(channels.PEBadge)
				};
				return channelBadges;
			})

			.catch(() => {
				channelBadges = { AI: new Set(), PE: new Set() };
				return channelBadges;
			});

		return loadPromise;
	}

	function findChannelId(value, depth = 0, visited = new Set()) {
		if (!value || depth > 8) return null;
		if (typeof value === 'string') return CHANNEL_ID_PATTERN.test(value) ? value : null;
		if (typeof value !== 'object' || visited.has(value)) return null;

		visited.add(value);
		if (Array.isArray(value)) {
			for (const item of value) {
				const channelId = findChannelId(item, depth + 1, visited);
				if (channelId) return channelId;
			}

			return null;
		}

		for (const key of ['channelId', 'externalChannelId', 'browseId']) {
			if (CHANNEL_ID_PATTERN.test(value[key] || '')) return value[key];
		}

		for (const key of Object.keys(value)) {
			const channelId = findChannelId(value[key], depth + 1, visited);
			if (channelId) return channelId;
		}

		return null;
	}

	function findVideoData(videoId) {
		const source = window.ytInitialData;
		if (!source) return null;

		if (source !== videoDataSource) {
			const index = new Map();
			const pending = [[source, 0]];
			const visited = new Set();

			while (pending.length) {
				const [value, depth] = pending.pop();
				if (!value || typeof value !== 'object' || depth > 20 || visited.has(value)) continue;

				visited.add(value);
			
				if (typeof value.videoId === 'string' && !index.has(value.videoId)) index.set(value.videoId, value);

				Object.values(value).forEach(child => {
					if (child && typeof child === 'object') pending.push([child, depth + 1]);
				});
			}

			videoDataSource = source;
			videoDataIndex = index;
		}

		return videoDataIndex.get(videoId) || null;
	}

	function findChannelName(value, depth = 0, visited = new Set()) {
		if (!value || depth > 10 || typeof value !== 'object' || visited.has(value)) return null;
		visited.add(value);

		for (const key of ['author', 'channelName', 'ownerName']) {
			if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
		}

		for (const key of ['videoDetails', 'ownerText', 'longBylineText', 'shortBylineText', 'content', 'lockupViewModel']) {
			const name = findChannelName(value[key], depth + 1, visited);
			if (name) return name;
		}

		return null;
	}

	function getVideoId(root) {
		const card = root.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer') || root;
		const link = card.querySelector('a[href*="/watch?v="]');

		if (!link) return null;

		return new URL(link.href).searchParams.get('v');
	}

	function getChannelNameFromDom(root) {
		const card = root.matches('ytd-watch-metadata')
			? root
			: root.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer') || root;

		const links = card.querySelectorAll('ytd-channel-name a[href*="/@"], a[href*="/@"]');
		for (const link of links) {
			const name = link.textContent?.trim();
			if (name) return name;
		}

		return null;
	}

	function getChannelCandidates(root) {
		const candidates = new Set();
		const detected = getChannelId(root);

		if (detected) candidates.add(detected);

		const card = root.matches('ytd-watch-metadata')
			? root
			: root.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer') || root;
		card.querySelectorAll('a[href*="/@"]').forEach(link => {
			const handle = link.getAttribute('href')?.match(/\/\@([^/?#]+)/)?.[1];
			if (handle) candidates.add(decodeURIComponent(handle));
			if (link.textContent?.trim()) candidates.add(link.textContent.trim());
		});

		return [...candidates];
	}

	function getChannelId(root) {
		let current = root;
		for (let depth = 0; current && depth < 8; depth += 1) {
			for (const value of [current.channelId, current.data, current.__data]) {
				const channelId = findChannelId(value);
				if (channelId) return channelId;
			}
			current = current.parentElement;
		}

		const channelNameFromDom = getChannelNameFromDom(root);
		if (channelNameFromDom) return channelNameFromDom;

		const videoId = getVideoId(root);
		if (videoId) {
			const videoData = findVideoData(videoId);
			const channelId = findChannelId(videoData);
			if (channelId) return channelId;
			const channelName = findChannelName(videoData);
			if (channelName) return channelName;
		}

		const watchData = document.querySelector('ytd-watch-flexy');
		const playerResponse = document.querySelector('ytd-player')?.getPlayerResponse?.()
			|| window.ytInitialPlayerResponse
			|| watchData?.playerResponse;
		const pathMatch = location.pathname.match(/^\/channel\/(UC[\w-]{20,})/);
		return findChannelId(playerResponse)
			|| findChannelName(playerResponse)
			|| pathMatch?.[1]
	}

	function getBadgeInfo(channelIds) {
		if (!channelBadges || !channelIds?.length) return [];
		const normalizedChannels = new Set(channelIds.map(normalize));

		return ['AI', 'PE']
			.map(name => {
				for (const channel of normalizedChannels) {
					if (channelBadges[name].has(channel)) {
						return { name, ...channelBadges[name].get(channel) };
					}
				}
				return null;
			})
			.filter(Boolean);
	}

	function isListedChannelPage() {
		const match = location.pathname.match(/^\/(?:@([^/]+)|channel\/(UC[\w-]{20,})|c\/([^/]+)|user\/([^/]+))(?:\/|$)/);
		const channel = match?.slice(1).find(Boolean);

		if (!channel) return false;

		let normalizedChannel;
		try {
			normalizedChannel = normalize(decodeURIComponent(channel));
		} catch {
			normalizedChannel = normalize(channel);
		}

		return Object.values(channelBadges).some(badges => badges.has(normalizedChannel));
	}

	function getBadgeContent(name) {
		return {
			label: name === 'AI' ? i18n('badgeAI', 'AI') : i18n('badgePE', 'Private Equity'),
			description: name === 'AI'
				? i18n('badgeAIDescription', 'This badge indicates that the channel uses artificial intelligence.')
				: i18n('badgePEDescription', 'This badge indicates that the channel is associated with private equity.')
		};
	}

	function applyBadgeBehavior(element, info) {
		const { label, description } = getBadgeContent(info.name);
		element.title = description;
		element.setAttribute('aria-label', description);

		if (info.why && /^https?:\/\//i.test(info.why)) {
			element.addEventListener('click', () => window.open(info.why, '_blank', 'noopener,noreferrer'));
			element.style.cursor = 'pointer';
		}

		return label;
	}

	function createBadge(info) {
		const { label } = getBadgeContent(info.name);
		const wrapper = document.createElement('div');

		wrapper.className = `badge-shape ytBadgeSupportedRendererBadgeShape ${BADGE_ITEM_CLASS}`;
		applyBadgeBehavior(wrapper, info);

		const renderer = document.createElement('yt-metadata-badge-renderer');
		renderer.className = 'ytMetadataBadgeRendererHost';

		const badge = document.createElement('badge-shape');
		badge.className = 'ytBadgeShapeHost ytBadgeShapeDefault ytBadgeShapeTypography';
		badge.setAttribute('role', 'img');
		badge.setAttribute('aria-label', label);
		badge.innerHTML = `
			<div class="ytBadgeShapeIcon">
				<span class="yt-icon-shape ytSpecIconShapeHost">
					<div style="width: 12px; height: 12px; display: block; fill: currentColor;">
						<svg xmlns="http://www.w3.org/2000/svg" height="12" viewBox="0 0 12 12" width="12" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;">
							<path d="M6 .5a5.5 5.5 0 110 11 5.5 5.5 0 010-11Zm0 1a4.5 4.5 0 100 9 4.5 4.5 0 000-9Zm.5 6H7a.5.5 0 010 1H5a.5.5 0 010-1h.5V6h-.25a.5.5 0 010-1H6.5v2.5ZM6 3.375a.625.625 0 110 1.25.625.625 0 010-1.25Z"></path>
						</svg>
					</div>
				</span>
			</div>
			<div class="ytBadgeShapeText">${label}</div>
		`;

		renderer.appendChild(badge);
		wrapper.appendChild(renderer);
		return wrapper;
	}

	function createMetadataBadge(info) {
		const { label } = getBadgeContent(info.name);

		const badge = document.createElement('div');
		badge.className = `ytContentMetadataViewModelBadge ${METADATA_BADGE_CLASS}`;
		badge.dataset.badge = info.name;
		applyBadgeBehavior(badge, info);
		badge.innerHTML = `
			<yt-badge-view-model class="ytBadgeViewModelHost">
				<badge-shape class="ytBadgeShapeHost ytBadgeShapeDefault ytBadgeShapeTypography" role="img" aria-label="${label}">
					<div class="ytBadgeShapeIcon">
						<span class="yt-icon-shape ytSpecIconShapeHost">
							<div style="width: 24px; height: 24px; display: block; fill: currentcolor;">
								<svg xmlns="http://www.w3.org/2000/svg" height="12" viewBox="0 0 14 12" width="12" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;">
									<path d="M6 .5a5.5 5.5 0 110 11 5.5 5.5 0 010-11Zm0 1a4.5 4.5 0 100 9 4.5 4.5 0 000-9Zm.5 6H7a.5.5 0 010 1H5a.5.5 0 010-1h.5V6h-.25a.5.5 0 010-1H6.5v2.5ZM6 3.375a.625.625 0 110 1.25.625.625 0 010-1.25Z"></path>
								</svg>
							</div>
						</span>
					</div>
					<div class="ytBadgeShapeText">${label}</div>
				</badge-shape>
			</yt-badge-view-model>
		`;
		return badge;
	}

	function getTargets() {
		const targets = new Set();
		document.querySelectorAll([
			'.ytLockupMetadataViewModelMetadata',
			'.ytContentMetadataViewModelMetadataRowMetadataRowWrap',
			'ytd-video-renderer #metadata',
			'ytd-rich-item-renderer #metadata',
			'ytd-grid-video-renderer #metadata'
		].join(',')).forEach(target => targets.add(target));

		const watchMetadata = document.querySelector('ytd-watch-metadata');
		if (watchMetadata) targets.add(watchMetadata);

		return [...targets];
	}

	function addBadges(target, names) {
		const nextNames = names.map(info => info.name).join(',');
		const videoRenderer = target.closest('ytd-video-renderer');
		const smallVideoRenderer = videoRenderer?.querySelector(':scope #badges');
		const metadataRow = target.matches('.ytContentMetadataViewModelMetadataRowMetadataRowWrap')
			? target
			: target.querySelector('.ytContentMetadataViewModelMetadataRowMetadataRowWrap');
		const metadataBadge = metadataRow?.querySelector(`:scope > .${METADATA_BADGE_CLASS}`);

		if (metadataBadge?.dataset.badge === names[0]?.name && names.length === 1) return;
		metadataBadge?.remove();

		if (smallVideoRenderer) {
			const customRenderer = smallVideoRenderer.classList.contains(BADGE_RENDERER_CLASS)
				? smallVideoRenderer
				: null;
			if (customRenderer?.dataset.badges === nextNames) return;
			if (names.length === 0) {
				customRenderer?.classList.remove(BADGE_RENDERER_CLASS);
				customRenderer?.removeAttribute('data-badges');
				customRenderer?.querySelectorAll(`.${BADGE_ITEM_CLASS}`).forEach(item => item.remove());
				return;
			}

			const renderer = smallVideoRenderer;
			renderer.classList.add(BADGE_RENDERER_CLASS);
			renderer.dataset.badges = nextNames;
			renderer.hidden = false;
			renderer.setAttribute('system-icons', '');
			let host = renderer.querySelector(':scope > yt-badge-supported-renderer');
			if (!host) {
				host = document.createElement('yt-badge-supported-renderer');
				host.className = 'ytBadgeSupportedRendererHost';
				renderer.appendChild(host);
			}
			host.querySelectorAll(`.${BADGE_ITEM_CLASS}`).forEach(item => item.remove());
			names.forEach(info => host.appendChild(createBadge(info)));
			return;
		}

		const isWatchPage = target.matches('ytd-watch-metadata');
		const insertionTarget = isWatchPage
			? target.querySelector('#title-row #title')
			: target;
		if (!insertionTarget && !metadataRow) return;

		const existingSupportedRenderer = insertionTarget?.querySelector(':scope > ytd-badge-supported-renderer');
		if (metadataRow && !existingSupportedRenderer) {
			if (names.length > 0) metadataRow.appendChild(createMetadataBadge(names[0]));
			return;
		}

		const customRenderer = insertionTarget.querySelector(`:scope > .${BADGE_RENDERER_CLASS}`);
		if (customRenderer?.dataset.badges === nextNames) return;
		customRenderer?.remove();
		if (names.length === 0 || !insertionTarget && metadataRow) {
			if (names.length > 0 && metadataRow) metadataRow.appendChild(createMetadataBadge(names[0]));
			return;
		}

		const renderer = insertionTarget.querySelector(':scope > h1 + ytd-badge-supported-renderer')
			|| insertionTarget.querySelector(':scope > ytd-badge-supported-renderer')
			|| document.createElement('ytd-badge-supported-renderer');
		renderer.classList.add(BADGE_RENDERER_CLASS, 'style-scope', 'ytd-watch-metadata');
		renderer.dataset.badges = nextNames;
		renderer.hidden = false;
		renderer.setAttribute('system-icons', '');

		let host = renderer.querySelector(':scope > yt-badge-supported-renderer');
		if (!host) {
			host = document.createElement('yt-badge-supported-renderer');
			host.className = 'ytBadgeSupportedRendererHost';
			renderer.appendChild(host);
		}

		host.querySelectorAll(`.${BADGE_ITEM_CLASS}`).forEach(item => item.remove());
		names.forEach(info => host.appendChild(createBadge(info)));
		if (!renderer.parentElement) insertionTarget.appendChild(renderer);
	}

	function refresh() {
		if (!badgePreferenceLoaded) return;
		
		if (!badgesEnabled) {
			getTargets().forEach(target => addBadges(target, []));
			return;
		}

		loadChannels().then(() => {
			if (!badgesEnabled) {
				getTargets().forEach(target => addBadges(target, []));
				return;
			}

			const targets = getTargets();
			if (isListedChannelPage()) {
				targets.forEach(target => addBadges(target, []));
				return;
			}

			targets.forEach(target => addBadges(target, getBadgeInfo(getChannelCandidates(target))));
		});
	}

	let refreshTimer = null;
	function scheduleRefresh() {
		clearTimeout(refreshTimer);
		refreshTimer = setTimeout(refresh, 250);
	}

	window.RecommendedRemoverBadges = { refresh: scheduleRefresh };

	new MutationObserver(scheduleRefresh).observe(document.documentElement, {
		childList: true,
		subtree: true
	});

	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'local' || !changes[BADGES_ENABLED_KEY]) return;
		badgesEnabled = changes[BADGES_ENABLED_KEY].newValue !== false;
		badgePreferenceLoaded = true;
		scheduleRefresh();
	});

	chrome.storage.local.get({ [BADGES_ENABLED_KEY]: false }, preferences => {
		badgesEnabled = preferences[BADGES_ENABLED_KEY] !== false;
		badgePreferenceLoaded = true;
		scheduleRefresh();
	});
})();
