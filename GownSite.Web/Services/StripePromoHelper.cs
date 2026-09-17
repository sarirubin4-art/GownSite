using Stripe;

namespace GownSite.Web.Services
{
    public static class StripePromoHelper
    {
        // Attaches a discount to an ALREADY-RUNNING subscription. Unlike CreatePromoAwareSubscriptionAsync
        // (used at initial approval, which can use a Stripe trial for a 100%-off period), a trial can only be
        // set when a subscription is first created — so here we always use a Coupon, with "forever" duration
        // for a lifetime discount or "repeating" for a limited number of months. Passing a single-item
        // Discounts list REPLACES any discount already on the subscription rather than stacking with it, and
        // Stripe applies the change starting with the next invoice — the current billing period is untouched.
        public static async Task ApplyPromoToSubscriptionAsync(string subscriptionId, decimal fullFeeUsd, decimal resolvedFee, int? durationMonths)
        {
            var percentOff = Math.Max(0m, (1 - (resolvedFee / fullFeeUsd)) * 100m);
            if (percentOff <= 0)
            {
                await new SubscriptionService().UpdateAsync(subscriptionId, new SubscriptionUpdateOptions
                {
                    Discounts = new List<SubscriptionDiscountOptions>()
                });
                return;
            }

            var hasDuration = durationMonths.HasValue && durationMonths.Value > 0;
            var couponOptions = new CouponCreateOptions
            {
                PercentOff = percentOff,
                Duration = hasDuration ? "repeating" : "forever"
            };
            if (hasDuration) couponOptions.DurationInMonths = durationMonths!.Value;

            var coupon = await new CouponService().CreateAsync(couponOptions);
            await new SubscriptionService().UpdateAsync(subscriptionId, new SubscriptionUpdateOptions
            {
                Discounts = new List<SubscriptionDiscountOptions> { new() { Coupon = coupon.Id } }
            });
        }
    }
}
