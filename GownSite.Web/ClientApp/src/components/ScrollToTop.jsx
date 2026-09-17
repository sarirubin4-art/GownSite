import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Skips POP navigations (browser back/forward) so pages with their own scroll-restore
// logic — e.g. SearchGowns restoring your spot when you back out of a gown — aren't
// fought by an unconditional jump to the top.
const ScrollToTop = () => {
    const { pathname } = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        if (navigationType !== 'POP') window.scrollTo(0, 0);
    }, [pathname, navigationType]);

    return null;
};

export default ScrollToTop;
