// quick-add-banner.js
// Auto-injected on every ordinary http(s) page (Rocus's own domains are
// excluded via manifest.json's content_scripts.exclude_matches). Shows a
// small floating Rocus icon a moment after the page settles; clicking it
// quick-adds the page via the background service worker and removes itself.

const SHOW_DELAY_MS = 1500;

// Local dedup only - doesn't need the app's full normalizeUrl rigor.
function normalizeUrlForDedup(rawUrl) {
	try {
		const u = new URL(rawUrl);
		const host = u.hostname.toLowerCase();
		let path = u.pathname;
		if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
		return host + path + u.search;
	} catch {
		return rawUrl;
	}
}

// Content extraction runs directly in this content script's own page
// context, rather than background.js injecting extractPageContent (from
// rocus-tab.js) into the source tab via browser.scripting.executeScript.
// Programmatic injection requires host_permissions (or a fresh activeTab
// grant) for the target site - popup.js's Quick Save gets activeTab for
// free because opening the popup via the toolbar icon IS a qualifying user
// gesture, but a click on this content-script-injected shadow DOM button is
// not, so with host_permissions narrowed to rocus.io only, background.js
// could never reach arbitrary sites this way. Extracting here instead needs
// no permission at all: content_scripts.matches already grants this script
// the right to run on the page, independent of host_permissions.
// Kept as a duplicate of rocus-tab.js's extractPageContent (content scripts
// declared via manifest.json can't use ES module imports) - keep in sync.
function extractPageContent() {
	const metadata = {
		title: document.title || "",
		domain: window.location.hostname,
		description: "",
		keywords: "",
		author: "",
		siteName: "",
		image: "",
		excerpt: "",
	};

	const ogTitle = document.querySelector('meta[property="og:title"]');
	const ogDesc = document.querySelector('meta[property="og:description"]');
	const ogImage = document.querySelector('meta[property="og:image"]');
	const ogSiteName = document.querySelector('meta[property="og:site_name"]');

	if (ogTitle) metadata.title = ogTitle.content || metadata.title;
	if (ogDesc) metadata.description = ogDesc.content;
	if (ogImage) metadata.image = ogImage.content;
	if (ogSiteName) metadata.siteName = ogSiteName.content;

	const descTag = document.querySelector('meta[name="description"]');
	const keywordsTag = document.querySelector('meta[name="keywords"]');
	const authorTag = document.querySelector('meta[name="author"]');

	if (descTag && !metadata.description) metadata.description = descTag.content;
	if (keywordsTag) metadata.keywords = keywordsTag.content;
	if (authorTag) metadata.author = authorTag.content;

	// Extract main content
	const clone = document.cloneNode(true);
	const scripts = clone.querySelectorAll("script, style, noscript, iframe");
	scripts.forEach((el) => el.remove());

	let content = "";

	// Prefer the most specific content container. querySelector with a
	// comma-list returns the first match in DOCUMENT ORDER, not selector
	// priority - on pages where <main> wraps the whole layout (nav, sidebar,
	// related-content widgets) with the real <article> nested inside it,
	// 'main, article, [role="main"]' would grab the bloated wrapper instead
	// of the actual content. Check article first explicitly.
	const mainContent =
		clone.querySelector('article') ||
		clone.querySelector('[role="main"]') ||
		clone.querySelector('main');
	if (mainContent) {
		content = mainContent.innerText || mainContent.textContent || "";
	} else {
		content = clone.body.innerText || clone.body.textContent || "";
	}

	// Clean up content
	content = content.replace(/\s+/g, " ").trim().substring(0, 5000);

	if (!metadata.excerpt && content) {
		const paragraphs = content.split(/\n\n|\. /);
		metadata.excerpt = paragraphs[0]?.substring(0, 200) || "";
	}

	if (window.location.hostname.includes("reddit.com")) {
		const pathMatch = window.location.pathname.match(/\/r\/([^\/]+)/);
		if (pathMatch) metadata.subreddit = pathMatch[1];
		const postContent = document.querySelector('[data-test-id="post-content"]');
		if (postContent) content = postContent.innerText || postContent.textContent || "";
	}

	return {
		url: window.location.href,
		metadata,
		content,
		timestamp: Date.now(),
	};
}

function buildBanner({ onAdd }) {
	const host = document.createElement("div");
	host.id = "rocus-quick-add-host";
	// Shadow DOM isolates the CHILDREN from page CSS, but this host element
	// itself is a light-DOM node - force its own placement so aggressive
	// page-wide selectors/resets can't move or hide it.
	host.style.setProperty("all", "initial", "important");
	host.style.setProperty("position", "fixed", "important");
	host.style.setProperty("bottom", "20px", "important");
	host.style.setProperty("right", "20px", "important");
	host.style.setProperty("z-index", "2147483647", "important");
	host.style.setProperty("max-width", "64px", "important");
	host.style.setProperty("max-height", "76px", "important");
	host.style.setProperty("box-sizing", "content-box", "important");

	const shadow = host.attachShadow({ mode: "open" });
	shadow.innerHTML = `
		<style>
			button {
				all: initial;
				display: block;
				cursor: pointer;
				background: transparent;
				border: none;
				padding: 0;
				opacity: 0;
				transition: opacity 0.2s ease, transform 0.15s ease;
			}
			button.visible { opacity: 1; }
			button:hover { transform: scale(1.06); }
			button:active { transform: scale(0.95); }
			img {
				all: initial;
				display: block;
				width: 44px;
				height: auto;
				max-width: 44px;
				max-height: 56px;
				box-sizing: content-box;
			}
		</style>
		<button type="button" title="Add to Rocus">
			<img alt="Rocus" width="44" height="56" />
		</button>
	`;

	// Set via property rather than interpolating into the innerHTML template
	// above - keeps the template free of dynamic values entirely.
	shadow.querySelector("img").src = browser.runtime.getURL("./icons/RocusSwirlBlue.png");

	const addBtn = shadow.querySelector("button");

	addBtn.addEventListener("click", () => {
		if (addBtn.disabled) return;
		addBtn.disabled = true;
		host.remove();
		onAdd().then((result) => {
			if (!result.ok) {
				console.error("Rocus quick add failed:", result.error);
			}
		});
	});

	document.documentElement.appendChild(host);
	requestAnimationFrame(() => addBtn.classList.add("visible"));

	return host;
}

async function init() {
	const normalizedUrl = normalizeUrlForDedup(window.location.href);
	const addedKey = `rq_added_${normalizedUrl}`;

	const stored = await browser.storage.local.get([addedKey]);
	if (stored[addedKey]) return; // already saved this exact URL

	setTimeout(() => {
		buildBanner({
			onAdd: async () => {
				// Extracted right here, in-page - see extractPageContent's
				// comment above for why background.js can no longer do this
				// via scripting.executeScript on the source tab.
				let pageData;
				try {
					pageData = extractPageContent();
				} catch (err) {
					return { ok: false, error: "Could not extract page content: " + err.message };
				}
				try {
					const response = await browser.runtime.sendMessage({ type: "QUICK_ADD", pageData });
					if (response?.ok) {
						await browser.storage.local.set({ [addedKey]: true });
						return { ok: true };
					}
					return { ok: false, error: response?.error };
				} catch (err) {
					return { ok: false, error: err.message };
				}
			},
		});
	}, SHOW_DELAY_MS);
}

init();
