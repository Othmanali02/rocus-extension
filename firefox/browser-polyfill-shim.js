// Firefox natively exposes a promise-based `browser` global. Chrome only has
// `chrome`, but its MV3 APIs already return promises when no callback is
// passed, so aliasing it here lets the rest of the code just call
// `browser.*` and work unmodified on both browsers.
if (typeof globalThis.browser === "undefined") {
	globalThis.browser = chrome;
}
