using System.Linq;
using GownSite.Data;

namespace GownSite.Web.Services
{
    public class PromoResolveResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
        public decimal? ResolvedFee { get; set; }
        // Null = ResolvedFee applies for the life of the subscription (unchanged legacy
        // behavior). Set = ResolvedFee only applies for this many billing cycles, after
        // which billing reverts to the full base fee.
        public int? DurationMonths { get; set; }
    }

    public static class PromoCodeCalculator
    {
        // Per-gown price at each batch-size breakpoint (uniform per-gown price applies to
        // every gown in the batch, not just the ones past the threshold). Checked in
        // descending order so a batch of 12 gowns matches the "10+" row, not "5+".
        public static readonly (int MinQuantity, decimal PricePerGown)[] VolumeTiers =
        {
            (15, 3.00m),
            (10, 3.50m),
            (5, 4.00m),
            (1, 5.00m)
        };

        public static PromoResolveResult Resolve(PromoCode promo, decimal baseFee, int quantity = 1)
        {
            if (promo == null)
                return new PromoResolveResult { Success = false, Error = "That promo code doesn't exist." };
            if (!promo.IsActive)
                return new PromoResolveResult { Success = false, Error = "That promo code is no longer active." };
            if (promo.ExpiresAt.HasValue && promo.ExpiresAt.Value < DateTime.UtcNow)
                return new PromoResolveResult { Success = false, Error = "That promo code has expired." };
            if (promo.MaxUses.HasValue && promo.TimesUsed >= promo.MaxUses.Value)
                return new PromoResolveResult { Success = false, Error = "That promo code has reached its usage limit." };

            var fee = promo.DiscountType switch
            {
                DiscountType.PercentOff => baseFee * (1 - promo.DiscountValue / 100m),
                DiscountType.FixedAmountOff => baseFee - promo.DiscountValue,
                DiscountType.FixedPrice => promo.DiscountValue,
                DiscountType.VolumeTiered => VolumeTiers.First(t => quantity >= t.MinQuantity).PricePerGown,
                _ => baseFee
            };
            if (fee < 0) fee = 0;

            return new PromoResolveResult { Success = true, ResolvedFee = fee, DurationMonths = promo.DurationMonths };
        }
    }
}
