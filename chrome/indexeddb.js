// indexeddb.js
const DB_NAME = "summaries-db";
const STORE_NAME = "summaries";
const DB_VERSION = 1;

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "url" });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function saveSummary(url, summary) {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, "readwrite");
	tx.objectStore(STORE_NAME).put({ url, summary, timestamp: Date.now() });

	return new Promise((resolve, reject) => {
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

async function getSummary(url) {
	const db = await openDB();
	const tx = db.transaction(STORE_NAME, "readonly");
	const req = tx.objectStore(STORE_NAME).get(url);

	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result ? req.result.summary : null);

		req.onerror = () => reject(req.error);
	});
}

export { saveSummary, getSummary };
