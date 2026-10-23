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

        // Returns whether this call actually changed the row's PromoCodeId (vs. re-applying the
        // code already on it) — callers use this to decide whether to count a redemption. The
        // PromoCodeId change is detected and written in one atomic conditional UPDATE (not a
        // SELECT followed by a separate write), so two concurrent calls for the same row can't
        // both see "not yet applied" and both report a new application.
        public bool ApplyPromo(int id, int promoCodeId, decimal? monthlyFeeOverride, int? promoDurationMonths)
        {
            using var context = new GownDataContext(_connectionString);
            var isNewApplication = context.Ads
                .Where(a => a.Id == id && a.PromoCodeId != promoCodeId)
                .ExecuteUpdate(s => s.SetProperty(a => a.PromoCodeId, promoCodeId)) > 0;

            context.Ads.Where(a => a.Id == id)
                .ExecuteUpdate(s => s
                    .SetProperty(a => a.MonthlyFeeOverride, monthlyFeeOverride)
                    .SetProperty(a => a.PromoDurationMonths, promoDurationMonths));

            return isNewApplication;
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
                .Include(a => a.PromoCode)
                .Include(a => a.MorePictures)
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
            return context.Ads.Include(a => a.MorePictures).FirstOrDefault(a => a.Id == id);
        }

        // Used only by the Inquire endpoint, which needs Owner.Name/Number/Email to build
        // its gated response. Deliberately kept separate from Get(int id) — that method
        // backs the public /api/ad/get response, and Owner has no [JsonIgnore] on those
        // fields, so including it there would serialize them straight into that public
        // payload regardless of ShowName/ShowPhone/ShowEmail.
        public Ad GetWithOwner(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Include(a => a.Owner)
                .FirstOrDefault(a => a.Id == id);
        }

        // For the Stripe webhook, which only knows the subscription. Includes Owner for the
        // notification email — never returned to a client.
        public List<Ad> GetBySubscriptionId(string stripeSubscriptionId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Include(a => a.Owner)
                .Where(a => a.StripeSubscriptionId == stripeSubscriptionId)
                .ToList();
        }

        public List<Ad> GetByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Include(a => a.PromoCode)
                .Include(a => a.MorePictures)
                .Where(a => a.OwnerId == ownerId)
                .OrderByDescending(a => a.CreatedDate)
                .ToList();
        }

        public int CountActiveByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads.Count(a => a.OwnerId == ownerId && a.IsActive);
        }

        public int Create(Ad ad)
        {
            using var context = new GownDataContext(_connectionString);
            ad.CreatedDate = DateTime.UtcNow;
            ad.IsActive = false;
            ad.ModerationStatus = ModerationStatus.Draft;
            ad.ImageFocalX = Math.Clamp(ad.ImageFocalX, 0, 1);
            ad.ImageFocalY = Math.Clamp(ad.ImageFocalY, 0, 1);
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
            existing.Categories = ad.Categories;
            existing.Location = ad.Location;
            existing.ServesAllLocations = ad.ServesAllLocations;
            existing.ShowName = ad.ShowName;
            existing.ShowPhone = ad.ShowPhone;
            existing.ShowEmail = ad.ShowEmail;
            context.SaveChanges();
        }

        public void IncrementInquiry(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.InquiryCount++;
            context.SaveChanges();
        }

        public List<string> GetDistinctLocations()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Ads
                .Where(a => a.IsActive)
                .Select(a => a.Location)
                .Where(l => !string.IsNullOrEmpty(l))
                .Distinct()
                .OrderBy(l => l)
                .ToList();
        }

        public void SetImage(int id, string url, double focalX = 0.5, double focalY = 0.5)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.ImageUrl = url;
            existing.ImageFocalX = Math.Clamp(focalX, 0, 1);
            existing.ImageFocalY = Math.Clamp(focalY, 0, 1);
            context.SaveChanges();
        }

        // Repositions the crop on the image already uploaded — used when an owner just
        // drags the existing photo without swapping in a new one.
        public void SetImageFocal(int id, double focalX, double focalY)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.ImageFocalX = Math.Clamp(focalX, 0, 1);
            existing.ImageFocalY = Math.Clamp(focalY, 0, 1);
            context.SaveChanges();
        }

        public void Activate(int id, string stripeSubscriptionId, string stripeCustomerId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            // Only a new subscription restarts the plan's renewal anchor — confirm-ad-session
            // can run again for the same one (e.g. the success page reloaded days later).
            if (existing.StripeSubscriptionId != stripeSubscriptionId || existing.PlanStartedAt == null)
            {
                existing.PlanStartedAt = DateTime.UtcNow;
                existing.CancelsAt = null;
            }
            existing.IsActive = true;
            existing.StripeSubscriptionId = stripeSubscriptionId;
            existing.StripeCustomerId = stripeCustomerId;
            existing.ModerationStatus = ModerationStatus.Approved;
            context.SaveChanges();
        }

        // Only before billing starts (Draft/PendingReview — see PaymentController.SetAdPlan).
        // Switching to a prepaid plan drops any promo, since promos only apply to Monthly;
        // nothing to un-count, because redemptions are only counted at approval.
        public void SetBillingPlan(int id, AdBillingPlan plan)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.BillingPlan = plan;
            if (plan != AdBillingPlan.Monthly)
            {
                existing.PromoCodeId = null;
                existing.MonthlyFeeOverride = null;
                existing.PromoDurationMonths = null;
            }
            context.SaveChanges();
        }

        // Backstop for the Stripe webhook (see AdPlanExpiryService): a cancelled prepaid ad
        // whose paid period is over comes down even if the subscription.deleted event never
        // arrived. Returns how many it took down.
        public int ExpireEndedPrepaidAds()
        {
            using var context = new GownDataContext(_connectionString);
            var now = DateTime.UtcNow;
            return context.Ads
                .Where(a => a.IsActive && a.CancelsAt != null && a.CancelsAt <= now)
                .ExecuteUpdate(s => s.SetProperty(a => a.IsActive, false));
        }

        public void SetCancelsAt(int id, DateTime? cancelsAt)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            existing.CancelsAt = cancelsAt;
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
                .Include(a => a.PromoCode)
                .Include(a => a.MorePictures)
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
            existing.PlanStartedAt = DateTime.UtcNow;
            existing.CancelsAt = null;
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

        // Appends after whatever's already in the gallery (unlike GownRepository.AddPictures,
        // which restarts at 0) so photos added in a later edit stay after the earlier ones.
        public void AddPictures(int adId, List<string> urls)
        {
            using var context = new GownDataContext(_connectionString);
            var order = (context.AdPictures.Where(p => p.AdId == adId).Max(p => (int?)p.SortOrder) ?? -1) + 1;
            foreach (var url in urls)
            {
                context.AdPictures.Add(new AdPicture { AdId = adId, Url = url, SortOrder = order++ });
            }
            context.SaveChanges();
        }

        public void RemovePictures(int adId, List<int> pictureIds)
        {
            if (pictureIds == null || pictureIds.Count == 0) return;
            using var context = new GownDataContext(_connectionString);
            var toRemove = context.AdPictures
                .Where(p => p.AdId == adId && pictureIds.Contains(p.Id))
                .ToList();
            context.AdPictures.RemoveRange(toRemove);
            context.SaveChanges();
        }

        // Only ever called on a Draft or a still-PendingReview ad (see
        // AdController.DeleteDraft) — neither has gone live yet, so there's no active
        // Stripe subscription to cancel first. AdPicture's FK uses DeleteBehavior.Restrict
        // (see GownDataContext), so its rows must be removed before the Ad row itself.
        public void DeleteDraft(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Ads.Include(a => a.MorePictures).FirstOrDefault(a => a.Id == id);
            if (existing == null) return;

            context.AdPictures.RemoveRange(existing.MorePictures);
            context.Ads.Remove(existing);
            context.SaveChanges();
        }
    }
}
