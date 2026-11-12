import "./browser-polyfill-shim.js";
import { findRocusTab, installBridgeScript, extractPageContent } from "./rocus-tab.js";
// popup.js is a real ES module page (not a content-script isolated world),
// so unlike quick-add-banner.js this can import rocus-swirl.js statically -
// no dynamic-import/customElements-shim workaround needed here.
import { createRocusSwirl } from "./rocus-swirl.js";

// State
let currentUrl = "";
let albums = [];

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
	// Get current tab URL
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	currentUrl = tab.url;

	// Display URL preview
	const urlPreview = document.getElementById("urlPreview");
	try {
		const hostname = new URL(currentUrl).hostname;
		urlPreview.textContent = hostname;
	} catch (e) {
		urlPreview.textContent = currentUrl.substring(0, 40) + "...";
	}

	// Check if localhost:5173 is running and load albums
	await checkConnectionAndLoadAlbums();

	// Setup event listeners
	setupEventListeners();
});

// Check connection and load albums
async function checkConnectionAndLoadAlbums() {
	const connectionStatus = document.getElementById("connectionStatus");
	const albumBrowser = document.getElementById("albumBrowser");

	// Show the last-known album list immediately, if we have one, so the
	// popup is never blocked on a live Rocus tab just to render something -
	// saving into a stale-looking list still works, since SAVE_TO_ALBUM
	// opens a hidden Rocus tab on its own regardless of what loaded here.
	const { cachedAlbums } = await browser.storage.local.get("cachedAlbums");
	if (cachedAlbums) {
		albums = cachedAlbums;
		connectionStatus.style.display = "none";
		albumBrowser.classList.add("active");
		displayAlbums(albums);
	}

	try {
		// Try to read albums live from a Rocus tab
		albums = await readAlbumsFromIndexedDB();
		await browser.storage.local.set({ cachedAlbums: albums });

		// Connection successful
		connectionStatus.style.display = "none";
		albumBrowser.classList.add("active");

		// Display albums
		displayAlbums(albums);
	} catch (error) {
		console.error("Connection error:", error);
		if (!cachedAlbums) {
			connectionStatus.style.display = "block";
			albumBrowser.classList.remove("active");
		}
	}
}

// Read albums from IndexedDB (accessed from localhost:5173's storage)
// NEW VERSION — reads using content script
async function readAlbumsFromIndexedDB() {
	const rocusTab = await findRocusTab();

	if (!rocusTab) {
		throw new Error("FunkyAI tab not found");
	}

	const tabId = rocusTab.id;

	// Inject the bridge FIRST (to capture frontend responses)
	await browser.scripting.executeScript({
		target: { tabId },
		func: installBridgeScript,
	});

	// Then request the albums from the frontend
	await browser.scripting.executeScript({
		target: { tabId },
		func: () => {
			window.postMessage(
				{
					source: "page-summarizer-extension",
					type: "REQUEST_ALBUMS",
				},
				"*"
			);
		},
	});

	// Now wait for forwarded message
	return new Promise((resolve, reject) => {
		const listener = (message, sender, sendResponse) => {
			if (message.type === "ALBUMS_RESPONSE") {
				browser.runtime.onMessage.removeListener(listener);
				resolve(message.albums);
			}
		};

		browser.runtime.onMessage.addListener(listener);

		setTimeout(() => {
			browser.runtime.onMessage.removeListener(listener);
			reject(new Error("Frontend did not respond"));
		}, 2000);
	});
}


