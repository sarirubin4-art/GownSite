// Mirrors the AdBillingPlan enum (GownSite.Data) and AdPlans (GownSite.Web) — prices
// themselves come from /api/payment/pricing.
export const AD_PLANS = [
    { value: 'Monthly', label: 'Monthly', months: 1, pitch: 'No commitment', priceKey: 'adMonthlyFee' },
    { value: 'SixMonth', label: '6-Month', months: 6, pitch: 'Try us for half a year', priceKey: 'adSixMonthFee' },
    { value: 'Yearly', label: 'Yearly', months: 12, pitch: 'Pay for 10 months, get 12', priceKey: 'adYearlyFee' }
];

export const adPlan = (value) => AD_PLANS.find((p) => p.value === value) || AD_PLANS[0];

export const isPrepaidPlan = (value) => adPlan(value).months > 1;

// `months` after `start`, landing on the last day of the month when the start day doesn't
// exist there (Aug 31 + 6 months = Feb 28), the way Stripe anchors billing periods.
const addMonthsClamped = (start, months) => {
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(start.getUTCDate(), lastDay),
        start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
};

// Stripe renews from the date billing started, every `months` months — so the next
// renewal is the first anniversary of planStartedAt that's still in the future.
export const nextRenewalDate = (planStartedAt, value) => {
    if (!planStartedAt) return null;
    const { months } = adPlan(value);
    const start = new Date(planStartedAt.endsWith('Z') ? planStartedAt : `${planStartedAt}Z`);
    const now = new Date();
    let next;
    let periods = 1;
    do {
        next = addMonthsClamped(start, months * periods);
        periods++;
    } while (next <= now);
    return next;
};

export const formatPlanDate = (date) =>
    (date ? new Date(typeof date === 'string' && !date.endsWith('Z') ? `${date}Z` : date) : null)
        ?.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
