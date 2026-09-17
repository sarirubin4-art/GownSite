// Per-browser, client-side-only dedupe cache for "reveal contact info" clicks (gowns'
// "I'm Interested" button, ads' "Contact" button) — avoids re-hitting the inquire endpoint
// (and re-incrementing its inquiry count) on repeat visits from the same browser. There's
// no server-side rate limiting; clearing localStorage or switching browsers/devices lets
// the same visitor re-trigger it freely, which is an accepted tradeoff, not a bug.
const storageKey = (prefix, id) => `regowned:interested:${prefix}:${id}`;

export const getCachedInterest = (prefix, id) => {
    try {
        const raw = localStorage.getItem(storageKey(prefix, id));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const setCachedInterest = (prefix, id, contactInfo) => {
    try {
        localStorage.setItem(storageKey(prefix, id), JSON.stringify(contactInfo));
    } catch {
        // localStorage unavailable — dedupe just won't persist across visits
    }
};
