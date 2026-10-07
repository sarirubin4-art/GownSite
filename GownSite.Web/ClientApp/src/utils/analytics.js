import axios from 'axios';

// Fire-and-forget calls to /api/analytics — the server decides what to skip (bots, the
// admin, an owner viewing their own listing), and a failure here must never surface to
// the visitor, so every call swallows its own errors.

// Only the first page of a page load is an "entry" — that's the one whose referrer says
// where the visitor came from. Every later route change is an in-app navigation.
let entryReported = false;

export const trackPageView = (pathname) => {
    const isEntry = !entryReported;
    entryReported = true;
    let utmSource = null;
    if (isEntry) {
        try { utmSource = new URLSearchParams(window.location.search).get('utm_source'); } catch { /* ignore */ }
    }
    axios.post('/api/analytics/view', {
        path: pathname,
        isEntry,
        referrer: isEntry ? document.referrer || null : null,
        utmSource
    }).catch(() => {});
};

export const trackEvent = (type, entityId) => {
    axios.post('/api/analytics/event', { type, entityId }).catch(() => {});
};

// The floating ad rotates every few seconds, so count each ad at most once per browser
// session — "seen by N visits", not "flashed N times".
export const trackAdImpression = (adId) => {
    try {
        const key = `adimp:${adId}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
    } catch { /* storage blocked — just count it */ }
    trackEvent('AdImpression', adId);
};
