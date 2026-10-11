import { SIZE_OPTIONS, LISTING_TYPE_OPTIONS, styleLabel, formatUsd } from '../constants/gownOptions';

// Turns free text like "blue sister of the bride dress size 2 under $200" into the same
// filters the Browse Gowns page already has (colors, sizes, styles, ...), so the shopper
// lands on a page whose filter boxes show exactly how their words were understood and can
// be adjusted from there. Whatever isn't recognized ("lace", "long sleeve") is passed on as
// keywords and matched against the gown's description server-side.
//
// Recognized phrases are blanked out of the text as they're matched, in a deliberate order:
// sizes before prices (so "size 2-4" isn't read as a price range), locations before colors
// ("Silver Spring" isn't the color silver), and longer phrases before shorter ones ("navy
// blue" before "blue", "mother of the bride" before "bride").

const WOMENS_SIZES = ['00', '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26'];
const GIRLS_SIZES = SIZE_OPTIONS.filter((s) => s.startsWith('Girls '));

// "small" means a range of numeric sizes, so it fills in every size in it — all of them
// count as exact matches.
const SIZE_WORDS = [
    [/\b(xxs|xx-small|extra extra small)\b/g, ['00', '0']],
    [/\b(xs|x-small|extra small)\b/g, ['0', '2']],
    [/\b(xxl|2xl|xx-large)\b/g, ['20', '22']],
    [/\b(xl|x-large|extra large)\b/g, ['16', '18']],
    [/\bplus[\s-]?size\b/g, ['16', '18', '20', '22', '24', '26']],
    [/\bsmall\b/g, ['4', '6']],
    [/\b(medium|med)\b/g, ['8', '10']],
    [/\blarge\b/g, ['12', '14']],
];

const MATERNITY_SIZE_WORDS = {
    xs: 'Maternity XS', 'x-small': 'Maternity XS', 'extra small': 'Maternity XS',
    s: 'Maternity S', small: 'Maternity S',
    m: 'Maternity M', medium: 'Maternity M',
    l: 'Maternity L', large: 'Maternity L',
    xl: 'Maternity XL', 'x-large': 'Maternity XL', 'extra large': 'Maternity XL',
};

const STYLE_PATTERNS = [
    ['MotherOfBrideOrGroom', [
        /\b(mother|mom|mommy|mothers)\s+of\s+(the\s+)?(bride|groom|kallah|chosson|chassan|chosen)\b/g,
        /\bmo[bg]\b/g, /\bmechuten\w*/g, /\bmother\b/g
    ]],
    ['SisterOfBrideOrGroom', [
        /\bsisters?\s+of\s+(the\s+)?(bride|groom|kallah|chosson|chassan|chosen)\b/g,
        /\bsob\b/g, /\bsisters?\b/g
    ]],
    ['BallGown', [/\bball\s*gowns?\b/g, /\bprincess\b/g]],
    ['Bridal', [/\b(wedding|bridal)\s+(dress|dresses|gown|gowns)\b/g, /\bbridal\b/g, /\bkallah\b/g, /\bbrides?\b/g]],
    ['ALine', [/\ba[\s-]?lines?\b/g]],
    ['Evening', [/\bevening\b/g, /\bformal\b/g, /\bgala\b/g]],
    ['Maternity', [/\bmaternity\b/g, /\bpregnan\w*/g, /\bexpecting\b/g]],
];

const LISTING_PATTERNS = [
    ['Rent', /\b(for\s+rent|rent|rental|rentals|renting|borrow)\b/g],
    ['Sale', /\b(for\s+sale|sale|buy|buying|purchase)\b/g],
];

