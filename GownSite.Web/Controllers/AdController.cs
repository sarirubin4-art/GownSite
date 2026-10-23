using GownSite.Data;
using GownSite.Web.Filters;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GownSite.Web.Controllers
{
    public class CreateAdRequest
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public string TargetUrl { get; set; }
        public string Category { get; set; }
        public string Location { get; set; }
        public bool ServesAllLocations { get; set; }
        public string PromoCode { get; set; }
        public bool ShowName { get; set; }
        public bool ShowPhone { get; set; }
        public bool ShowEmail { get; set; }
        public IFormFile Image { get; set; }
        // 0-1 fraction; only meaningful when Image is non-square. Defaults to centered
        // (0.5, 0.5) when omitted — see Ad.ImageFocalX/Y.
        public double? ImageFocalX { get; set; }
        public double? ImageFocalY { get; set; }
        // Set when finalizing a draft that autosave already created, so this submit
        // updates that same row (and resolves any promo now) instead of making a new one.
        public int? Id { get; set; }
        // Optional Photo Gallery (Ad.MorePictures) — only photos autosave hasn't already
        // uploaded to the draft (see SaveDraftAdRequest).
        public List<IFormFile> MorePictures { get; set; } = new();
        public List<int> RemovePictureIds { get; set; } = new();
    }

    public class EditAdRequest
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string TargetUrl { get; set; }
        public string Category { get; set; }
        public string Location { get; set; }
        public bool ServesAllLocations { get; set; }
        public bool ShowName { get; set; }
        public bool ShowPhone { get; set; }
        public bool ShowEmail { get; set; }
        public IFormFile Image { get; set; }
        public double? ImageFocalX { get; set; }
        public double? ImageFocalY { get; set; }
        public List<IFormFile> MorePictures { get; set; } = new();
        public List<int> RemovePictureIds { get; set; } = new();
    }

    // No required fields — saved silently in the background while the owner is still
    // filling out the ad form, so partial progress survives a closed tab.
    public class SaveDraftAdRequest
    {
        public int? Id { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string TargetUrl { get; set; }
        public string Category { get; set; }
        public string Location { get; set; }
        public bool ServesAllLocations { get; set; }
        public bool ShowName { get; set; }
        public bool ShowPhone { get; set; }
        public bool ShowEmail { get; set; }
        public IFormFile Image { get; set; }
        public double? ImageFocalX { get; set; }
        public double? ImageFocalY { get; set; }
        // The form sends each gallery photo (and each removal) once — never again on later
        // autosaves — and replaces its local list with the morePictures this returns.
        public List<IFormFile> MorePictures { get; set; } = new();
        public List<int> RemovePictureIds { get; set; } = new();
    }

    public class AdIdRequest
    {
        public int Id { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AdController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IWebHostEnvironment _env;
        private readonly IFileStorageService _storage;
        private readonly IConfiguration _configuration;
        private readonly AnalyticsRecorder _analytics;

        public const int MaxMorePictures = 8;

        // Shared by the owner-facing create/edit and AdminController.EditAd: checks the
        // gallery's resulting size and file types, returning an error message or null.
        public static string ValidateGalleryChange(Ad existing, List<IFormFile> newFiles, List<int> removeIds)
        {
            var existingCount = existing?.MorePictures.Count ?? 0;
            var removingCount = existing?.MorePictures.Count(p => (removeIds ?? new List<int>()).Contains(p.Id)) ?? 0;
            if (existingCount - removingCount + (newFiles?.Count ?? 0) > MaxMorePictures)
                return $"You can have up to {MaxMorePictures} gallery photos total.";
            if (newFiles != null && newFiles.Any(f => !ImageUploadValidator.IsValidImage(f)))
                return ImageUploadValidator.ErrorMessage;
            return null;
        }

        public static async Task ApplyGalleryChangeAsync(AdRepository repo, IFileStorageService storage, int adId, List<IFormFile> newFiles, List<int> removeIds)
        {
            repo.RemovePictures(adId, removeIds);
            if (newFiles?.Count > 0)
            {
                var urls = new List<string>();
                foreach (var file in newFiles)
                    urls.Add(await storage.SaveAsync(file, "ads"));
                repo.AddPictures(adId, urls);
            }
        }

        public AdController(IConfiguration configuration, IWebHostEnvironment env, IFileStorageService storage, AnalyticsRecorder analytics)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _env = env;
            _storage = storage;
            _analytics = analytics;
        }

        [HttpGet("getactive")]
        public List<Ad> GetActive()
        {
            var repo = new AdRepository(_connectionString);
            return repo.GetActive();
        }

        [HttpGet("locations")]
        public List<string> GetLocations()
        {
            var repo = new AdRepository(_connectionString);
            return repo.GetDistinctLocations();
        }

        [HttpGet("get")]
        public IActionResult Get(int id)
        {
            var repo = new AdRepository(_connectionString);
            var ad = repo.Get(id);
            if (ad == null) return NotFound();
            if (!ad.IsActive && !IsCurrentOwner(ad.OwnerId)) return NotFound();
            return Ok(ad);
        }

        [HttpGet("myads")]
        [Authorize]
        public List<Ad> MyAds()
        {
            var repo = new AdRepository(_connectionString);
            return repo.GetByOwner(CurrentOwnerId());
        }

        // Proof-of-value numbers for the Ads section of My Listings, keyed by ad id: how often the floating card was
        // shown and clicked, detail-page views, and "Learn More" clicks out to their site.
        // Contact reveals already ride along on the ad itself (InquiryCount).
        [HttpGet("myads/stats")]
        [Authorize]
        public IActionResult MyAdStats()
        {
            var ids = new AnalyticsRepository(_connectionString).GetOwnerListingIds("Ad", CurrentOwnerId());
            if (ids.Count == 0) return Ok(new Dictionary<int, object>());

            var analytics = new AnalyticsRepository(_connectionString);
            var views = analytics.GetEntityViewCounts("Ad", ids, DateTime.UtcNow.AddDays(-30));
            var impressions = analytics.GetEventCounts(SiteEventTypes.AdImpression, ids);
            var cardClicks = analytics.GetEventCounts(SiteEventTypes.AdClick, ids);
            var websiteClicks = analytics.GetEventCounts(SiteEventTypes.AdLinkClick, ids);

            return Ok(ids.ToDictionary(id => id, id => new
            {
                views = views.GetValueOrDefault(id)?.Total ?? 0,
                viewsLast30Days = views.GetValueOrDefault(id)?.Last30Days ?? 0,
                impressions = impressions.GetValueOrDefault(id),
                cardClicks = cardClicks.GetValueOrDefault(id),
                websiteClicks = websiteClicks.GetValueOrDefault(id)
            }));
        }

        // Anonymous, public — mirrors GownController.Inquire. Uses GetWithOwner rather than
        // Get (which backs the public /api/ad/get response and deliberately doesn't include
        // Owner) so name/phone/email only ever reach the client through this gated response.
        [HttpPost("inquire")]
        public IActionResult Inquire([FromBody] AdIdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var ad = repo.GetWithOwner(request.Id);
            if (ad == null || !ad.IsActive) return NotFound();

            repo.IncrementInquiry(request.Id);
            ad.InquiryCount++;
            _analytics.RecordEvent(HttpContext, SiteEventTypes.AdContact, request.Id);

            return Ok(new
            {
                ownerName = ad.ShowName ? ad.Owner?.Name : null,
                ownerNumber = ad.ShowPhone ? ad.Owner?.Number : null,
                ownerEmail = ad.ShowEmail ? ad.Owner?.Email : null,
                inquiryCount = ad.InquiryCount
            });
        }

        [HttpPost("create")]
        [Authorize]
        [RequireVerifiedEmail]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> Create([FromForm] CreateAdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            Ad existingDraft = null;
            if (request.Id.HasValue)
            {
                existingDraft = repo.Get(request.Id.Value);
                if (existingDraft == null || existingDraft.OwnerId != CurrentOwnerId()) return Forbid();
                if (existingDraft.ModerationStatus != ModerationStatus.Draft)
                    return BadRequest(new { message = "This ad has already been submitted." });
            }

            if (request.Image == null && existingDraft?.ImageUrl == null)
                return BadRequest(new { message = "An ad image is required." });
            if (request.Image != null && !ImageUploadValidator.IsValidImage(request.Image))
                return BadRequest(new { message = ImageUploadValidator.ErrorMessage });
            if (!AdCategoryHelper.TryNormalize(request.Category, out var normalizedCategories))
                return BadRequest(new { message = "Please choose at least one valid category." });
            if (!request.ServesAllLocations && string.IsNullOrWhiteSpace(request.Location))
                return BadRequest(new { message = "Please choose a location, or mark this ad as not tied to one location." });
            if (!request.ShowPhone && !request.ShowEmail)
                return BadRequest(new { message = "Please allow a phone number or email so interested customers can actually contact you." });
            var galleryError = ValidateGalleryChange(existingDraft, request.MorePictures, request.RemovePictureIds);
            if (galleryError != null) return BadRequest(new { message = galleryError });

            int? promoCodeId = null;
            decimal? monthlyFeeOverride = null;
            int? promoDurationMonths = null;
            if (!string.IsNullOrWhiteSpace(request.PromoCode))
            {
                var promoRepo = new PromoCodeRepository(_connectionString);
                var promo = promoRepo.GetByCode(request.PromoCode);
                var baseFee = _configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m);
                var resolved = PromoCodeCalculator.Resolve(promo, baseFee, 1, PromoAppliesTo.Ad);
                if (!resolved.Success)
                    return BadRequest(new { message = resolved.Error });

                promoCodeId = promo.Id;
                monthlyFeeOverride = resolved.ResolvedFee;
                promoDurationMonths = resolved.DurationMonths;
            }

            var imageUrl = request.Image != null
                ? await _storage.SaveAsync(request.Image, "ads")
                : existingDraft.ImageUrl;
            var focalX = request.ImageFocalX ?? 0.5;
            var focalY = request.ImageFocalY ?? 0.5;

            int id;
            if (existingDraft != null)
            {
                repo.Update(new Ad
                {
                    Id = existingDraft.Id,
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Categories = normalizedCategories,
                    Location = request.ServesAllLocations ? null : request.Location,
                    ServesAllLocations = request.ServesAllLocations,
                    ShowName = request.ShowName,
                    ShowPhone = request.ShowPhone,
                    ShowEmail = request.ShowEmail
                });
                if (request.Image != null) repo.SetImage(existingDraft.Id, imageUrl, focalX, focalY);
                else if (request.ImageFocalX.HasValue || request.ImageFocalY.HasValue) repo.SetImageFocal(existingDraft.Id, focalX, focalY);
                if (promoCodeId.HasValue) repo.ApplyPromo(existingDraft.Id, promoCodeId.Value, monthlyFeeOverride, promoDurationMonths);
                id = existingDraft.Id;
            }
            else
            {
                var ad = new Ad
                {
                    OwnerId = CurrentOwnerId(),
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Categories = normalizedCategories,
                    Location = request.ServesAllLocations ? null : request.Location,
                    ServesAllLocations = request.ServesAllLocations,
                    ShowName = request.ShowName,
                    ShowPhone = request.ShowPhone,
                    ShowEmail = request.ShowEmail,
                    ImageUrl = imageUrl,
                    ImageFocalX = focalX,
                    ImageFocalY = focalY,
                    PromoCodeId = promoCodeId,
                    MonthlyFeeOverride = monthlyFeeOverride,
                    PromoDurationMonths = promoDurationMonths
                };
                id = repo.Create(ad);
            }

            await ApplyGalleryChangeAsync(repo, _storage, id, request.MorePictures, request.RemovePictureIds);

            return Ok(new { id });
        }

        [HttpPost("edit")]
        [Authorize]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> Edit([FromForm] EditAdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();
            if (!AdCategoryHelper.TryNormalize(request.Category, out var normalizedCategories))
                return BadRequest(new { message = "Please choose at least one valid category." });
            if (!request.ServesAllLocations && string.IsNullOrWhiteSpace(request.Location))
                return BadRequest(new { message = "Please choose a location, or mark this ad as not tied to one location." });
            if (!request.ShowPhone && !request.ShowEmail)
                return BadRequest(new { message = "Please allow a phone number or email so interested customers can actually contact you." });
            if (request.Image != null && !ImageUploadValidator.IsValidImage(request.Image))
                return BadRequest(new { message = ImageUploadValidator.ErrorMessage });
            var galleryError = ValidateGalleryChange(existing, request.MorePictures, request.RemovePictureIds);
            if (galleryError != null) return BadRequest(new { message = galleryError });

            repo.Update(new Ad
            {
                Id = request.Id,
                Title = request.Title,
                Description = request.Description,
                TargetUrl = request.TargetUrl,
                Categories = normalizedCategories,
                Location = request.ServesAllLocations ? null : request.Location,
                ServesAllLocations = request.ServesAllLocations,
                ShowName = request.ShowName,
                ShowPhone = request.ShowPhone,
                ShowEmail = request.ShowEmail
            });
            if (request.Image != null)
                repo.SetImage(request.Id, await _storage.SaveAsync(request.Image, "ads"), request.ImageFocalX ?? 0.5, request.ImageFocalY ?? 0.5);
            else if (request.ImageFocalX.HasValue || request.ImageFocalY.HasValue)
                repo.SetImageFocal(request.Id, request.ImageFocalX ?? 0.5, request.ImageFocalY ?? 0.5);
            await ApplyGalleryChangeAsync(repo, _storage, request.Id, request.MorePictures, request.RemovePictureIds);

            return Ok();
        }

        [HttpPost("draft")]
        [Authorize]
        [RequireVerifiedEmail]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> SaveDraft([FromForm] SaveDraftAdRequest request)
        {
            if (request.Image != null && !ImageUploadValidator.IsValidImage(request.Image))
                return BadRequest(new { message = ImageUploadValidator.ErrorMessage });

            var repo = new AdRepository(_connectionString);
            AdCategoryHelper.TryNormalize(request.Category, out var normalizedCategories);

            Ad existing = null;
            if (request.Id.HasValue)
            {
                existing = repo.Get(request.Id.Value);
                if (existing == null || existing.OwnerId != CurrentOwnerId()) return Forbid();
                if (existing.ModerationStatus != ModerationStatus.Draft)
                    return BadRequest(new { message = "This ad is no longer a draft." });
            }
            var galleryError = ValidateGalleryChange(existing, request.MorePictures, request.RemovePictureIds);
            if (galleryError != null) return BadRequest(new { message = galleryError });

            string imageUrl = null;
            if (request.Image != null)
                imageUrl = await _storage.SaveAsync(request.Image, "ads");
            var focalX = request.ImageFocalX ?? 0.5;
            var focalY = request.ImageFocalY ?? 0.5;

            int id;
            if (existing != null)
            {
                repo.Update(new Ad
                {
                    Id = existing.Id,
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Categories = normalizedCategories,
                    Location = request.ServesAllLocations ? null : request.Location,
                    ServesAllLocations = request.ServesAllLocations,
                    ShowName = request.ShowName,
                    ShowPhone = request.ShowPhone,
                    ShowEmail = request.ShowEmail
                });
                if (imageUrl != null) repo.SetImage(existing.Id, imageUrl, focalX, focalY);
                else if (request.ImageFocalX.HasValue || request.ImageFocalY.HasValue) repo.SetImageFocal(existing.Id, focalX, focalY);
                id = existing.Id;
            }
            else
            {
                var ad = new Ad
                {
                    OwnerId = CurrentOwnerId(),
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Categories = normalizedCategories,
                    Location = request.ServesAllLocations ? null : request.Location,
                    ServesAllLocations = request.ServesAllLocations,
                    ShowName = request.ShowName,
                    ShowPhone = request.ShowPhone,
                    ShowEmail = request.ShowEmail,
                    ImageUrl = imageUrl,
                    ImageFocalX = focalX,
                    ImageFocalY = focalY
                };
                id = repo.Create(ad);
            }

            // The saved gallery only comes back when this save changed it — most autosaves
            // are just text, and the form ignores the list otherwise.
            if (request.MorePictures?.Count > 0 || request.RemovePictureIds?.Count > 0)
            {
                await ApplyGalleryChangeAsync(repo, _storage, id, request.MorePictures, request.RemovePictureIds);
                var morePictures = repo.Get(id).MorePictures.OrderBy(p => p.SortOrder).ToList();
                return Ok(new { id, morePictures });
            }
            return Ok(new { id });
        }

        [HttpPost("activate-test")]
        [Authorize]
        public IActionResult ActivateTest([FromBody] AdIdRequest request)
        {
            if (!_env.IsDevelopment()) return NotFound();

            var repo = new AdRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();

            repo.Activate(request.Id, null, null);
            return Ok();
        }

        [HttpPost("cancel")]
        [Authorize]
        public async Task<IActionResult> Cancel([FromBody] AdIdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();

            // A prepaid plan was paid for through the end of its period, so it just stops
            // renewing and stays live until then (no refund); StripeWebhookController takes
            // it down when Stripe ends the subscription.
            if (AdPlans.IsPrepaid(existing.BillingPlan) && existing.IsActive && !string.IsNullOrEmpty(existing.StripeSubscriptionId))
            {
                Stripe.Subscription subscription;
                try
                {
                    subscription = await new Stripe.SubscriptionService().UpdateAsync(existing.StripeSubscriptionId,
                        new Stripe.SubscriptionUpdateOptions { CancelAtPeriodEnd = true });
                }
                catch (Stripe.StripeException ex)
                {
                    return BadRequest(new { message = $"Could not cancel the renewal: {ex.Message}" });
                }
                var cancelsAt = subscription.CancelAt ?? subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
                repo.SetCancelsAt(request.Id, cancelsAt);
                return Ok(new { cancelsAt });
            }

            if (!string.IsNullOrEmpty(existing.StripeSubscriptionId))
            {
                try
                {
                    var subscriptionService = new Stripe.SubscriptionService();
                    await subscriptionService.CancelAsync(existing.StripeSubscriptionId);
                }
                catch (Stripe.StripeException)
                {
                    // subscription may already be canceled on Stripe's side; proceed to deactivate locally
                }
            }

            repo.Cancel(request.Id);
            return Ok();
        }

        // Undoes a prepaid plan's scheduled cancellation, as long as the period hasn't ended yet.
        [HttpPost("keep-plan")]
        [Authorize]
        public async Task<IActionResult> KeepPlan([FromBody] AdIdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();
            if (!existing.IsActive || !existing.CancelsAt.HasValue || string.IsNullOrEmpty(existing.StripeSubscriptionId))
                return BadRequest(new { message = "This ad isn't scheduled to end." });

            try
            {
                await new Stripe.SubscriptionService().UpdateAsync(existing.StripeSubscriptionId,
                    new Stripe.SubscriptionUpdateOptions { CancelAtPeriodEnd = false });
            }
            catch (Stripe.StripeException ex)
            {
                return BadRequest(new { message = $"Could not restore the renewal: {ex.Message}" });
            }
            repo.SetCancelsAt(request.Id, null);
            return Ok();
        }

        [HttpPost("delete-draft")]
        [Authorize]
        public IActionResult DeleteDraft([FromBody] AdIdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();
            if (existing.ModerationStatus != ModerationStatus.Draft && existing.ModerationStatus != ModerationStatus.PendingReview)
                return BadRequest(new { message = "Only a draft or an ad still awaiting review can be deleted." });

            repo.DeleteDraft(request.Id);
            return Ok();
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private bool IsCurrentOwner(int? ownerId)
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return idClaim != null && ownerId.HasValue && int.Parse(idClaim) == ownerId.Value;
        }
    }
}
