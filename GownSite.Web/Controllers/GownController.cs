using GownSite.Data;
using GownSite.Web.Filters;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GownSite.Web.Controllers
{
    public class CreateGownRequest
    {
        public string Description { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal Price { get; set; }
        public decimal? PriceMax { get; set; }
        public string Location { get; set; }
        public string ListingType { get; set; }
        public bool DisplayOwnerName { get; set; }
        public string Brand { get; set; }
        public decimal? PricePaid { get; set; }
        public string Condition { get; set; }
        public string Length { get; set; }
        public string StyleTags { get; set; }
        public string Notes { get; set; }
        public string PromoCode { get; set; }
        public Guid? BatchId { get; set; }
        public int? BatchSize { get; set; }
        public IFormFile PrimaryPicture { get; set; }
        public List<IFormFile> MorePictures { get; set; } = new();
        // Set when finalizing a draft that autosave already created, so this submit
        // updates that same row (and resolves any promo now) instead of making a new one.
        public int? Id { get; set; }
    }

    // Deliberately has no required fields — called silently in the background while the
    // owner is still filling out the posting form, so whatever they've entered so far
    // survives a closed tab/browser crash instead of being lost.
    public class SaveDraftGownRequest
    {
        public int? Id { get; set; }
        public string Description { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal? Price { get; set; }
        public decimal? PriceMax { get; set; }
        public string Location { get; set; }
        public string ListingType { get; set; }
        public bool DisplayOwnerName { get; set; }
        public string Brand { get; set; }
        public decimal? PricePaid { get; set; }
        public string Condition { get; set; }
        public string Length { get; set; }
        public string StyleTags { get; set; }
        public string Notes { get; set; }
        public IFormFile PrimaryPicture { get; set; }
    }

    public class EditGownRequest
    {
        public int Id { get; set; }
        public string Description { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal Price { get; set; }
        public decimal? PriceMax { get; set; }
        public string Location { get; set; }
        public string ListingType { get; set; }
        public bool DisplayOwnerName { get; set; }
        public string Brand { get; set; }
        public decimal? PricePaid { get; set; }
        public string Condition { get; set; }
        public string Length { get; set; }
        public string StyleTags { get; set; }
        public string Notes { get; set; }
        public IFormFile PrimaryPicture { get; set; }
        public List<IFormFile> MorePictures { get; set; } = new();
        public List<int> RemovePictureIds { get; set; } = new();
    }

    public class IdRequest
    {
        public int Id { get; set; }
    }

    // Concierge posting service: a customer who doesn't want to fill out the full form
    // submits just the essentials and admin fleshes the rest out later (see
    // AdminController's concierge/* endpoints). Only Size/Price/Location/PrimaryPicture
    // are required — everything else is left for admin to fill in during flesh-out.
    public class ConciergeIntakeGownRequest
    {
        public string Description { get; set; }
        public string Color { get; set; }
        public string Size { get; set; }
        public decimal Price { get; set; }
        public string Location { get; set; }
        public string ListingType { get; set; }
        public bool DisplayOwnerName { get; set; }
        public string Brand { get; set; }
        public decimal? PricePaid { get; set; }
        public string Condition { get; set; }
        public string Length { get; set; }
        public string StyleTags { get; set; }
        public string Notes { get; set; }
        public Guid BatchId { get; set; }
        public int? BatchSize { get; set; }
        public string PromoCode { get; set; }
        public IFormFile PrimaryPicture { get; set; }
    }

    public class ConciergeNotifyRequest
    {
        public Guid BatchId { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class GownController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IWebHostEnvironment _env;
        private readonly IFileStorageService _storage;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;

        public GownController(IConfiguration configuration, IWebHostEnvironment env, IFileStorageService storage, IEmailSender emailSender)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _env = env;
            _storage = storage;
            _emailSender = emailSender;
        }

        [HttpPost("search")]
        public GownSearchResult Search([FromBody] GownSearchFilters filters)
        {
            var repo = new GownRepository(_connectionString);
            return repo.Search(filters ?? new GownSearchFilters());
        }

        [HttpGet("get")]
        public IActionResult Get(int id)
        {
            var repo = new GownRepository(_connectionString);
            var posting = repo.Get(id);
            if (posting == null) return NotFound();
            if (!posting.IsActive && !IsCurrentOwner(posting.OwnerId)) return NotFound();
            return Ok(posting);
        }

        [HttpGet("locations")]
        public List<string> GetLocations()
        {
            var repo = new GownRepository(_connectionString);
            return repo.GetDistinctLocations();
        }

        [HttpGet("mylistings")]
        [Authorize]
        public List<GownPosting> MyListings()
        {
            var repo = new GownRepository(_connectionString);
            return repo.GetByOwner(CurrentOwnerId());
        }

        public const int MaxMorePictures = 5;
        public const int MaxBatchGowns = 20;

        [HttpPost("create")]
        [Authorize]
        [RequireVerifiedEmail]
        [RequestSizeLimit(100_000_000)]
        public async Task<IActionResult> Create([FromForm] CreateGownRequest request)
        {
            var repo = new GownRepository(_connectionString);
            GownPosting existingDraft = null;
            if (request.Id.HasValue)
            {
                existingDraft = repo.Get(request.Id.Value);
                if (existingDraft == null || existingDraft.OwnerId != CurrentOwnerId()) return Forbid();
                if (existingDraft.ModerationStatus != ModerationStatus.Draft)
                    return BadRequest(new { message = "This listing has already been submitted." });
            }

            if (request.PrimaryPicture == null && existingDraft?.PrimaryPictureUrl == null)
                return BadRequest(new { message = "A primary picture is required." });
            if (!Enum.TryParse<ListingType>(request.ListingType, out var listingType))
                return BadRequest(new { message = "ListingType must be 'Rent' or 'Sale'." });
            if (request.MorePictures?.Count > MaxMorePictures)
                return BadRequest(new { message = $"You can upload up to {MaxMorePictures} additional photos." });
            if (request.PriceMax.HasValue && request.PriceMax.Value <= request.Price)
                return BadRequest(new { message = "The high end of the price range must be more than the low end." });

            var pricing = PromoCodeCalculator.ResolvePricing(
                _connectionString, request.PromoCode, _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m),
                request.BatchId.HasValue, request.BatchSize ?? 1);
            if (!pricing.Success)
                return BadRequest(new { message = pricing.Error });

            var promoCodeId = pricing.PromoCodeId;
            var monthlyFeeOverride = pricing.MonthlyFeeOverride;
            var promoDurationMonths = pricing.PromoDurationMonths;

            var primaryUrl = request.PrimaryPicture != null
                ? await _storage.SaveAsync(request.PrimaryPicture, "gowns")
                : existingDraft.PrimaryPictureUrl;

            int id;
            if (existingDraft != null)
            {
                repo.Update(new GownPosting
                {
                    Id = existingDraft.Id,
                    Description = request.Description,
                    Color = request.Color,
                    Size = request.Size,
                    Price = request.Price,
                    PriceMax = request.PriceMax,
                    Location = request.Location,
                    ListingType = listingType,
                    DisplayOwnerName = request.DisplayOwnerName,
                    Brand = request.Brand,
                    PricePaid = request.PricePaid,
                    Condition = request.Condition,
                    Length = request.Length,
                    StyleTags = request.StyleTags,
                    Notes = request.Notes
                });
                if (request.PrimaryPicture != null) repo.SetPrimaryPicture(existingDraft.Id, primaryUrl);
                if (promoCodeId.HasValue) repo.ApplyPromo(existingDraft.Id, promoCodeId.Value, monthlyFeeOverride, promoDurationMonths);
                id = existingDraft.Id;
            }
            else
            {
                var posting = new GownPosting
                {
                    OwnerId = CurrentOwnerId(),
                    Description = request.Description,
                    Color = request.Color,
                    Size = request.Size,
                    Price = request.Price,
                    PriceMax = request.PriceMax,
                    Location = request.Location,
                    ListingType = listingType,
                    DisplayOwnerName = request.DisplayOwnerName,
                    Brand = request.Brand,
                    PricePaid = request.PricePaid,
                    Condition = request.Condition,
                    Length = request.Length,
                    StyleTags = request.StyleTags,
                    Notes = request.Notes,
                    PrimaryPictureUrl = primaryUrl,
                    PromoCodeId = promoCodeId,
                    MonthlyFeeOverride = monthlyFeeOverride,
                    PromoDurationMonths = promoDurationMonths,
                    BatchId = request.BatchId
                };
                id = repo.Create(posting);
            }

            if (request.MorePictures?.Count > 0)
            {
                var urls = new List<string>();
                foreach (var file in request.MorePictures)
                    urls.Add(await _storage.SaveAsync(file, "gowns"));
                repo.AddPictures(id, urls);
            }

            return Ok(new { id });
        }

        [HttpPost("draft")]
        [Authorize]
        [RequireVerifiedEmail]
        [RequestSizeLimit(100_000_000)]
        public async Task<IActionResult> SaveDraft([FromForm] SaveDraftGownRequest request)
        {
            var repo = new GownRepository(_connectionString);
            Enum.TryParse<ListingType>(request.ListingType, out var listingType);

            string primaryUrl = null;
            if (request.PrimaryPicture != null)
                primaryUrl = await _storage.SaveAsync(request.PrimaryPicture, "gowns");

            if (request.Id.HasValue)
            {
                var existing = repo.Get(request.Id.Value);
                if (existing == null || existing.OwnerId != CurrentOwnerId()) return Forbid();
                if (existing.ModerationStatus != ModerationStatus.Draft)
                    return BadRequest(new { message = "This listing is no longer a draft." });

                repo.Update(new GownPosting
                {
                    Id = existing.Id,
                    Description = request.Description,
                    Color = request.Color,
                    Size = request.Size,
                    Price = request.Price ?? 0,
                    PriceMax = request.PriceMax,
                    Location = request.Location,
                    ListingType = listingType,
                    DisplayOwnerName = request.DisplayOwnerName,
                    Brand = request.Brand,
                    PricePaid = request.PricePaid,
                    Condition = request.Condition,
                    Length = request.Length,
                    StyleTags = request.StyleTags,
                    Notes = request.Notes
                });
                if (primaryUrl != null) repo.SetPrimaryPicture(existing.Id, primaryUrl);

                return Ok(new { id = existing.Id });
            }
            else
            {
                var posting = new GownPosting
                {
                    OwnerId = CurrentOwnerId(),
                    Description = request.Description,
                    Color = request.Color,
                    Size = request.Size,
                    Price = request.Price ?? 0,
                    PriceMax = request.PriceMax,
                    Location = request.Location,
                    ListingType = listingType,
                    DisplayOwnerName = request.DisplayOwnerName,
                    Brand = request.Brand,
                    PricePaid = request.PricePaid,
                    Condition = request.Condition,
                    Length = request.Length,
                    StyleTags = request.StyleTags,
                    Notes = request.Notes,
                    PrimaryPictureUrl = primaryUrl
                };
                var id = repo.Create(posting);
                return Ok(new { id });
            }
        }

        // A business-plan owner's flat monthly fee already covers their gowns — this
        // moves a Draft straight to PendingReview with no per-gown Stripe setup-session,
        // unlike the normal PaymentController.CreateSetupSession/ConfirmSetupSession flow.
        [HttpPost("submit-business")]
        [Authorize]
        [RequireVerifiedEmail]
        public async Task<IActionResult> SubmitBusiness([FromBody] IdRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var posting = repo.Get(request.Id);
            if (posting == null) return NotFound();
            if (posting.OwnerId != CurrentOwnerId()) return Forbid();
            if (posting.ModerationStatus != ModerationStatus.Draft)
                return BadRequest(new { message = "This listing has already been submitted." });

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(CurrentOwnerId());
            if (owner == null || !owner.IsBusinessAccount || string.IsNullOrEmpty(owner.BusinessStripeSubscriptionId))
                return BadRequest(new { message = "Business billing hasn't been set up for this account yet." });

            repo.SubmitForReview(request.Id, null, null);

            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            var baseUrl = string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (!string.IsNullOrEmpty(adminEmail))
            {
                await _emailSender.SendAsync(
                    adminEmail,
                    "New gown submitted for review — Regowned",
                    EmailTemplates.NewSubmissionAdmin("gown", posting.Owner.Name, posting.Description, $"{baseUrl}/admin", baseUrl)
                );
            }

            return Ok();
        }

        [HttpPost("edit")]
        [Authorize]
        [RequestSizeLimit(100_000_000)]
        public async Task<IActionResult> Edit([FromForm] EditGownRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();
            if (!Enum.TryParse<ListingType>(request.ListingType, out var listingType))
                return BadRequest(new { message = "ListingType must be 'Rent' or 'Sale'." });
            var removeIds = existing.MorePictures.Select(p => p.Id).Intersect(request.RemovePictureIds ?? new List<int>()).ToList();
            var remainingCount = existing.MorePictures.Count - removeIds.Count + (request.MorePictures?.Count ?? 0);
            if (remainingCount > MaxMorePictures)
                return BadRequest(new { message = $"You can have up to {MaxMorePictures} additional photos total." });
            if (request.PriceMax.HasValue && request.PriceMax.Value <= request.Price)
                return BadRequest(new { message = "The high end of the price range must be more than the low end." });

            repo.Update(new GownPosting
            {
                Id = request.Id,
                Description = request.Description,
                Color = request.Color,
                Size = request.Size,
                Price = request.Price,
                PriceMax = request.PriceMax,
                Location = request.Location,
                ListingType = listingType,
                DisplayOwnerName = request.DisplayOwnerName,
                Brand = request.Brand,
                PricePaid = request.PricePaid,
                Condition = request.Condition,
                Length = request.Length,
                StyleTags = request.StyleTags,
                Notes = request.Notes
            });

            if (request.PrimaryPicture != null)
                repo.SetPrimaryPicture(request.Id, await _storage.SaveAsync(request.PrimaryPicture, "gowns"));

            if (removeIds.Count > 0)
                repo.RemovePictures(request.Id, removeIds);

            if (request.MorePictures?.Count > 0)
            {
                var urls = new List<string>();
                foreach (var file in request.MorePictures)
                    urls.Add(await _storage.SaveAsync(file, "gowns"));
                repo.AddPictures(request.Id, urls);
            }

            return Ok();
        }

        [HttpPost("concierge-intake")]
        [Authorize]
        [RequireVerifiedEmail]
        [RequestSizeLimit(100_000_000)]
        public async Task<IActionResult> ConciergeIntake([FromForm] ConciergeIntakeGownRequest request)
        {
            if (request.PrimaryPicture == null) return BadRequest(new { message = "A photo is required." });
            if (string.IsNullOrWhiteSpace(request.Size)) return BadRequest(new { message = "Size is required." });
            if (request.Price <= 0) return BadRequest(new { message = "Price is required." });
            if (string.IsNullOrWhiteSpace(request.Location)) return BadRequest(new { message = "Location is required." });
            if (!Enum.TryParse<ListingType>(request.ListingType, out var listingType)) return BadRequest(new { message = "Rent or sale is required." });
            if (request.BatchId == Guid.Empty) return BadRequest(new { message = "Missing batch identifier." });

            var pricing = PromoCodeCalculator.ResolvePricing(
                _connectionString, request.PromoCode, _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m),
                true, request.BatchSize ?? 1);
            if (!pricing.Success)
                return BadRequest(new { message = pricing.Error });

            var repo = new GownRepository(_connectionString);
            var primaryUrl = await _storage.SaveAsync(request.PrimaryPicture, "gowns");

            var posting = new GownPosting
            {
                OwnerId = CurrentOwnerId(),
                Description = request.Description,
                Color = request.Color,
                Size = request.Size,
                Price = request.Price,
                Location = request.Location,
                ListingType = listingType,
                DisplayOwnerName = request.DisplayOwnerName,
                Brand = request.Brand,
                PricePaid = request.PricePaid,
                Condition = request.Condition,
                Length = request.Length,
                StyleTags = request.StyleTags,
                Notes = request.Notes,
                PrimaryPictureUrl = primaryUrl,
                BatchId = request.BatchId,
                NeedsConciergeDraft = true,
                PromoCodeId = pricing.PromoCodeId,
                MonthlyFeeOverride = pricing.MonthlyFeeOverride,
                PromoDurationMonths = pricing.PromoDurationMonths
            };
            var id = repo.Create(posting);
            return Ok(new { id });
        }

        // Called once by the frontend after the per-gown concierge-intake submission loop
        // finishes, mirroring how PaymentController.ConfirmBatchSetupSession notifies admin
        // once for a whole batch rather than once per gown.
        [HttpPost("concierge-intake/notify")]
        [Authorize]
        [RequireVerifiedEmail]
        public async Task<IActionResult> ConciergeIntakeNotify([FromBody] ConciergeNotifyRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var batch = repo.GetByBatchId(request.BatchId).Where(g => g.OwnerId == CurrentOwnerId()).ToList();
            if (batch.Count == 0) return NotFound();

            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            var baseUrl = string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (!string.IsNullOrEmpty(adminEmail))
            {
                var body = batch.Count > 1
                    ? EmailTemplates.NewSubmissionAdminBatch(batch[0].Owner.Name, batch.Select(g => g.Description).ToList(), $"{baseUrl}/admin", baseUrl)
                    : EmailTemplates.NewSubmissionAdmin("concierge posting request", batch[0].Owner.Name, batch[0].Description, $"{baseUrl}/admin", baseUrl);
                await _emailSender.SendAsync(adminEmail, "New concierge posting request — Regowned", body);
            }

            return Ok();
        }

        [HttpPost("activate-test")]
        [Authorize]
        public IActionResult ActivateTest([FromBody] IdRequest request)
        {
            // Dev-only fallback so the posting -> search flow can be verified before Stripe test keys are configured.
            // Real activation happens via PaymentController.ConfirmSession once Stripe is wired up.
            if (!_env.IsDevelopment()) return NotFound();

            var repo = new GownRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();

            repo.ActivateListing(request.Id, null, null);
            return Ok();
        }

        [HttpPost("cancel")]
        [Authorize]
        public async Task<IActionResult> Cancel([FromBody] IdRequest request)
        {
            var repo = new GownRepository(_connectionString);
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

            repo.CancelListing(request.Id);
            return Ok();
        }

        [HttpPost("marksold")]
        [Authorize]
        public async Task<IActionResult> MarkSold([FromBody] IdRequest request)
        {
            var repo = new GownRepository(_connectionString);
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
                    // subscription may already be canceled on Stripe's side; proceed to mark sold locally
                }
            }

            repo.MarkSold(request.Id);
            return Ok();
        }

        // Sends a Rejected listing back into the review queue after the owner fixes
        // whatever the admin flagged, instead of forcing them to delete it and redraft
        // from scratch. Reuses the Stripe customer/payment method already on file.
        [HttpPost("resubmit")]
        [Authorize]
        public async Task<IActionResult> Resubmit([FromBody] IdRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (existing.OwnerId != CurrentOwnerId()) return Forbid();
            if (existing.ModerationStatus != ModerationStatus.Rejected)
                return BadRequest(new { message = "This listing isn't rejected." });

            repo.ResubmitListing(request.Id);

            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            var baseUrl = string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (!string.IsNullOrEmpty(adminEmail))
            {
                await _emailSender.SendAsync(
                    adminEmail,
                    "Gown resubmitted for review — Regowned",
                    EmailTemplates.NewSubmissionAdmin("gown (resubmitted)", existing.Owner.Name, existing.Description, $"{baseUrl}/admin", baseUrl)
                );
            }

            return Ok();
        }

        [HttpPost("inquire")]
        public IActionResult Inquire([FromBody] IdRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var posting = repo.Get(request.Id);
            if (posting == null || !posting.IsActive) return NotFound();

            repo.IncrementInquiry(request.Id);
            posting.InquiryCount++;

            return Ok(new
            {
                ownerName = posting.DisplayOwnerName ? posting.Owner.Name : null,
                ownerNumber = posting.Owner.Number,
                ownerEmail = posting.Owner.Email,
                location = posting.Location,
                inquiryCount = posting.InquiryCount
            });
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private bool IsCurrentOwner(int ownerId)
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return idClaim != null && int.Parse(idClaim) == ownerId;
        }
    }
}
