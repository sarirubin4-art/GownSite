import axios from 'axios';

// Every location that has gowns, fetched once per page load and shared by the Browse
// Gowns Location filter and the search bar's text parser. A failed fetch isn't cached,
// so the next caller tries again.
let locationsPromise = null;

export const loadLocations = () => {
    if (!locationsPromise) {
        locationsPromise = axios.get('/api/gown/locations')
            .then(({ data }) => data)
            .catch(() => {
                locationsPromise = null;
                return [];
            });
    }
    return locationsPromise;
};
