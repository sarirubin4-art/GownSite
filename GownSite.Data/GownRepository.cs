using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public class GownSearchFilters
    {
        public List<string> Colors { get; set; } = new();
        public List<string> Sizes { get; set; } = new();
        public List<string> Locations { get; set; } = new();
        public List<string> Styles { get; set; } = new();
        public List<ListingType> ListingTypes { get; set; } = new();
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 24;
    }

    public class GownSearchResult
    {
        public List<GownPosting> Items { get; set; }
        public int TotalCount { get; set; }
    }

    public class GownRepository
    {
        private readonly string _connectionString;
        public GownRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public GownSearchResult Search(GownSearchFilters filters)
        {
            using var context = new GownDataContext(_connectionString);
            var query = context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Where(g => g.IsActive)
                .AsQueryable();

            if (filters.Locations.Count > 0)
                query = query.Where(g => filters.Locations.Contains(g.Location));
            if (filters.ListingTypes.Count > 0)
                query = query.Where(g => filters.ListingTypes.Contains(g.ListingType));
            // A range-priced gown (PriceMax set) matches a price filter if the two ranges
            // overlap at all, not just if its low end falls inside the filter window.
            if (filters.MinPrice.HasValue)
                query = query.Where(g => (g.PriceMax ?? g.Price) >= filters.MinPrice.Value);
            if (filters.MaxPrice.HasValue)
                query = query.Where(g => g.Price <= filters.MaxPrice.Value);

            var results = query.OrderByDescending(g => g.CreatedDate).ToList();

            if (filters.Colors.Count > 0)
            {
                results = results.Where(g =>
                    !string.IsNullOrEmpty(g.Color) &&
                    g.Color.Split(',').Any(c => filters.Colors.Contains(c))
                ).ToList();
            }

            if (filters.Styles.Count > 0)
            {
                results = results.Where(g =>
                    !string.IsNullOrEmpty(g.StyleTags) &&
                    g.StyleTags.Split(',').Any(t => filters.Styles.Contains(t))
                ).ToList();
            }

            if (filters.Sizes.Count > 0)
            {
                results = results.Where(g =>
                    !string.IsNullOrEmpty(g.Size) &&
                    g.Size.Split(',').Any(s => filters.Sizes.Contains(s))
                ).ToList();
            }

            var page = filters.Page < 1 ? 1 : filters.Page;
            var pageSize = filters.PageSize < 1 ? 24 : filters.PageSize;
            return new GownSearchResult
            {
                Items = results.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
                TotalCount = results.Count
            };
        }

        public List<string> GetDistinctLocations()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Where(g => g.ModerationStatus != ModerationStatus.Rejected && g.ModerationStatus != ModerationStatus.Removed)
                .Select(g => g.Location)
                .Where(l => !string.IsNullOrEmpty(l))
                .Distinct()
                .OrderBy(l => l)
                .ToList();
        }

        public GownPosting Get(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .FirstOrDefault(g => g.Id == id);
        }

        public List<GownPosting> GetByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.MorePictures)
                .Where(g => g.OwnerId == ownerId)
                .OrderByDescending(g => g.CreatedDate)
                .ToList();
        }

        public int CountActiveByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns.Count(g => g.OwnerId == ownerId && g.IsActive);
        }

        public int Create(GownPosting posting)
        {
            using var context = new GownDataContext(_connectionString);
            posting.CreatedDate = DateTime.UtcNow;
            posting.IsActive = false;
            posting.InquiryCount = 0;
            posting.ModerationStatus = ModerationStatus.Draft;
            context.Gowns.Add(posting);
            context.SaveChanges();
            return posting.Id;
        }

        public void Update(GownPosting posting)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == posting.Id);
            if (existing == null) return;

            existing.Description = posting.Description;
            existing.Color = posting.Color;
            existing.Size = posting.Size;
            existing.Price = posting.Price;
            existing.PriceMax = posting.PriceMax;
            existing.Location = posting.Location;
            existing.ListingType = posting.ListingType;
            existing.DisplayOwnerName = posting.DisplayOwnerName;
            existing.Brand = posting.Brand;
            existing.PricePaid = posting.PricePaid;
            existing.Condition = posting.Condition;
            existing.Length = posting.Length;
            existing.StyleTags = posting.StyleTags;
            existing.Notes = posting.Notes;
            context.SaveChanges();
        }

        public void SetPrimaryPicture(int id, string url)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.PrimaryPictureUrl = url;
            context.SaveChanges();
        }

        public void ActivateListing(int id, string stripeSubscriptionId, string stripeCustomerId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsActive = true;
            existing.StripeSubscriptionId = stripeSubscriptionId;
            existing.StripeCustomerId = stripeCustomerId;
            existing.ModerationStatus = ModerationStatus.Approved;
            context.SaveChanges();
        }

        public void SubmitForReview(int id, string stripeCustomerId, string stripePaymentMethodId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.StripeCustomerId = stripeCustomerId;
            existing.StripePaymentMethodId = stripePaymentMethodId;
            existing.ModerationStatus = ModerationStatus.PendingReview;
            context.SaveChanges();
        }

        public void ApplyPromo(int id, int promoCodeId, decimal? monthlyFeeOverride, int? promoDurationMonths)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.PromoCodeId = promoCodeId;
            existing.MonthlyFeeOverride = monthlyFeeOverride;
            existing.PromoDurationMonths = promoDurationMonths;
            context.SaveChanges();
        }

        public List<GownPosting> GetActive()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Where(g => g.IsActive)
                .OrderByDescending(g => g.CreatedDate)
                .ToList();
        }

        public void TakeDown(int id, string reason)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsActive = false;
            existing.ModerationStatus = ModerationStatus.Removed;
            existing.RejectionReason = reason;
            context.SaveChanges();
        }

        public List<GownPosting> GetPendingReview()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Where(g => g.ModerationStatus == ModerationStatus.PendingReview)
                .OrderBy(g => g.CreatedDate)
                .ToList();
        }

        public void ApproveListing(int id, string stripeSubscriptionId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.Approved;
            existing.IsActive = true;
            existing.StripeSubscriptionId = stripeSubscriptionId;
            context.SaveChanges();
        }

        public void RejectListing(int id, string reason)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.Rejected;
            existing.RejectionReason = reason;
            context.SaveChanges();
        }

        // Lets an owner send a Rejected listing back into the review queue after fixing
        // whatever the admin flagged, instead of deleting it and drafting a new one from
        // scratch. Reuses the Stripe customer/payment method already on file from the
        // listing's original card-setup step, so no new payment info is needed.
        public void ResubmitListing(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.PendingReview;
            existing.RejectionReason = null;
            context.SaveChanges();
        }

        public void CancelListing(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsActive = false;
            context.SaveChanges();
        }

        public void MarkSold(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsSold = true;
            context.SaveChanges();
        }

        public void IncrementInquiry(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.InquiryCount++;
            context.SaveChanges();
        }

        public List<GownPosting> GetConciergeQueue()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Where(g => g.NeedsConciergeDraft)
                .OrderBy(g => g.CreatedDate)
                .ToList();
        }

        public void MarkConciergeReady(int id, decimal oneTimeFeeUsd)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.NeedsConciergeDraft = false;
            existing.OneTimeFeeUsd = oneTimeFeeUsd;
            context.SaveChanges();
        }

        public List<GownPosting> GetByBatchId(Guid batchId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Where(g => g.BatchId == batchId)
                .ToList();
        }

        public void AddPictures(int gownPostingId, List<string> urls)
        {
            using var context = new GownDataContext(_connectionString);
            int order = 0;
            foreach (var url in urls)
            {
                context.GownPictures.Add(new GownPicture
                {
                    GownPostingId = gownPostingId,
                    Url = url,
                    SortOrder = order++
                });
            }
            context.SaveChanges();
        }

        public void RemovePictures(int gownPostingId, List<int> pictureIds)
        {
            if (pictureIds == null || pictureIds.Count == 0) return;
            using var context = new GownDataContext(_connectionString);
            var toRemove = context.GownPictures
                .Where(p => p.GownPostingId == gownPostingId && pictureIds.Contains(p.Id))
                .ToList();
            context.GownPictures.RemoveRange(toRemove);
            context.SaveChanges();
        }
    }
}
