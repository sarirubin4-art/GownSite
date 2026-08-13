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
        Gemachs
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
        public AdCategory Category { get; set; }
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
}
