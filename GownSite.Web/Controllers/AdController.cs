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
        public string PromoCode { get; set; }
        public IFormFile Image { get; set; }
        // Set when finalizing a draft that autosave already created, so this submit
        // updates that same row (and resolves any promo now) instead of making a new one.
        public int? Id { get; set; }
    }

    public class EditAdRequest
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string TargetUrl { get; set; }
        public string Category { get; set; }
        public IFormFile Image { get; set; }
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
        public IFormFile Image { get; set; }
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

        public AdController(IConfiguration configuration, IWebHostEnvironment env, IFileStorageService storage)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _env = env;
            _storage = storage;
        }

        [HttpGet("getactive")]
        public List<Ad> GetActive()
        {
            var repo = new AdRepository(_connectionString);
            return repo.GetActive();
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
            if (!Enum.TryParse<AdCategory>(request.Category, out var category))
                return BadRequest(new { message = "Please choose a valid category." });

            int? promoCodeId = null;
            decimal? monthlyFeeOverride = null;
            int? promoDurationMonths = null;
            if (!string.IsNullOrWhiteSpace(request.PromoCode))
            {
                var promoRepo = new PromoCodeRepository(_connectionString);
                var promo = promoRepo.GetByCode(request.PromoCode);
                var baseFee = _configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m);
                var resolved = PromoCodeCalculator.Resolve(promo, baseFee);
                if (!resolved.Success)
                    return BadRequest(new { message = resolved.Error });

                promoCodeId = promo.Id;
                monthlyFeeOverride = resolved.ResolvedFee;
                promoDurationMonths = resolved.DurationMonths;
            }

            var imageUrl = request.Image != null
                ? await _storage.SaveAsync(request.Image, "ads")
                : existingDraft.ImageUrl;

            int id;
            if (existingDraft != null)
            {
                repo.Update(new Ad
                {
                    Id = existingDraft.Id,
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Category = category
                });
                if (request.Image != null) repo.SetImage(existingDraft.Id, imageUrl);
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
                    Category = category,
                    ImageUrl = imageUrl,
                    PromoCodeId = promoCodeId,
                    MonthlyFeeOverride = monthlyFeeOverride,
                    PromoDurationMonths = promoDurationMonths
                };
                id = repo.Create(ad);
            }

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
            if (!Enum.TryParse<AdCategory>(request.Category, out var category))
                return BadRequest(new { message = "Please choose a valid category." });

            repo.Update(new Ad
            {
                Id = request.Id,
                Title = request.Title,
                Description = request.Description,
                TargetUrl = request.TargetUrl,
                Category = category
            });
            if (request.Image != null)
                repo.SetImage(request.Id, await _storage.SaveAsync(request.Image, "ads"));

            return Ok();
        }

        [HttpPost("draft")]
        [Authorize]
        [RequireVerifiedEmail]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> SaveDraft([FromForm] SaveDraftAdRequest request)
        {
            var repo = new AdRepository(_connectionString);
            Enum.TryParse<AdCategory>(request.Category, out var category);

            string imageUrl = null;
            if (request.Image != null)
                imageUrl = await _storage.SaveAsync(request.Image, "ads");

            if (request.Id.HasValue)
            {
                var existing = repo.Get(request.Id.Value);
                if (existing == null || existing.OwnerId != CurrentOwnerId()) return Forbid();
                if (existing.ModerationStatus != ModerationStatus.Draft)
                    return BadRequest(new { message = "This ad is no longer a draft." });

                repo.Update(new Ad
                {
                    Id = existing.Id,
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Category = category
                });
                if (imageUrl != null) repo.SetImage(existing.Id, imageUrl);

                return Ok(new { id = existing.Id });
            }
            else
            {
                var ad = new Ad
                {
                    OwnerId = CurrentOwnerId(),
                    Title = request.Title,
                    Description = request.Description,
                    TargetUrl = request.TargetUrl,
                    Category = category,
                    ImageUrl = imageUrl
                };
                var id = repo.Create(ad);
                return Ok(new { id });
            }
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

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private bool IsCurrentOwner(int? ownerId)
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return idClaim != null && ownerId.HasValue && int.Parse(idClaim) == ownerId.Value;
        }
    }
}
