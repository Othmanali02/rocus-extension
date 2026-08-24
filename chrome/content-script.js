// content-script.js

console.log("FunkyAI content script loaded");

console.log("🔥 CONTENT SCRIPT LOADED IN PAGE:", window.location.href);


// Listen for album requests from the extension popup
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg.type === "READ_ALBUMS_FROM_DB") {
        readAlbums().then(albums => respond({ albums })).catch(err => {
            respond({ error: err.message });
        });
        return true; // Keep message channel open for async response
    }
});

async function readAlbums() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("FunkyAIDB", 1);

        req.onerror = () => reject(new Error("Cannot open FunkyAIDB"));

        req.onsuccess = () => {
            const db = req.result;

            if (!db.objectStoreNames.contains("albums")) {
                resolve([]);
                return;
            }

            const tx = db.transaction("albums", "readonly");
            const store = tx.objectStore("albums");
            const getAllReq = store.getAll();

            getAllReq.onsuccess = () => resolve(getAllReq.result || []);
            getAllReq.onerror = () => reject(new Error("Failed reading albums"));
        };

        req.onupgradeneeded = () => resolve([]); // DB doesn’t exist yet
    });
}
