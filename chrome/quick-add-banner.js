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
// rocus-tab.js) into the source tab via chrome.scripting.executeScript.
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

// The real rocus-swirl.js curl-into-ring / spin / unroll-back-into-logo
// motion (see /home/seahorse/Documents/Rocus/RocusSwirlAnimation/HANDOFF.md),
// played at 2x the reference speed within the icon's existing
// 839x1076-logo-px footprint - no sliding, no text reveal, since those
// only apply to the component's hero-placement use case. Used both as an
// ambient cue when a return-trigger insight is pending and as "saving..."
// feedback on every quick-add click (see buildBanner). Loaded lazily via
// dynamic import (only when actually needed) since quick-add-banner.js is
// a classic script and can't use a static import for an ES module.
// Reentrant-safe: a second call while one is already running on the same
// imgEl (e.g. clicking mid-way through the insight-appear animation)
// returns the same in-flight promise instead of starting a conflicting
// second animation.
function playSwirlAnimation(imgEl) {
	if (imgEl.__rocusAnimPromise) return imgEl.__rocusAnimPromise;
	const promise = runSwirlAnimation(imgEl).finally(() => {
		delete imgEl.__rocusAnimPromise;
	});
	imgEl.__rocusAnimPromise = promise;
	return promise;
}

async function runSwirlAnimation(imgEl) {
	// rocus-swirl.js unconditionally calls customElements.define("rocus-swirl", ...)
	// at module-evaluation time to register the <rocus-swirl> element - a feature
	// we don't use here (we only want the exported createRocusSwirl() frame math).
	// Content-script isolated worlds null out `customElements` as a Chrome/Firefox
	// restriction, so that registration throws and the whole dynamic import
	// rejects before we ever reach createRocusSwirl. Shim a harmless no-op only
	// when it's actually broken (null/undefined) - never touch a real registry.
	let restoreCustomElements = null;
	if (typeof window.customElements === "undefined" || window.customElements === null) {
		try {
			Object.defineProperty(window, "customElements", {
				configurable: true,
				value: { get: () => undefined, define: () => {} },
			});
			restoreCustomElements = () => {
				try { delete window.customElements; } catch {}
			};
		} catch {
			// can't patch it - the import below will fail and we bail out gracefully
		}
	}

	let mod;
	try {
		mod = await import(chrome.runtime.getURL("./rocus-swirl.js"));
	} catch (err) {
		console.error("Rocus insight animation failed to load:", err);
		return;
	} finally {
		restoreCustomElements?.();
	}
	if (!imgEl.isConnected) return; // banner was already dismissed while we were loading

	const anim = mod.createRocusSwirl();
	const [cx, cy] = anim.config.center;

	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("viewBox", "0 0 839 1076");
	svg.setAttribute("class", "rocus-anim");
	const g = document.createElementNS(svgNS, "g");
	const path = document.createElementNS(svgNS, "path");
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", anim.config.color);
	path.setAttribute("stroke-width", anim.config.strokeWidth);
	path.setAttribute("stroke-linecap", "butt");
	path.setAttribute("stroke-linejoin", "round");
	g.appendChild(path);
	svg.appendChild(g);
	imgEl.replaceWith(svg);

	const SPEED = 3; // "3x the reference speed" per product decision - the shape/curl/spin math itself is untouched
	return new Promise((resolve) => {
		let last = null;
		let t = 0;
		function tick(now) {
			if (!svg.isConnected) { resolve(); return; } // banner dismissed mid-animation
			if (last !== null) t += (now - last) * SPEED;
			last = now;
			const f = anim.frame(t);
			path.setAttribute("d", f.path);
			g.setAttribute("transform", `rotate(${f.rotation.toFixed(2)} ${cx} ${cy})`);
			if (t < anim.playDuration) {
				requestAnimationFrame(tick);
			} else {
				svg.replaceWith(imgEl); // settle back to the exact static icon - frame() at rest matches RocusSwirlBlue.png
				resolve();
			}
		}
		requestAnimationFrame(tick);
	});
}

