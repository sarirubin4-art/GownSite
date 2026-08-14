import { useEffect } from 'react';

const DEFAULT_TITLE = 'Regowned | Buy, Sell & Rent Gowns for Every Simcha';
const DEFAULT_DESCRIPTION = "Buy, sell, and rent gowns for every simcha. Find the perfect dress nearby, or give one you love a beautiful second life.";

// Sets the document title and meta description per page. The app is a client-rendered
// SPA with a single static index.html, so without this every route would report the
// same generic title/description to Google and browser tabs/history.
const usePageTitle = (title, description) => {
    useEffect(() => {
        document.title = title ? `${title} | Regowned` : DEFAULT_TITLE;

        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute('name', 'description');
            document.head.appendChild(meta);
        }
        const previousContent = meta.getAttribute('content');
        meta.setAttribute('content', description || DEFAULT_DESCRIPTION);

        return () => {
            document.title = DEFAULT_TITLE;
            meta.setAttribute('content', previousContent || DEFAULT_DESCRIPTION);
        };
    }, [title, description]);
};

export default usePageTitle;
