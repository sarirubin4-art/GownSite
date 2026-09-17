using GownSite.Data;

namespace GownSite.Web.Services
{
    // Resolves a promo code and writes it onto a gown/ad that hasn't started billing yet
    // (Draft/PendingReview, no Stripe subscription) — just the PromoCodeId/MonthlyFeeOverride/
    // PromoDurationMonths columns, exactly what Create() already does at initial submission.
    // No Stripe call (nothing to update yet) and deliberately no PromoCodeRepository.IncrementUsage
    // call — usage for a promo applied at this stage is only ever counted once, at
    // AdminController.ApproveGown/ApproveAd time, keyed off whatever PromoCodeId ends up on the
    // row; incrementing here too would double-count the same redemption.
    //
    // Callers own authorization (ownership check for the owner-facing endpoints in
    // PaymentController, none for AdminController's admin-facing ones) and the Draft/PendingReview
    // status check — this helper assumes both are already satisfied.
    public static class DraftPromoApplier
    {
        public class Result
        {
            public bool Success { get; set; }
            public string Error { get; set; }
            public decimal? ResolvedFee { get; set; }
            public decimal FullFee { get; set; }
            public int? DurationMonths { get; set; }
        }

        public static Result ApplyToGown(string connectionString, decimal feeUsd, GownPosting posting, string promoCode)
        {
            if (string.IsNullOrWhiteSpace(promoCode))
                return new Result { Success = false, Error = "Enter a promo code.", FullFee = feeUsd };

            var batchSize = posting.BatchId.HasValue
                ? new GownRepository(connectionString).GetByBatchId(posting.BatchId.Value).Count
                : 1;
            var pricing = PromoCodeCalculator.ResolvePricing(connectionString, promoCode, feeUsd, posting.BatchId.HasValue, batchSize);
            if (!pricing.Success)
                return new Result { Success = false, Error = pricing.Error, FullFee = feeUsd };

            new GownRepository(connectionString).ApplyPromo(posting.Id, pricing.PromoCodeId!.Value, pricing.MonthlyFeeOverride, pricing.PromoDurationMonths);

            return new Result { Success = true, ResolvedFee = pricing.MonthlyFeeOverride, FullFee = feeUsd, DurationMonths = pricing.PromoDurationMonths };
        }

        public static Result ApplyToAd(string connectionString, decimal feeUsd, Ad ad, string promoCode)
        {
            if (string.IsNullOrWhiteSpace(promoCode))
                return new Result { Success = false, Error = "Enter a promo code.", FullFee = feeUsd };

            var promo = new PromoCodeRepository(connectionString).GetByCode(promoCode);
            var resolved = PromoCodeCalculator.Resolve(promo, feeUsd, 1, PromoAppliesTo.Ad);
            if (!resolved.Success)
                return new Result { Success = false, Error = resolved.Error, FullFee = feeUsd };

            new AdRepository(connectionString).ApplyPromo(ad.Id, promo.Id, resolved.ResolvedFee, resolved.DurationMonths);

            return new Result { Success = true, ResolvedFee = resolved.ResolvedFee, FullFee = feeUsd, DurationMonths = resolved.DurationMonths };
        }
    }
}
