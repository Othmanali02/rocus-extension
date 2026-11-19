// background.js (module)
import { saveSummary, getSummary } from "./indexeddb.js";
import { findRocusTab, installBridgeScript, postPageMetadata } from "./rocus-tab.js";

const QUICK_ADD_TIMEOUT_MS = 45000; // generous: a hidden tab may need to cold-load AI models first

const pendingQuickAdds = new Map(); // requestId -> { resolve, timer }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	// 1) Summarize request
	if (msg.type === "summarize") {
		simulateSummary(msg.text).then(async (summary) => {
			await saveSummary(msg.url, summary);
			sendResponse({ ok: true });
		});
		return true; // keep worker alive
	}

	// 2) Get summary request  <-- PUT THIS HERE
	if (msg.type === "getSummary") {
		getSummary(msg.url).then((summary) => {
			sendResponse({ summary });
		});
		return true; // keep worker alive
	}

	// 3) Quick-add request from the auto-injected banner content script
	if (msg.type === "QUICK_ADD") {
		handleSavePage({ ...msg.pageData, album: null }).then(sendResponse);
		return true; // keep worker alive
	}

	// 3b) Save-to-album request from the popup - same hidden-tab fallback as
	// quick-add, just with an album already chosen by the caller.
	if (msg.type === "SAVE_TO_ALBUM") {
		handleSavePage(msg.pageData).then(sendResponse);
		return true; // keep worker alive
	}

	// 4) Completion signal forwarded out of a Rocus tab by the bridge script
	if (msg.type === "PAGE_METADATA_PROCESSED_FORWARD") {
		const pending = pendingQuickAdds.get(msg.requestId);
		if (pending) {
			clearTimeout(pending.timer);
			pendingQuickAdds.delete(msg.requestId);
			pending.resolve({ ok: !!msg.success, queued: !!msg.queued });
		}
	}

	// 5) User clicked a return-trigger insight's text in the quick-add
	// banner - open/focus a Rocus tab at the deep link it pointed at.
	// Fire-and-forget: the content script doesn't wait on a response.
	if (msg.type === "OPEN_INSIGHT" && msg.url) {
		openInsightUrl(msg.url);
	}
});

// Unlike handleSavePage()'s hidden background tab (opened inactive, just
// to relay a save), this is a direct user click on a notification - the
// tab should actually come to the front, not just exist.
async function openInsightUrl(url) {
	const tab = await findRocusTab();
	if (tab) {
		await chrome.tabs.update(tab.id, { url, active: true });
		await chrome.windows.update(tab.windowId, { focused: true });
	} else {
		await chrome.tabs.create({ url });
	}
}

// Lets rocus.io itself detect whether this extension is installed (e.g. for
// the onboarding tutorial's "Browser Extension" step) - only reachable from
// origins listed in manifest.json's externally_connectable, not arbitrary
// sites, so this can't be used to fingerprint the extension from anywhere else.
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
	if (msg?.type === "ROCUS_PING") {
		sendResponse({ type: "ROCUS_PONG", installed: true, version: chrome.runtime.getManifest().version });
	}

	// Return-trigger relay: the web app computed a "dormant cluster just got
	// new items" insight and wants the next ordinary page's quick-add icon
	// to surface it. Stored for quick-add-banner.js to pick up and clear.
	if (msg?.type === "ROCUS_INSIGHT_READY" && msg.insight) {
		chrome.storage.local.set({ pendingInsight: msg.insight });
	}
});

async function handleSavePage(pageData) {
	// Extraction now happens in the source page itself (quick-add-banner.js)
	// or in the popup's own activeTab-scoped executeScript call, and is
	// passed straight in - background.js can't reach arbitrary sites via
	// chrome.scripting.executeScript without host_permissions covering them,
	// and clicking the in-page banner button doesn't grant activeTab the way
	// opening the popup via the toolbar icon does. Caller sets pageData.album
	// (null for quick-add, an album id for save-to-album from the popup).
	if (!pageData) {
		return { ok: false, error: "Could not extract page content." };
	}

	const requestId = crypto.randomUUID();
	pageData.extensionRequestId = requestId;

	let tab = await findRocusTab();
	let hiddenTabId = null;

	if (!tab) {
		const created = await chrome.tabs.create({ url: "https://rocus.io/dashboard", active: false });
		hiddenTabId = created.id;
		await waitForTabComplete(hiddenTabId);
		tab = created;
	}

	try {
		await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: installBridgeScript });
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: postPageMetadata,
			args: [pageData],
		});
	} catch (err) {
		if (hiddenTabId) chrome.tabs.remove(hiddenTabId).catch(() => {});
		return { ok: false, error: "Could not reach Rocus tab: " + err.message };
	}

	const result = await new Promise((resolve) => {
		const timer = setTimeout(() => {
			pendingQuickAdds.delete(requestId);
			resolve({ ok: false, timedOut: true });
		}, QUICK_ADD_TIMEOUT_MS);
		pendingQuickAdds.set(requestId, { resolve, timer });
	});

	// queued: Rocus has no processing mode chosen yet (a brand-new user).
	// The page is saved on that device and waits for the choice, so bring
	// the Rocus tab to the front where the choice is showing, instead of
	// closing it before the user ever sees it.
	if (result.ok && result.queued) {
		await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
		if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
		return { ok: true, queued: true };
	}

	if (hiddenTabId) chrome.tabs.remove(hiddenTabId).catch(() => {});

	return result.ok
		? { ok: true }
		: {
				ok: false,
				error: result.timedOut
					? "Timed out waiting for Rocus to finish saving."
					: "Rocus could not save this page.",
			};
}

function waitForTabComplete(tabId) {
	return new Promise((resolve) => {
		function listener(id, info) {
			if (id === tabId && info.status === "complete") {
				chrome.tabs.onUpdated.removeListener(listener);
				resolve();
			}
		}
		chrome.tabs.onUpdated.addListener(listener);
		// Fallback: the tab may already be complete before the listener attaches.
		chrome.tabs.get(tabId, (t) => {
			if (t && t.status === "complete") {
				chrome.tabs.onUpdated.removeListener(listener);
				resolve();
			}
		});
	});
}

async function simulateSummary(text) {
	const summary = text.slice(0, 200) + (text.length > 200 ? "…" : "");
	await new Promise((r) => setTimeout(r, 300));
	return summary;
}

export { getSummary };