// Display albums in grid
function displayAlbums(albumsList) {
	const albumsGrid = document.getElementById("albumsGrid");
	const noAlbumsMsg = document.getElementById("noAlbumsMsg");

	if (!albumsList || albumsList.length === 0) {
		albumsGrid.style.display = "none";
		noAlbumsMsg.style.display = "block";
		return;
	}

	albumsGrid.style.display = "grid";
	noAlbumsMsg.style.display = "none";
	albumsGrid.innerHTML = "";


  const albumsArray = Object.values(albumsList);

	albumsArray.forEach((album) => {
		const card = document.createElement("div");
		card.className = "album-card";
		card.dataset.albumId = album.id;

		// Get cluster count
		const clusterCount = album.cluster_ids ? album.cluster_ids.length : 0;

		// Built via DOM methods rather than innerHTML - album.name/album.icon
		// are user-controlled (set via the Rocus web app), so interpolating
		// them into an HTML string would be an XSS risk. textContent escapes
		// automatically; .src as a property assignment isn't HTML-parsed.
		const iconDiv = document.createElement("div");
		iconDiv.className = "album-icon";
		const iconImg = document.createElement("img");
		iconImg.src = `./icons/${album.icon}`;
		iconDiv.appendChild(iconImg);

		const nameDiv = document.createElement("div");
		nameDiv.className = "album-name";
		nameDiv.textContent = album.name || "Untitled";

		card.appendChild(iconDiv);
		card.appendChild(nameDiv);

		card.addEventListener("click", () => selectAlbum(album.id));
		albumsGrid.appendChild(card);
	});
}

// Select album - flashes the selected state for immediate feedback, then
// saves right away (no separate confirm button in the flow).
function selectAlbum(albumId) {
	document.querySelectorAll(".album-card").forEach((card) => {
		card.classList.toggle("selected", card.dataset.albumId === albumId);
	});

	saveToAlbum(albumId);
}

// Setup event listeners
function setupEventListeners() {
	// Quick save button (no album)
	document
		.getElementById("quickSaveBtn")
		.addEventListener("click", async () => {
			await saveToAlbum(null);
		});

	// Retry button
	document.getElementById("retryBtn").addEventListener("click", async () => {
		await checkConnectionAndLoadAlbums();
	});
}

// Plays the real rocus-swirl curl-into-ring / spin / unroll-back-into-logo
// motion (see /home/seahorse/Documents/Rocus/RocusSwirlAnimation/HANDOFF.md)
// at 2x the reference speed in the loading overlay's SVG, as "saving..."
// feedback - same approach as quick-add-banner.js's playSwirlAnimation,
// minus the img<->svg swap since the popup's SVG is always present in the
// markup rather than toggled in for a floating page icon.
function playPopupSwirl() {
	const g = document.getElementById("rocusSwirlG");
	const path = document.getElementById("rocusSwirlPath");
	const anim = createRocusSwirl();
	const [cx, cy] = anim.config.center;
	const SPEED = 3; // "3x the reference speed" per product decision - the shape/curl/spin math itself is untouched

	return new Promise((resolve) => {
		let last = null;
		let t = 0;
		function tick(now) {
			if (last !== null) t += (now - last) * SPEED;
			last = now;
			const f = anim.frame(t);
			path.setAttribute("d", f.path);
			g.setAttribute("transform", `rotate(${f.rotation.toFixed(2)} ${cx} ${cy})`);
			if (t < anim.playDuration) {
				requestAnimationFrame(tick);
			} else {
				resolve();
			}
		}
		requestAnimationFrame(tick);
	});
}

// Save to album
async function saveToAlbum(albumId) {
	const loadingOverlay = document.getElementById("loadingOverlay");
	const successOverlay = document.getElementById("successOverlay");
	const loadingText = document.getElementById("loadingText");

	loadingText.textContent = albumId ? "Saving to album..." : "Processing...";
	loadingOverlay.classList.add("active");
	// Let the animation play out fully regardless of how fast the actual
	// save resolves - awaited below on both the success and error paths.
	const animationDone = playPopupSwirl();

	try {
		// Get current tab
		const [tab] = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});

		// Extract content and metadata
		const results = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			func: extractPageContent,
		});

		const pageData = results[0].result;

		// Add album ID to payload
		pageData.album = albumId;

		// Hand off to background.js, which opens a hidden Rocus tab if none
		// is already open - same fallback quick-add already relies on.
		const response = await browser.runtime.sendMessage({ type: "SAVE_TO_ALBUM", pageData });

		if (!response?.ok) {
			throw new Error(response?.error || "Rocus could not save this page.");
		}

		await animationDone;

		// Hide loading, show success
		loadingOverlay.classList.remove("active");
		successOverlay.classList.add("active");

		// Auto-close after 1.5 seconds
		setTimeout(() => {
			window.close();
		}, 1500);
	} catch (error) {
		console.error("Error saving:", error);
		await animationDone;
		loadingOverlay.classList.remove("active");
		alert("Error: " + error.message);
	}
}