function buildBanner({ onAdd, insight }) {
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

	const shadow = host.attachShadow({ mode: "open" });
	shadow.innerHTML = `
		<style>
			.row {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			button {
				all: initial;
				pointer-events: inherit; /* "all: initial" resets this to its initial value (auto), which would defeat the host's pointer-events:none idle state */
				display: block;
				cursor: pointer;
			}
			#addBtn {
				background: transparent;
				border: none;
				padding: 0;
				opacity: 0;
				transition: opacity 0.2s ease, transform 0.15s ease;
			}
			#addBtn.visible { opacity: 0.6; }
			#addBtn.visible.active { opacity: 1; }
			#addBtn:hover { transform: scale(1.06); }
			#addBtn:active { transform: scale(0.95); }
			img, svg.rocus-anim {
				display: block;
				width: 44px;
				height: auto;
			}
			#insightBubble {
				max-width: 220px;
				padding: 10px 14px;
				background: #ffffff;
				border-radius: 12px;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
				font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
				color: #1f2937;
				text-align: left;
				white-space: normal;
			}
			#insightBubble:hover { background: #f0f7ff; }
			/* The shared "button { all: initial; display: block }" rule above is
			   author-origin, so it overrides the UA stylesheet's default
			   [hidden] { display: none } for the SAME reason (author beats UA
			   regardless of specificity) - restore it explicitly or the hidden
			   attribute alone won't actually hide the bubble. */
			#insightBubble[hidden] { display: none; }
		</style>
		<div class="row">
			<button type="button" id="insightBubble" hidden></button>
			<button type="button" id="addBtn" title="Add to Rocus">
				<img src="${chrome.runtime.getURL("./icons/RocusSwirlBlue.png")}" alt="Rocus" />
			</button>
		</div>
	`;

	const addBtn = shadow.querySelector("#addBtn");
	const imgEl = shadow.querySelector("img");
	const insightBubble = shadow.querySelector("#insightBubble");

	// Return-trigger insight (see background.js's ROCUS_INSIGHT_READY
	// handler): surfaced as the real rocus-swirl curl-into-ring / spin /
	// unroll-back-into-logo animation (see playSwirlAnimation), then a
	// clickable text bubble once that settles (see the requestAnimationFrame
	// block below) - clicking it asks background.js to open/focus a Rocus
	// tab at insight.url. Clicking the icon itself is unchanged - it still
	// just quick-adds the page.
	if (insight?.text) {
		addBtn.title = insight.text;
	}
	insightBubble.addEventListener("click", () => {
		chrome.runtime.sendMessage({ type: "OPEN_INSIGHT", url: insight.url }).catch(() => {});
		insightBubble.hidden = true;
		addBtn.title = "Add to Rocus";
	});

	addBtn.addEventListener("click", () => {
		if (addBtn.disabled) return;
		addBtn.disabled = true;
		document.removeEventListener("mousemove", trackHover);
		keepOnTop.disconnect();
		// Play the curl/spin/unroll as "saving..." feedback on every click,
		// not just for a pending insight - and don't remove the banner until
		// both the animation and the actual save have finished, whichever
		// takes longer, so the motion always gets to complete instead of the
		// icon just vanishing the instant you click it.
		const animationDone = playSwirlAnimation(imgEl);
		const saveDone = onAdd().then((result) => {
			if (!result.ok) {
				console.error("Rocus quick add failed:", result.error);
			}
		});
		Promise.all([animationDone, saveDone]).then(() => host.remove());
	});

	document.documentElement.appendChild(host);

	// No page overlay (chat widgets, cookie banners, etc. - which can share
	// our max z-index and win ties by being added to the DOM later) should
	// ever be able to paint over the icon. Rather than the Popover API (tried
	// earlier - it introduced a positioning offset and, worse, threw in
	// Firefox and silently left the icon stuck at opacity:0 forever), just
	// keep re-appending host as the last child of <html> whenever the page
	// adds something after it, so it keeps winning the z-index tie by DOM
	// order the same way it originally lost it.
	const keepOnTop = new MutationObserver(() => {
		if (document.documentElement.lastElementChild !== host) {
			document.documentElement.appendChild(host);
		}
	});
	keepOnTop.observe(document.documentElement, { childList: true });

	requestAnimationFrame(() => {
		addBtn.classList.add("visible");
		if (insight?.text) {
			// Bubble reveals only once the swirl settles, per spec ("after the
			// swirl spins and shows it") - not simultaneously with the motion.
			playSwirlAnimation(imgEl).then(() => {
				if (!host.isConnected) return; // e.g. quick-added mid-animation
				insightBubble.textContent = insight.text;
				insightBubble.hidden = false;
			});
		}
	});

	// The icon must stay visible on top at all times, but shouldn't ever
	// permanently block clicks meant for something else the page places in
	// the same corner (e.g. a chat bubble). So on hover-capable devices it's
	// pointer-events:none until the cursor is actually over it - clicks pass
	// straight through otherwise. CSS :hover can't drive this itself since
	// an element with pointer-events:none never receives hover in the first
	// place, so proximity is tracked manually via mousemove.
	const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
	function trackHover(e) {
		const rect = host.getBoundingClientRect();
		const isOver =
			e.clientX >= rect.left && e.clientX <= rect.right &&
			e.clientY >= rect.top && e.clientY <= rect.bottom;
		host.style.setProperty("pointer-events", isOver ? "auto" : "none", "important");
		addBtn.classList.toggle("active", isOver);
	}
	if (canHover) {
		host.style.setProperty("pointer-events", "none", "important");
		document.addEventListener("mousemove", trackHover);
	}

	return host;
}

async function init() {
	// Chrome/Firefox render some http(s) resources (a directly-navigated PDF,
	// a standalone image, plain text, XML/JSON, etc.) as a native viewer
	// rather than a real page - the manifest's http(s)-wide match can't tell
	// those apart from an actual site, but document.contentType can. There's
	// no meaningful "page" to quick-add there, and the icon just gets in the
	// way of the viewer's own UI.
	if (document.contentType !== "text/html" && document.contentType !== "application/xhtml+xml") return;

	const normalizedUrl = normalizeUrlForDedup(window.location.href);
	const addedKey = `rq_added_${normalizedUrl}`;

	const stored = await chrome.storage.local.get([addedKey]);
	if (stored[addedKey]) return; // already saved this exact URL

	const { pendingInsight } = await chrome.storage.local.get(["pendingInsight"]);

	setTimeout(() => {
		if (pendingInsight) chrome.storage.local.remove("pendingInsight"); // one surface per insight, not one per page load
		buildBanner({
			insight: pendingInsight,
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
					const response = await chrome.runtime.sendMessage({ type: "QUICK_ADD", pageData });
					if (response?.ok) {
						await chrome.storage.local.set({ [addedKey]: true });
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
