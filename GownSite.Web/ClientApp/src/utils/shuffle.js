// Fisher-Yates — returns a new shuffled array, leaves the input untouched.
export function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Ads posted in the last week lead the list, most-recently-posted first, so a
// brand-new ad is guaranteed visibility right away. Everything older than a
// week is shuffled and shown after that group, so long-standing advertisers
// rotate through top placement evenly instead of freezing into a fixed order.
export function orderAdsForDisplay(ads) {
    const cutoff = Date.now() - WEEK_MS;
    const recent = [];
    const older = [];
    for (const ad of ads) {
        if (new Date(ad.createdDate).getTime() >= cutoff) recent.push(ad);
        else older.push(ad);
    }
    recent.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    return [...recent, ...shuffle(older)];
}
