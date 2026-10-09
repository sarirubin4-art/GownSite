import axios from 'axios';

// Fire-and-forget calls to /api/analytics — the server decides what to skip (bots, the
// admin, an owner viewing their own listing), and a failure here must never surface to
// the visitor, so every call swallows its own errors.

// A "visit" is one stretch of browsing that ends after 30 minutes with no page views, and
// each page counts once per visit: going back and forth between Browse Gowns and a gown
// counts Browse Gowns once, not every time they return to it. Kept in localStorage (not
// sessionStorage) so it's shared across tabs — opening gowns in new tabs is still the same
// visit. Falls back to memory if storage is blocked (private mode, etc.).
const VISIT_KEY = 'rg_visit';
const VISIT_IDLE_MS = 30 * 60 * 1000;
let memoryVisit = null;

const loadVisit = () => {
    let visit = memoryVisit;
    try {
        const stored = localStorage.getItem(VISIT_KEY);
        if (stored) visit = JSON.parse(stored);
    } catch { /* storage blocked — use the in-memory copy */ }
    return visit && Date.now() - visit.last < VISIT_IDLE_MS ? visit : null;
};

const saveVisit = (visit) => {
    memoryVisit = visit;
    try { localStorage.setItem(VISIT_KEY, JSON.stringify(visit)); } catch { /* memory copy is enough */ }
};

// Match the server's normalization (AnalyticsRecorder.NormalizePath) so "/Search/" and
// "/search" are the same page here too.
const normalizePath = (pathname) => {
    const p = (pathname || '/').toLowerCase();
    return p.length > 1 ? p.replace(/\/+$/, '') : p;
};

export const trackPageView = (pathname) => {
    const path = normalizePath(pathname);
    let visit = loadVisit();
    // The first page of a visit is its "entry" — the one whose referrer says where the
    // visitor came from. Everything after is an in-site navigation.
    const isEntry = !visit;
    if (!visit) visit = { paths: [], last: 0 };
    visit.last = Date.now(); // any page view, even a repeat, keeps the visit alive
    const alreadyCounted = visit.paths.includes(path);
    if (!alreadyCounted) visit.paths.push(path);
    saveVisit(visit);
    if (alreadyCounted) return;

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
