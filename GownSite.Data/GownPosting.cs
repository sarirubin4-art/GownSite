using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace GownSite.Data
{
    public class Owner
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Number { get; set; }
        public string Email { get; set; }
        [JsonIgnore]
        public string PasswordHash { get; set; }
        public bool IsAdmin { get; set; }
        public bool EmailVerified { get; set; }
        [JsonIgnore]
        public string EmailVerificationToken { get; set; }
        [JsonIgnore]
        public string PasswordResetToken { get; set; }
        [JsonIgnore]
        public DateTime? PasswordResetTokenExpiresAt { get; set; }

        // Admin-assigned flat-rate plan for high-volume posters, replacing per-gown
        // billing entirely for this owner. BusinessStripeSubscriptionId is only set once
        // the owner has actually completed the one-time card-setup step for the plan.
        public bool IsBusinessAccount { get; set; }
        public decimal? BusinessMonthlyFeeUsd { get; set; }
        public int? BusinessGownAllowance { get; set; }
        // Reference only for the admin's own bookkeeping — not enforced anywhere in code.
        public decimal? BusinessOverageFeePerGownUsd { get; set; }
        public string BusinessStripeCustomerId { get; set; }
        public string BusinessStripePaymentMethodId { get; set; }
        public string BusinessStripeSubscriptionId { get; set; }
    }

    public enum ListingType
    {
        Rent,
        Sale
    }

    public enum ModerationStatus
    {
        Draft,
        PendingReview,
        Approved,
        Rejected,
        // Appended after Rejected (not inserted before it) so existing stored
        // ModerationStatus values in the database keep their original int meaning.
        Removed
    }

    public class GownPosting
    {
        public int Id { get; set; }

        // required
        public int OwnerId { get; set; }
        public Owner Owner { get; set; }
        public string Description { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal Price { get; set; }
        // Set only when the owner hasn't settled on an exact price yet — Price is then
        // the low end of the range and PriceMax the high end, e.g. "$100 - $150".
        public decimal? PriceMax { get; set; }
        public string Location { get; set; }
        public string PrimaryPictureUrl { get; set; }
        public ListingType ListingType { get; set; }

        // system-managed
        public int InquiryCount { get; set; }
        public DateTime CreatedDate { get; set; }
        public bool IsActive { get; set; }
        public bool IsSold { get; set; }
        public bool DisplayOwnerName { get; set; }
        public string StripeSubscriptionId { get; set; }
        public string StripeCustomerId { get; set; }
        public ModerationStatus ModerationStatus { get; set; }
        public string RejectionReason { get; set; }
        public string StripePaymentMethodId { get; set; }
        public int? PromoCodeId { get; set; }
        public decimal? MonthlyFeeOverride { get; set; }
        public int? PromoDurationMonths { get; set; }
        public Guid? BatchId { get; set; }

        // Concierge posting service (see AdminController's concierge/* endpoints and
        // GownController.ConciergeIntake): NeedsConciergeDraft marks a gown a customer
        // submitted with only the bare minimum, awaiting admin to flesh it out.
        // OneTimeFeeUsd is the concierge/on-site-visit fee charged once at approval time,
        // alongside (not instead of) the normal recurring listing fee.
        public bool NeedsConciergeDraft { get; set; }
        public decimal? OneTimeFeeUsd { get; set; }

        public List<GownPicture> MorePictures { get; set; } = new();

        // optional
        public string Brand { get; set; }
        public decimal? PricePaid { get; set; }
        public string Condition { get; set; }
        public string Length { get; set; }
        public string StyleTags { get; set; }
        public string Notes { get; set; }
    }

    public class GownPicture
    {
        public int Id { get; set; }
        public int GownPostingId { get; set; }
        [JsonIgnore]
        public GownPosting GownPosting { get; set; }
        public string Url { get; set; }
        public int SortOrder { get; set; }
    }

    public enum AdCategory
    {
        Makeup,
        Hair,
        Alterations,
        GownRental,
        Other,
        // Appended after Other (not inserted before it) so existing stored Category
        // values in the database keep their original int meaning.
        Photography,
        PartyPlanners,
        Gemachs,
        GirlsWomensApparel,
        Sheitels,
        Bridal
    }

    public static class AdCategoryHelper
    {
        // Parses a comma-separated list of AdCategory names (the wire format for
        // Ad.Categories — see that property's comment), validates and de-duplicates it,
        // and hands back the normalized comma-joined string ready to store — every
        // caller just did `string.Join(",", categories)` on the result anyway, so this
        // saves repeating that at each of the six call sites.
        //
        // All-or-nothing: `normalized` is only ever set on success (built in a local
        // scratch list, not written incrementally to the out param), so a caller that
        // forgets to check the return value — as AdController.SaveDraft deliberately
        // does, since drafts have no required fields — gets an empty result on a bad
        // list rather than a silently truncated prefix of it.
        public static bool TryNormalize(string raw, out string normalized)
        {
            normalized = "";
            var tokens = (raw ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (tokens.Length == 0) return false;

            var categories = new List<AdCategory>();
            foreach (var token in tokens)
            {
                if (!Enum.TryParse<AdCategory>(token, out var parsed)) return false;
                if (!categories.Contains(parsed)) categories.Add(parsed);
            }
            normalized = string.Join(",", categories);
            return true;
        }
    }

    public class Ad
    {
        public int Id { get; set; }
        public int? OwnerId { get; set; }
        public Owner Owner { get; set; }
        public string Title { get; set; }
        public string ImageUrl { get; set; }
        public string TargetUrl { get; set; }
        public string Description { get; set; }
        public string Location { get; set; }
        // Marks a business that isn't tied to any one place (e.g. an online-only shop) so
        // it should surface under every location filter instead of needing a real Location
        // value — kept as its own flag rather than a sentinel Location string so filtering
        // logic can just OR it in without special-casing a magic value.
        public bool ServesAllLocations { get; set; }
        // Comma-separated AdCategory names (e.g. "Makeup,Hair") — same convention as
        // GownPosting.Color/Size/StyleTags. An ad can belong to more than one category
        // and surfaces under every one it's tagged with, while staying a single record.
        public string Categories { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedDate { get; set; }
        public string StripeSubscriptionId { get; set; }
        public string StripeCustomerId { get; set; }
        public ModerationStatus ModerationStatus { get; set; }
        public string RejectionReason { get; set; }
        public string StripePaymentMethodId { get; set; }
        public int? PromoCodeId { get; set; }
        public decimal? MonthlyFeeOverride { get; set; }
        public int? PromoDurationMonths { get; set; }
    }

    public enum DiscountType
    {
        PercentOff,
        FixedAmountOff,
        FixedPrice,
        // Per-gown price scales down based on how many gowns are in the batch this
        // code is applied to — see PromoCodeCalculator.VolumeTiers for the tier table.
        VolumeTiered
    }

    // Both = 0 so every promo code created before this feature existed (and any new one
    // whose AppliesTo isn't explicitly set) keeps applying everywhere, matching the old
    // unscoped behavior exactly. Business is its own value (not folded into Gown) because
    // the business flat-monthly-fee subscription is a distinct billable product from a
    // per-gown listing fee — a promo scoped to one should not silently redeem against the
    // other. "Both" only ever means "gowns and ads", never "including business".
    public enum PromoAppliesTo
    {
        Both,
        Gown,
        Ad,
        Business
    }

    public class PromoCode
    {
        public int Id { get; set; }
        public string Code { get; set; }
        public DiscountType DiscountType { get; set; }
        public decimal DiscountValue { get; set; }
        public bool IsActive { get; set; }
        public int? MaxUses { get; set; }
        public int TimesUsed { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? ExpiresAt { get; set; }
        // How many billing cycles the discount applies before reverting to the full price.
        // Null = applies for the life of the subscription (today's behavior, unchanged).
        public int? DurationMonths { get; set; }
        public PromoAppliesTo AppliesTo { get; set; }
    }

    public class SearchAlert
    {
        public int Id { get; set; }
        public string Email { get; set; }
        public string Colors { get; set; }
        public string Sizes { get; set; }
        public string Locations { get; set; }
        public string Styles { get; set; }
        public string ListingTypes { get; set; }
        public DateTime CreatedDate { get; set; }
        public bool IsActive { get; set; }
        public string UnsubscribeToken { get; set; }
    }

    // A patron-initiated message (bulk-discount inquiry, gemach free-ad request, or the
    // general "Contact Us" entry point) that lands in the admin's in-app inbox instead of
    // an email, so receiving it costs nothing. Reply is one-way and single-send, so it's
    // stored as flat fields here rather than a separate thread table.
    public class ContactMessage
    {
        public int Id { get; set; }
        public int OwnerId { get; set; }
        public Owner Owner { get; set; }
        public string Topic { get; set; }
        public string Message { get; set; }
        public DateTime CreatedDate { get; set; }
        public bool IsResolved { get; set; }
        public DateTime? ResolvedDate { get; set; }
        public string ReplyMessage { get; set; }
        public DateTime? RepliedDate { get; set; }
    }
}
