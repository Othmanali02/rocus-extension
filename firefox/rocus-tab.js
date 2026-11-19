// Shared helper for locating/talking to a Rocus web app tab. Single source
// of truth for the dev+prod URL patterns so they can't drift out of sync
// between popup.js and background.js the way they previously did (popup.js
// used to hardcode localhost only, silently never matching production).

// No port in the localhost patterns - Firefox's match-pattern parser silently
// ignores any pattern containing a port number (Bugzilla #1362809/#1468162),
// so "http://localhost:5173/*" matches zero tabs there even though Chrome
// happily supports it. A port-less "http://localhost/*" matches any port
// (including 5173) on both browsers, so this is the only form that's
// actually cross-browser safe.
export const ROCUS_URL_PATTERNS = [
	"http://localhost/*",
	"http://127.0.0.1/*",
	"https://rocus.io/*",
	"https://www.rocus.io/*",
];

export async function findRocusTab() {
	const tabs = await browser.tabs.query({ url: ROCUS_URL_PATTERNS });
	return tabs[0] || null;
}

// Injected via chrome.scripting.executeScript({func: installBridgeScript}).
// Runs standalone in the target page's isolated world - it can only
// reference globals available there (window, chrome.*), never anything
// from this module's closure. Deliberately left as chrome.* rather than
// browser.*: this function's source is serialized into an arbitrary page's
// isolated world, which never runs our browser-polyfill-shim.js. Firefox's
// isolated worlds provide a native chrome.* compat alias (callback-style,
// which is all this fire-and-forget sendMessage call needs), so it works
// unmodified on both browsers.
export function installBridgeScript() {
	if (window.__ROCUS_BRIDGE_INSTALLED__) return;
	window.__ROCUS_BRIDGE_INSTALLED__ = true;

	window.addEventListener("message", (event) => {
		if (!event.data || event.data.source !== "page-summarizer-extension") return;

		if (event.data.type === "ALBUMS_RESPONSE") {
			chrome.runtime.sendMessage({
				type: "ALBUMS_RESPONSE",
				albums: event.data.albums,
			});
		}

		if (event.data.type === "PAGE_METADATA_PROCESSED") {
			chrome.runtime.sendMessage({
				type: "PAGE_METADATA_PROCESSED_FORWARD",
				requestId: event.data.requestId,
				success: event.data.success,
				queued: !!event.data.queued,
			});
		}
	});
}

// Injected to deliver page data into a Rocus tab. Kept as its own function
// (rather than reusing installBridgeScript) since it's called with args.
export function postPageMetadata(data) {
	window.postMessage(
		{ source: "page-summarizer-extension", type: "PAGE_METADATA", data },
		"*"
	);
}

// Injected via chrome.scripting.executeScript({func: extractPageContent})
// into the tab being saved. Runs standalone in that page's context - single
// canonical copy shared by popup.js's manual save flow and background.js's
// quick-add flow, so both go through the exact same extraction mechanism.
export function extractPageContent() {
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

	// Try to find main content area
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
