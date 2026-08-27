export const COLOR_OPTIONS = [
    'Ivory/White', 'Blush', 'Champagne', 'Beige', 'Black', 'Navy', 'Burgundy',
    'Emerald', 'Sage', 'Blue', 'Silver', 'Gold', 'Pink', 'Purple', 'Floral', 'Multi', 'Other'
];

export const SIZE_OPTIONS = [
    '00', '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22', '24', '26',
    'Maternity XS', 'Maternity S', 'Maternity M', 'Maternity L', 'Maternity XL',
    'Girls 12M', 'Girls 18M', 'Girls 24M',
    'Girls 2T', 'Girls 3T', 'Girls 4T', 'Girls 4', 'Girls 5', 'Girls 6', 'Girls 6X',
    'Girls 7', 'Girls 8', 'Girls 10', 'Girls 12', 'Girls 14', 'Girls 16'
];

// Sorts a comma-separated (or array) list of sizes into the canonical SIZE_OPTIONS order,
// regardless of the order they were originally selected/stored in — so "10, 2, 6" always
// displays as "2, 6, 10". Anything not found in SIZE_OPTIONS sorts to the end, unchanged
// relative to each other, rather than disappearing.
export const sortSizes = (sizes) => {
    const list = Array.isArray(sizes) ? sizes : (sizes || '').split(',').filter(Boolean);
    return [...list].sort((a, b) => {
        const ai = SIZE_OPTIONS.indexOf(a);
        const bi = SIZE_OPTIONS.indexOf(b);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
};

export const STYLE_OPTIONS = [
    { value: 'MotherOfBrideOrGroom', label: 'Mother of the Bride/Groom' },
    { value: 'SisterOfBrideOrGroom', label: 'Sister of the Bride/Groom' },
    { value: 'Bridal', label: 'Bridal' },
    { value: 'Evening', label: 'Evening Gown' },
    { value: 'BallGown', label: 'Ball Gown' },
    { value: 'ALine', label: 'A-Line' },
    { value: 'Maternity', label: 'Maternity' },
];

export const LOCATION_PRESETS = [
    'Baltimore, MD', 'Boston, MA', 'Brooklyn, NY', 'Chicago, IL', 'Cleveland, OH',
    'Detroit, MI', 'Five Towns, NY', 'Jerusalem, IL', 'Lakewood, NJ', 'Los Angeles, CA',
    'Miami, FL', 'Monsey, NY', 'Montreal, QC', 'Passaic/Clifton, NJ', 'Philadelphia, PA',
    'Queens, NY', 'Silver Spring, MD', 'Staten Island, NY', 'Teaneck, NJ', 'Toronto, ON'
];

export const LISTING_TYPE_OPTIONS = [
    { value: 'Rent', label: 'For Rent' },
    { value: 'Sale', label: 'For Sale' },
];

export const AD_CATEGORY_OPTIONS = [
    { value: 'Makeup', label: 'Makeup Artist' },
    { value: 'Hair', label: 'Hair Stylist' },
    { value: 'Sheitels', label: 'Sheitels' },
    { value: 'Alterations', label: 'Alterations' },
    { value: 'GownRental', label: 'Gown Rental/Sales' },
    { value: 'GirlsWomensApparel', label: 'Girls/Womens Apparel' },
    { value: 'Photography', label: 'Photography' },
    { value: 'PartyPlanners', label: 'Party Planners' },
    { value: 'Gemachs', label: 'Gemachs' },
    { value: 'Other', label: 'Other' },
];

export const formatUsd = (n) => {
    const num = Number(n);
    return `$${num % 1 === 0 ? num : num.toFixed(2)}`;
};

export const formatPriceRange = (price, priceMax) =>
    priceMax ? `${formatUsd(price)} - ${formatUsd(priceMax)}` : formatUsd(price);

export const styleLabel = (value) => STYLE_OPTIONS.find(s => s.value === value)?.label || value;
export const adCategoryLabel = (value) => AD_CATEGORY_OPTIONS.find(c => c.value === value)?.label || value;