// Phrase -> one of COLOR_OPTIONS. Sorted longest-first below so "navy blue" wins over "blue".
const COLOR_WORDS = {
    'off white': 'Ivory/White', 'off-white': 'Ivory/White', ivory: 'Ivory/White', white: 'Ivory/White', cream: 'Ivory/White', ecru: 'Ivory/White',
    blush: 'Blush', 'light pink': 'Blush', 'pale pink': 'Blush',
    champagne: 'Champagne',
    beige: 'Beige', nude: 'Beige', taupe: 'Beige', tan: 'Beige', camel: 'Beige', sand: 'Beige',
    black: 'Black',
    navy: 'Navy', 'navy blue': 'Navy', 'dark blue': 'Navy', 'midnight blue': 'Navy', midnight: 'Navy',
    burgundy: 'Burgundy', maroon: 'Burgundy', wine: 'Burgundy', bordeaux: 'Burgundy', oxblood: 'Burgundy', cranberry: 'Burgundy',
    emerald: 'Emerald', 'emerald green': 'Emerald', green: 'Emerald', 'hunter green': 'Emerald', 'dark green': 'Emerald', 'forest green': 'Emerald', 'bottle green': 'Emerald',
    sage: 'Sage', 'sage green': 'Sage', mint: 'Sage', 'light green': 'Sage', olive: 'Sage', seafoam: 'Sage',
    blue: 'Blue', 'royal blue': 'Blue', 'baby blue': 'Blue', 'light blue': 'Blue', 'sky blue': 'Blue', 'powder blue': 'Blue',
    'dusty blue': 'Blue', cornflower: 'Blue', periwinkle: 'Blue', cobalt: 'Blue', teal: 'Blue', turquoise: 'Blue',
    silver: 'Silver', grey: 'Silver', gray: 'Silver', charcoal: 'Silver', pewter: 'Silver',
    gold: 'Gold', golden: 'Gold', 'rose gold': 'Gold', bronze: 'Gold',
    pink: 'Pink', 'dusty rose': 'Pink', rose: 'Pink', fuchsia: 'Pink', 'hot pink': 'Pink', magenta: 'Pink', coral: 'Pink', peach: 'Pink',
    purple: 'Purple', lavender: 'Purple', lilac: 'Purple', plum: 'Purple', violet: 'Purple', eggplant: 'Purple', mauve: 'Purple',
    floral: 'Floral', flowered: 'Floral', flowery: 'Floral',
    multi: 'Multi', multicolor: 'Multi', 'multi-color': 'Multi', multicolored: 'Multi', 'multi-colored': 'Multi', colorful: 'Multi',
};
const COLOR_PHRASES = Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length);

// Neighborhood/nickname -> the city part of a location value.
const LOCATION_ALIASES = {
    '5 towns': 'five towns', 'far rockaway': 'five towns', 'boro park': 'brooklyn', 'borough park': 'brooklyn',
    flatbush: 'brooklyn', 'crown heights': 'brooklyn', williamsburg: 'brooklyn', midwood: 'brooklyn',
    passaic: 'passaic/clifton', clifton: 'passaic/clifton', 'silver spring': 'silver spring',
};

const STOPWORDS = new Set([
    'dress', 'dresses', 'gown', 'gowns', 'outfit', 'for', 'a', 'an', 'the', 'in', 'with', 'and', 'or', 'of', 'to',
    'i', 'im', "i'm", 'am', 'me', 'my', 'is', 'it', 'on', 'at', 'that', 'this', 'some', 'any', 'something',
    'looking', 'look', 'find', 'want', 'need', 'wanting', 'searching', 'search', 'please', 'near', 'around',
    'nice', 'pretty', 'beautiful', 'gorgeous', 'stunning', 'elegant', 'lovely', 'cute', 'modest',
    'event', 'events', 'occasion', 'simcha', 'simchas', 'party', 'wedding', 'weddings', 'chasuna', 'chasunah',
    'size', 'sizes', 'sz', 'color', 'colored', 'colour', 'style', 'girls', 'girl', 'kids', 'kid', 'child', 'children',
    'toddler', 'toddlers', 'youth', 'little', 'dollars', 'dollar', 'price', 'priced', 'cheap', 'ny', 'nj', 'md',
]);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const addUnique = (list, value) => { if (value && !list.includes(value)) list.push(value); };

