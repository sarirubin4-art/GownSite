using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public class AdRepository
    {
        private readonly string _connectionString;
        public AdRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public void ApplyPromo(int id, int promoCodeId, decimal? monthlyFeeOverride, int? promoDurationMonths)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.PromoCodeId = promoCodeId;
            existing.MonthlyFeeOverride = monthlyFeeOverride;
            existing.PromoDurationMonths = promoDurationMonths;
            context.SaveChanges();
        }

        public List<Ad> GetActive()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.CreatedDate)
                .ToList();
        }

        public List<Ad> GetActiveForAdmin()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Include(a => a.Owner)
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.CreatedDate)
                .ToList();
        }

        public void TakeDown(int id, string reason)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.IsActive = false;
            existing.ModerationStatus = ModerationStatus.Removed;
            existing.RejectionReason = reason;
            context.SaveChanges();
        }

        public Ad Get(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads.FirstOrDefault(a => a.Id == id);
        }

        public List<Ad> GetByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Where(a => a.OwnerId == ownerId)
                .OrderByDescending(a => a.CreatedDate)
                .ToList();
        }

        public int Create(Ad ad)
        {
            using var context = new GownDataContext(_connectionString);
            ad.CreatedDate = DateTime.UtcNow;
            ad.IsActive = false;
            ad.ModerationStatus = ModerationStatus.Draft;
            context.Ads.Add(ad);
            context.SaveChanges();
            return ad.Id;
        }

        public void Update(Ad ad)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == ad.Id);
            if (existing == null) return;

            existing.Title = ad.Title;
            existing.Description = ad.Description;
            existing.TargetUrl = ad.TargetUrl;
            existing.Category = ad.Category;
            context.SaveChanges();
        }

        public void Activate(int id, string stripeSubscriptionId, string stripeCustomerId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
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
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.StripeCustomerId = stripeCustomerId;
            existing.StripePaymentMethodId = stripePaymentMethodId;
            existing.ModerationStatus = ModerationStatus.PendingReview;
            context.SaveChanges();
        }

        public List<Ad> GetPendingReview()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Include(a => a.Owner)
                .Where(a => a.ModerationStatus == ModerationStatus.PendingReview)
                .OrderBy(a => a.CreatedDate)
                .ToList();
        }

        public void ApproveAd(int id, string stripeSubscriptionId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.Approved;
            existing.IsActive = true;
            existing.StripeSubscriptionId = stripeSubscriptionId;
            context.SaveChanges();
        }

        public void RejectAd(int id, string reason)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.Rejected;
            existing.RejectionReason = reason;
            context.SaveChanges();
        }

        public void Cancel(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.IsActive = false;
            context.SaveChanges();
        }
    }
}
