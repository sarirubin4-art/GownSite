// Per-browser, client-side-only dedupe cache for "reveal contact info" clicks (gowns'
// "I'm Interested" button, ads' "Contact" button) — avoids re-hitting the inquire endpoint
// (and re-incrementing its inquiry count) on repeat visits from the same browser. There's
// no server-side rate limiting; clearing localStorage or switching browsers/devices lets
// the same visitor re-trigger it freely, which is an accepted tradeoff, not a bug.
const storageKey = (prefix, id) => `regowned:interested:${prefix}:${id}`;
// Bounds how long a cached reveal can keep showing contact info the owner later hid —
// past this age it's treated as a miss so the caller re-hits /inquire and gets the
// listing's current visibility choices instead of a stale snapshot.
const maxAgeMs = 24 * 60 * 60 * 1000;

export const getCachedInterest = (prefix, id) => {
    try {
        const raw = localStorage.getItem(storageKey(prefix, id));
        if (!raw) return null;
        const { contactInfo, cachedAt } = JSON.parse(raw);
        if (!cachedAt || Date.now() - cachedAt > maxAgeMs) return null;
        return contactInfo;
    } catch {
        return null;
    }
};

export const setCachedInterest = (prefix, id, contactInfo) => {
    try {
        localStorage.setItem(storageKey(prefix, id), JSON.stringify({ contactInfo, cachedAt: Date.now() }));
    } catch {
        // localStorage unavailable — dedupe just won't persist across visits
    }
};