export const parseSearchQuery = (raw, locationOptions = []) => {
    let text = ` ${(raw || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')} `;
    const result = { colors: [], sizes: [], styles: [], listingTypes: [], locations: [], minPrice: '', maxPrice: '', keywords: '' };

    // Replaces every match of `pattern` with a space, calling onMatch for each.
    const take = (pattern, onMatch) => {
        text = text.replace(pattern, (...args) => { onMatch(...args); return ' '; });
    };

    // Phrases that contain a color word but aren't about color ("black tie event",
    // "mint condition") — dropped up front so they don't turn into color filters.
    take(/\b(black|white)[\s-]tie\b/g, () => {});
    take(/\b(mint|new|like new|perfect|excellent|good)\s+condition\b/g, () => {});

    // --- Sizes ---
    const womensSize = (n) => (WOMENS_SIZES.includes(n) ? n : null);
    const girlsSize = (n) => GIRLS_SIZES.find((s) => s.toLowerCase() === `girls ${n}`) || null;
    // Adds one size, a pair ("2/4", "2 or 4"), or a whole range ("2-6") using `toSize`
    // to say which ladder the numbers belong to.
    const addSizes = (toSize, a, op, b) => {
        const from = toSize(a.toLowerCase());
        const to = b ? toSize(b.toLowerCase()) : null;
        if (from && to && ['-', '–', 'to', 'through'].includes(op)) {
            const ladder = from.startsWith('Girls ') ? GIRLS_SIZES : WOMENS_SIZES;
            const [i, j] = [ladder.indexOf(from), ladder.indexOf(to)].sort((x, y) => x - y);
            if (i >= 0 && j >= 0) ladder.slice(i, j + 1).forEach((s) => addUnique(result.sizes, s));
            return;
        }
        addUnique(result.sizes, from);
        addUnique(result.sizes, to);
    };
    const NUM = String.raw`(00|\d{1,2}x?)`;
    const PAIR = String.raw`(?:\s*(-|–|to|through|\/|,|or|and|&)\s*${NUM})?`;
    const GIRLS_WORD = String.raw`(?:flower girls?|little girls?|girls?|kids?|child|children|toddlers?|youth)(?:'s)?`;

    take(/\bmaternity\s+(x-small|extra small|x-large|extra large|xs|xl|small|medium|large|s|m|l)\b/g, (m, word) => {
        addUnique(result.sizes, MATERNITY_SIZE_WORDS[word]);
    });
    take(/\b(2|3|4)\s?t\b/g, (m, n) => addUnique(result.sizes, `Girls ${n}T`));
    take(/\b(12|18|24)\s?(m|mo|mos|month|months)\b/g, (m, n) => addUnique(result.sizes, `Girls ${n}M`));

    // "girls" only makes the size right next to it a girls' size — "mother of the bride
    // size 12 and girls 6" keeps the 12 a women's 12. Up to three words may sit in between
    // ("girls pink dress size 8"); those are put back so they still get read as colors etc.
    text = text.replace(
        new RegExp(String.raw`\b${GIRLS_WORD}((?:\s+(?!size\b|sizes\b|sz\b)[a-z]+){0,3}?)\s+(?:(?:size|sizes|sz)\.?\s*)?${NUM}${PAIR}(?![\w$])`, 'g'),
        (m, between, a, op, b) => { addSizes(girlsSize, a, op, b); return ` ${between} `; });
    take(new RegExp(String.raw`\b(?:size|sizes|sz)\.?\s*${NUM}${PAIR}\s+${GIRLS_WORD}\b`, 'g'),
        (m, a, op, b) => addSizes(girlsSize, a, op, b));
    let girlsMentioned = false;
    take(new RegExp(String.raw`\b${GIRLS_WORD}\b`, 'g'), () => { girlsMentioned = true; });

    take(new RegExp(String.raw`\b(?:size|sizes|sz)\.?\s*${NUM}${PAIR}\b`, 'g'), (m, a, op, b) => addSizes(womensSize, a, op, b));
    SIZE_WORDS.forEach(([pattern, sizes]) => take(pattern, () => sizes.forEach((s) => addUnique(result.sizes, s))));

    // --- Prices (cents allowed, so "$150.00" doesn't leave a stray "00" behind) ---
    const PRICE = String.raw`(\d+(?:\.\d{1,2})?)`;
    take(new RegExp(String.raw`\$\s?${PRICE}\s*(?:-|–|to|and)\s*\$?\s?${PRICE}|\bbetween\s+\$?\s?${PRICE}\s*(?:-|–|to|and)\s*\$?\s?${PRICE}`, 'g'), (m, a, b, c, d) => {
        const lo = Number(a ?? c), hi = Number(b ?? d);
        result.minPrice = String(Math.min(lo, hi));
        result.maxPrice = String(Math.max(lo, hi));
    });
    take(new RegExp(String.raw`\b(?:under|below|less than|up to|max|maximum|no more than|cheaper than|within)\s+\$?\s?${PRICE}(?:\s*dollars?)?`, 'g'), (m, n) => { result.maxPrice = String(Number(n)); });
    take(new RegExp(String.raw`\b(?:over|above|more than|at least|min|minimum)\s+\$?\s?${PRICE}(?:\s*dollars?)?`, 'g'), (m, n) => { result.minPrice = String(Number(n)); });
    take(new RegExp(String.raw`\$\s?${PRICE}|\b${PRICE}\s*dollars?\b`, 'g'), (m, a, b) => { result.maxPrice = String(Number(a ?? b)); });

    // Any remaining bare number that's a real size ("blue 6") — done after prices so
    // "under 200" was already consumed.
    take(/(?<![\w$.])(00|\d{1,2})(?![\w$.])/g, (m, n) => addUnique(result.sizes, womensSize(n)));

    // --- Styles & Rent/Sale ---
    STYLE_PATTERNS.forEach(([style, patterns]) => patterns.forEach((p) => take(p, () => addUnique(result.styles, style))));
    LISTING_PATTERNS.forEach(([type, pattern]) => take(pattern, () => addUnique(result.listingTypes, type)));

    // --- Locations (before colors: "Silver Spring") ---
    const locationPhrases = [];
    locationOptions.forEach((loc) => {
        const city = loc.split(',')[0].trim().toLowerCase();
        locationPhrases.push([loc.toLowerCase(), loc], [city, loc]);
        if (city.includes('/')) city.split('/').forEach((part) => locationPhrases.push([part.trim(), loc]));
    });
    Object.entries(LOCATION_ALIASES).forEach(([alias, city]) => {
        const loc = locationOptions.find((l) => l.split(',')[0].trim().toLowerCase() === city);
        if (loc) locationPhrases.push([alias, loc]);
    });
    locationPhrases
        .filter(([phrase]) => phrase.length > 2)
        .sort((a, b) => b[0].length - a[0].length)
        .forEach(([phrase, loc]) => take(new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'g'), () => addUnique(result.locations, loc)));

    // --- Colors ---
    COLOR_PHRASES.forEach((phrase) =>
        take(new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'g'), () => addUnique(result.colors, COLOR_WORDS[phrase])));

    // "girls dress" with no size given means any girls' size.
    if (girlsMentioned && !result.sizes.some((s) => s.startsWith('Girls '))) {
        GIRLS_SIZES.forEach((s) => addUnique(result.sizes, s));
    }

    result.keywords = text
        .replace(/[^\w\s'-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
        .filter((w) => w.length > 1 && !STOPWORDS.has(w))
        .join(' ');

    return result;
};

// Same URL format SearchGowns reads its filters from (see filtersFromParams there).
export const parsedToSearchParams = (p, text) => {
    const params = new URLSearchParams();
    ['colors', 'sizes', 'locations', 'styles', 'listingTypes'].forEach((field) =>
        p[field].forEach((v) => params.append(field, v)));
    if (p.minPrice !== '') params.set('minPrice', p.minPrice);
    if (p.maxPrice !== '') params.set('maxPrice', p.maxPrice);
    if (p.keywords) params.set('keywords', p.keywords);
    if (text) params.set('text', text);
    return params;
};

// Short human-readable pieces for the "Searching for: ..." line under the search bar.
export const describeParsed = (p) => {
    const parts = [];
    parts.push(...p.colors);
    if (p.sizes.length > 0) {
        const girls = p.sizes.filter((s) => s.startsWith('Girls '));
        const rest = p.sizes.filter((s) => !s.startsWith('Girls '));
        if (rest.length > 0) parts.push(`Size ${rest.join(', ')}`);
        if (girls.length === GIRLS_SIZES.length) parts.push("Girls' sizes");
        else if (girls.length > 0) parts.push(`Girls ${girls.map((s) => s.replace('Girls ', '')).join(', ')}`);
    }
    parts.push(...p.styles.map(styleLabel));
    parts.push(...p.listingTypes.map((t) => LISTING_TYPE_OPTIONS.find((o) => o.value === t)?.label || t));
    parts.push(...p.locations);
    if (p.minPrice !== '' && p.maxPrice !== '') parts.push(`${formatUsd(p.minPrice)}–${formatUsd(p.maxPrice)}`);
    else if (p.maxPrice !== '') parts.push(`Under ${formatUsd(p.maxPrice)}`);
    else if (p.minPrice !== '') parts.push(`Over ${formatUsd(p.minPrice)}`);
    if (p.keywords) parts.push(`“${p.keywords}”`);
    return parts;
};
