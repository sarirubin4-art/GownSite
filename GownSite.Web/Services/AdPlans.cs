using GownSite.Data;

namespace GownSite.Web.Services
{
    // Prices and Stripe billing periods for each AdBillingPlan. Prices live in config next
    // to the monthly fee so they can change without a code change.
    public static class AdPlans
    {
        public static decimal Fee(IConfiguration configuration, AdBillingPlan plan) => plan switch
        {
            AdBillingPlan.SixMonth => configuration.GetValue<decimal>("Stripe:SixMonthAdFeeUsd", 79m),
            AdBillingPlan.Yearly => configuration.GetValue<decimal>("Stripe:YearlyAdFeeUsd", 149m),
            _ => configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m)
        };

        // Stripe expresses "every 6 months" as interval=month, interval_count=6.
        public static (string Interval, long IntervalCount) Recurrence(AdBillingPlan plan) => plan switch
        {
            AdBillingPlan.SixMonth => ("month", 6),
            AdBillingPlan.Yearly => ("year", 1),
            _ => ("month", 1)
        };

        public static string ProductName(AdBillingPlan plan) => plan switch
        {
            AdBillingPlan.SixMonth => "Regowned 6-Month Ad Placement",
            AdBillingPlan.Yearly => "Regowned Yearly Ad Placement",
            _ => "Regowned Monthly Ad Placement"
        };

        public static bool IsPrepaid(AdBillingPlan plan) => plan != AdBillingPlan.Monthly;

        public const string PromoMonthlyOnlyMessage = "Promo codes only apply to the monthly plan — the 6-month and yearly plans are already discounted.";
    }
}
