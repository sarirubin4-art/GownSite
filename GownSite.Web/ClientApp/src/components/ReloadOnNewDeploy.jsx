import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const BUNDLE_PATTERN = /\/assets\/index-[\w-]+\.js/;

// This is a single-page app: moving between pages never re-downloads the site's code, so
// a tab left open across a deploy keeps running the OLD code indefinitely — while every
// API call hits the NEW backend. That's how a patron once got stuck on the ad form: her
// tab predated the contact-visibility checkboxes, so the old form had no checkboxes to
// show her, yet the new backend rejected the ad for not having phone/email enabled.
//
// Fix: every so often (and whenever the tab comes back into focus), quietly fetch the
// live index.html and compare its main script filename — Vite gives it a new hash on
// every build — to the one this tab is running. If they differ, the next in-app page
// change does a full reload instead, so the user lands on that page with current code.
// Only reloads on navigation, never mid-page, so nothing being typed is ever lost.
const ReloadOnNewDeploy = () => {
    const { pathname } = useLocation();
    const navigationType = useNavigationType();
    const newVersionAvailable = useRef(false);

    useEffect(() => {
        if (import.meta.env.DEV) return undefined;
        const runningBundle = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src');
        if (!runningBundle) return undefined;

        const check = async () => {
            if (newVersionAvailable.current) return;
            try {
                const res = await fetch('/', { cache: 'no-store' });
                const liveBundle = (await res.text()).match(BUNDLE_PATTERN)?.[0];
                if (liveBundle && !runningBundle.endsWith(liveBundle)) newVersionAvailable.current = true;
            } catch {
                // Offline or a blip — just try again next time.
            }
        };
        const onVisible = () => { if (document.visibilityState === 'visible') check(); };

        const interval = setInterval(check, CHECK_INTERVAL_MS);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    useEffect(() => {
        // Skips back/forward (POP) for the same reason ScrollToTop does — SearchGowns
        // restores your scroll spot when you back out of a gown. The next forward
        // navigation picks up the reload instead.
        if (newVersionAvailable.current && navigationType !== 'POP') window.location.reload();
    }, [pathname, navigationType]);

    return null;
};

export default ReloadOnNewDeploy;
