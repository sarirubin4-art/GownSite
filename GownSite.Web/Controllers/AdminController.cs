using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace GownSite.Web.Controllers
{
    public class RejectRequest
    {
        public string Reason { get; set; }
    }

    public class SendPromoEmailRequest
    {
        public string Subject { get; set; }
        public string Message { get; set; }
    }

    public class ReplyToContactMessageRequest
    {
        public string Reply { get; set; }
    }

    public class SendSpreadTheWordRequest
    {
        public List<string> Emails { get; set; }
    }

    public class SetBusinessPlanRequest
    {
        public decimal MonthlyFee { get; set; }
        public int GownAllowance { get; set; }
        public decimal? OverageFeePerGown { get; set; }
    }

    // Lets an admin start a gown listing on a patron's behalf — e.g. someone who wants
    // help posting but isn't comfortable filling out the form themselves. By default lands
    // as a Draft (same as the patron's own autosave), so the patron still adds their own
    // card and finishes submitting it via "Complete Setup" in My Listings. If Finalize is
    // set, the admin is comping the listing — it goes live immediately with no Stripe
    // subscription at all, skipping the card/payment step entirely.
    public class AdminCreateGownDraftRequest
    {
        public int OwnerId { get; set; }
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
        public List<IFormFile> MorePictures { get; set; } = new();
        public bool Finalize { get; set; }

        // Concierge/on-site-visit support: BatchId groups gowns drafted in one admin
        // session (always set by the frontend now, even for a single gown, so this gown
        // is excluded from ApproveGown's automatic solo setup fee). OneTimeFeeUsd is the
        // on-site visit's hourly charge, applied to just the first gown of the session.
        public Guid? BatchId { get; set; }
        public int? BatchSize { get; set; }
        public decimal? OneTimeFeeUsd { get; set; }

        // Only meaningful when Finalize is false — a comped listing has no Stripe
        // subscription for a promo to discount.
        public string PromoCode { get; set; }
    }

    public class ConciergeFeeEntry
    {
        public int Id { get; set; }
        public decimal OneTimeFeeUsd { get; set; }
    }

    public class MarkConciergeReadyRequest
    {
        public List<ConciergeFeeEntry> Fees { get; set; } = new();
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;
        private readonly IFileStorageService _storage;

        public AdminController(IConfiguration configuration, IEmailSender emailSender, IFileStorageService storage)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _emailSender = emailSender;
            _storage = storage;
        }

        private string FrontendBaseUrl()
        {
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            return string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
        }

        // Creates a fresh Stripe Price (with an inline ad-hoc Product) for the resolved
        // monthly amount. Subscriptions created via the API — unlike Checkout Sessions —
        // require a real Price/Product reference, not inline price_data on the item itself,
        // so this is the simplest way to keep supporting a per-listing (promo-adjusted) amount.
        private static async Task<string> CreateMonthlyPriceAsync(decimal amountUsd, string productName)
        {
            var price = await new PriceService().CreateAsync(new PriceCreateOptions
            {
                Currency = "usd",
                UnitAmountDecimal = amountUsd * 100,
                Recurring = new PriceRecurringOptions { Interval = "month" },
                ProductData = new PriceProductDataOptions { Name = productName }
            });
            return price.Id;
        }

        // Creates the subscription that actually charges the customer going forward.
        // For an ordinary (non-duration) promo, this is unchanged: a Price at the
        // resolved amount, billed forever. For a duration-limited promo (e.g. "free
        // for 3 months" or "50% off for 3 months"), the Price is set at the FULL fee
        // — since that's what billing reverts to — and the discount is layered on top
        // via Stripe's own trial (fully free) or a repeating coupon (partially off),
        // so Stripe automatically reverts to full price after the window closes.
        private static async Task<Subscription> CreatePromoAwareSubscriptionAsync(
            string customerId, string paymentMethodId, decimal fullFeeUsd,
            decimal? monthlyFeeOverride, int? promoDurationMonths, string productName)
        {
            var hasDuration = promoDurationMonths.HasValue && promoDurationMonths.Value > 0;
            var promoAmount = monthlyFeeOverride ?? fullFeeUsd;
            var subscriptionAmount = hasDuration ? fullFeeUsd : promoAmount;

            var priceId = await CreateMonthlyPriceAsync(subscriptionAmount, productName);
            var options = new SubscriptionCreateOptions
            {
                Customer = customerId,
                DefaultPaymentMethod = paymentMethodId,
                Items = new List<SubscriptionItemOptions> { new() { Price = priceId } },
                PaymentBehavior = "error_if_incomplete"
            };

            if (hasDuration)
            {
                if (promoAmount <= 0)
                {
                    options.TrialPeriodDays = promoDurationMonths!.Value * 30;
                }
                else
                {
                    var percentOff = (1 - (promoAmount / fullFeeUsd)) * 100m;
                    var coupon = await new CouponService().CreateAsync(new CouponCreateOptions
                    {
                        PercentOff = percentOff,
                        Duration = "repeating",
                        DurationInMonths = promoDurationMonths!.Value
                    });
                    options.Discounts = new List<SubscriptionDiscountOptions>
                    {
                        new() { Coupon = coupon.Id }
                    };
                }
            }

            return await new SubscriptionService().CreateAsync(options);
        }

        [HttpGet("gowns/pending")]
        public IActionResult GetPendingGowns()
        {
            var repo = new GownRepository(_connectionString);
            return Ok(repo.GetPendingReview());
        }

        [HttpPost("gowns/{id}/approve")]
        public async Task<IActionResult> ApproveGown(int id)
        {
            var repo = new GownRepository(_connectionString);
            var posting = repo.Get(id);
            if (posting == null) return NotFound();
            if (posting.ModerationStatus != ModerationStatus.PendingReview)
                return BadRequest(new { message = "This listing is no longer pending review." });

            // A business-plan owner's flat monthly fee already covers this gown — no
            // per-gown Stripe subscription, setup fee, or card requirement, it just goes
            // live for free against their plan's allowance.
            if (posting.Owner.IsBusinessAccount)
            {
                repo.ApproveListing(id, null);
            }
            else
            {
                if (string.IsNullOrEmpty(posting.StripeCustomerId) || string.IsNullOrEmpty(posting.StripePaymentMethodId))
                    return BadRequest(new { message = "No payment method on file for this listing." });

                var feeUsd = _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m);

                // A solo listing (not part of a batch) with no promo/tier applied gets a one-time
                // setup fee added to its first invoice, so the first bill is (base + setup) and
                // every bill after is just the base monthly fee. Batches already get their own
                // discounted per-gown rate and skip this; promo'd listings are unaffected too.
                var isSoloDefaultPricing = !posting.BatchId.HasValue && !posting.MonthlyFeeOverride.HasValue;
                var setupFeeUsd = _configuration.GetValue<decimal>("Stripe:GownPostingSetupFeeUsd", 0m);
                if (isSoloDefaultPricing && setupFeeUsd > 0)
                {
                    try
                    {
                        await new InvoiceItemService().CreateAsync(new InvoiceItemCreateOptions
                        {
                            Customer = posting.StripeCustomerId,
                            Amount = (long)Math.Round(setupFeeUsd * 100, MidpointRounding.AwayFromZero),
                            Currency = "usd",
                            Description = "Regowned One-Time Listing Setup Fee"
                        });
                    }
                    catch (StripeException ex)
                    {
                        return BadRequest(new { message = $"Payment could not be processed: {ex.Message}" });
                    }
                }

                // Concierge posting / on-site business visit fee — a one-time charge riding
                // on this gown's Stripe customer, exactly like the setup fee above just with
                // its own amount/description. BatchId is always set on concierge/on-site
                // gowns, so isSoloDefaultPricing above is already false for them and the
                // standard setup fee never also fires.
                if (posting.OneTimeFeeUsd.HasValue && posting.OneTimeFeeUsd.Value > 0)
                {
                    try
                    {
                        await new InvoiceItemService().CreateAsync(new InvoiceItemCreateOptions
                        {
                            Customer = posting.StripeCustomerId,
                            Amount = (long)Math.Round(posting.OneTimeFeeUsd.Value * 100, MidpointRounding.AwayFromZero),
                            Currency = "usd",
                            Description = "Regowned One-Time Concierge/Visit Service Fee"
                        });
                    }
                    catch (StripeException ex)
                    {
                        return BadRequest(new { message = $"Payment could not be processed: {ex.Message}" });
                    }
                }

                Subscription subscription;
                try
                {
                    subscription = await CreatePromoAwareSubscriptionAsync(
                        posting.StripeCustomerId, posting.StripePaymentMethodId, feeUsd,
                        posting.MonthlyFeeOverride, posting.PromoDurationMonths, "Regowned Monthly Listing Fee");
                }
                catch (StripeException ex)
                {
                    return BadRequest(new { message = $"Payment could not be processed: {ex.Message}" });
                }

                repo.ApproveListing(id, subscription.Id);

                if (posting.PromoCodeId.HasValue)
                {
                    new PromoCodeRepository(_connectionString).IncrementUsage(posting.PromoCodeId.Value);
                }
            }

            var frontendBaseUrl = FrontendBaseUrl();
            await _emailSender.SendAsync(
                posting.Owner.Email,
                "Your gown listing is approved — Regowned",
                EmailTemplates.Approved("gown listing", $"{frontendBaseUrl}/gown/{id}", frontendBaseUrl)
            );

            var alertMatcher = new AlertMatchingService(_connectionString, _emailSender);
            await alertMatcher.MatchAndNotifyAsync(posting, frontendBaseUrl);

            return Ok();
        }

        [HttpPost("gowns/{id}/reject")]
        public async Task<IActionResult> RejectGown(int id, [FromBody] RejectRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var posting = repo.Get(id);
            if (posting == null) return NotFound();
            if (posting.ModerationStatus != ModerationStatus.PendingReview)
                return BadRequest(new { message = "This listing is no longer pending review." });

            repo.RejectListing(id, request.Reason);

            await _emailSender.SendAsync(
                posting.Owner.Email,
                "About your gown submission — Regowned",
                EmailTemplates.Rejected("gown listing", request.Reason, FrontendBaseUrl())
            );

            return Ok();
        }

        [HttpGet("gowns/active")]
        public IActionResult GetActiveGowns()
        {
            var repo = new GownRepository(_connectionString);
            return Ok(repo.GetActive());
        }

        [HttpPost("gowns/{id}/takedown")]
        public async Task<IActionResult> TakeDownGown(int id, [FromBody] RejectRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var posting = repo.Get(id);
            if (posting == null) return NotFound();
            if (!posting.IsActive)
                return BadRequest(new { message = "This listing isn't currently live." });

            if (!string.IsNullOrEmpty(posting.StripeSubscriptionId))
            {
                try
                {
                    await new SubscriptionService().CancelAsync(posting.StripeSubscriptionId);
                }
                catch (StripeException)
                {
                    // subscription may already be canceled on Stripe's side; proceed to take it down locally
                }
            }

            repo.TakeDown(id, request.Reason);

            await _emailSender.SendAsync(
                posting.Owner.Email,
                "Your gown listing has been taken down — Regowned",
                EmailTemplates.Removed("gown listing", request.Reason, FrontendBaseUrl())
            );

            return Ok();
        }

        // Lets an admin correct a live listing directly (a typo, a price fix, added
        // photos) without going through the patron. Reuses the same GownRepository
        // update path as the patron-facing edit, just without the owner-match check.
        [HttpPost("gowns/edit")]
        [RequestSizeLimit(100_000_000)]
        public async Task<IActionResult> EditGown([FromForm] EditGownRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var existing = repo.Get(request.Id);
            if (existing == null) return NotFound();
            if (!Enum.TryParse<ListingType>(request.ListingType, out var listingType))
                return BadRequest(new { message = "ListingType must be 'Rent' or 'Sale'." });
            var removeIds = existing.MorePictures.Select(p => p.Id).Intersect(request.RemovePictureIds ?? new List<int>()).ToList();
            var remainingCount = existing.MorePictures.Count - removeIds.Count + (request.MorePictures?.Count ?? 0);
            if (remainingCount > GownController.MaxMorePictures)
                return BadRequest(new { message = $"You can have up to {GownController.MaxMorePictures} additional photos total." });
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

        [HttpGet("ads/pending")]
        public IActionResult GetPendingAds()
        {
            var repo = new AdRepository(_connectionString);
            return Ok(repo.GetPendingReview());
        }

        [HttpPost("ads/{id}/approve")]
        public async Task<IActionResult> ApproveAd(int id)
        {
            var repo = new AdRepository(_connectionString);
            var ad = repo.Get(id);
            if (ad == null) return NotFound();
            if (ad.ModerationStatus != ModerationStatus.PendingReview)
                return BadRequest(new { message = "This ad is no longer pending review." });
            if (string.IsNullOrEmpty(ad.StripeCustomerId) || string.IsNullOrEmpty(ad.StripePaymentMethodId))
                return BadRequest(new { message = "No payment method on file for this ad." });

            var feeUsd = _configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m);

            Subscription subscription;
            try
            {
                subscription = await CreatePromoAwareSubscriptionAsync(
                    ad.StripeCustomerId, ad.StripePaymentMethodId, feeUsd,
                    ad.MonthlyFeeOverride, ad.PromoDurationMonths, "Regowned Monthly Ad Placement");
            }
            catch (StripeException ex)
            {
                return BadRequest(new { message = $"Payment could not be processed: {ex.Message}" });
            }

            repo.ApproveAd(id, subscription.Id);

            if (ad.PromoCodeId.HasValue)
            {
                new PromoCodeRepository(_connectionString).IncrementUsage(ad.PromoCodeId.Value);
            }

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(ad.OwnerId ?? 0);
            if (owner != null)
            {
                await _emailSender.SendAsync(
                    owner.Email,
                    "Your ad is approved — Regowned",
                    EmailTemplates.Approved("ad", $"{FrontendBaseUrl()}/ad/{id}", FrontendBaseUrl())
                );
            }

            return Ok();
        }

        [HttpPost("ads/{id}/reject")]
        public async Task<IActionResult> RejectAd(int id, [FromBody] RejectRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var ad = repo.Get(id);
            if (ad == null) return NotFound();
            if (ad.ModerationStatus != ModerationStatus.PendingReview)
                return BadRequest(new { message = "This ad is no longer pending review." });

            repo.RejectAd(id, request.Reason);

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(ad.OwnerId ?? 0);
            if (owner != null)
            {
                await _emailSender.SendAsync(
                    owner.Email,
                    "About your ad submission — Regowned",
                    EmailTemplates.Rejected("ad", request.Reason, FrontendBaseUrl())
                );
            }

            return Ok();
        }

        [HttpGet("ads/active")]
        public IActionResult GetActiveAds()
        {
            var repo = new AdRepository(_connectionString);
            return Ok(repo.GetActiveForAdmin());
        }

        [HttpPost("ads/{id}/takedown")]
        public async Task<IActionResult> TakeDownAd(int id, [FromBody] RejectRequest request)
        {
            var repo = new AdRepository(_connectionString);
            var ad = repo.Get(id);
            if (ad == null) return NotFound();
            if (!ad.IsActive)
                return BadRequest(new { message = "This ad isn't currently live." });

            if (!string.IsNullOrEmpty(ad.StripeSubscriptionId))
            {
                try
                {
                    await new SubscriptionService().CancelAsync(ad.StripeSubscriptionId);
                }
                catch (StripeException)
                {
                    // subscription may already be canceled on Stripe's side; proceed to take it down locally
                }
            }

            repo.TakeDown(id, request.Reason);

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(ad.OwnerId ?? 0);
            if (owner != null)
            {
                await _emailSender.SendAsync(
                    owner.Email,
                    "Your ad has been taken down — Regowned",
                    EmailTemplates.Removed("ad", request.Reason, FrontendBaseUrl())
                );
            }

            return Ok();
        }

        [HttpGet("promocodes")]
        public IActionResult GetPromoCodes()
        {
            var repo = new PromoCodeRepository(_connectionString);
            return Ok(repo.GetAll());
        }

        [HttpGet("owners")]
        public IActionResult GetOwners()
        {
            var ownerRepo = new OwnerRepository(_connectionString);
            var gownRepo = new GownRepository(_connectionString);
            var owners = ownerRepo.GetAll().Select(o => new
            {
                o.Id,
                o.Name,
                o.Email,
                o.Number,
                o.IsAdmin,
                o.EmailVerified,
                o.IsBusinessAccount,
                o.BusinessMonthlyFeeUsd,
                o.BusinessGownAllowance,
                o.BusinessOverageFeePerGownUsd,
                BusinessBillingComplete = !string.IsNullOrEmpty(o.BusinessStripeSubscriptionId),
                ActiveGownCount = o.IsBusinessAccount ? gownRepo.CountActiveByOwner(o.Id) : (int?)null
            });
            return Ok(owners);
        }

        [HttpPost("owners/{id}/business-plan")]
        public IActionResult SetBusinessPlan(int id, [FromBody] SetBusinessPlanRequest request)
        {
            if (request.MonthlyFee <= 0 || request.GownAllowance <= 0)
                return BadRequest(new { message = "Monthly fee and gown allowance must be greater than zero." });

            var repo = new OwnerRepository(_connectionString);
            if (!repo.SetBusinessPlan(id, request.MonthlyFee, request.GownAllowance, request.OverageFeePerGown))
                return NotFound();
            return Ok();
        }

        [HttpPost("owners/{id}/business-plan/remove")]
        public IActionResult RemoveBusinessPlan(int id)
        {
            var repo = new OwnerRepository(_connectionString);
            if (!repo.RemoveBusinessPlan(id)) return NotFound();
            return Ok();
        }

        [HttpPost("owners/{id}/delete")]
        public IActionResult DeleteOwner(int id)
        {
            var repo = new OwnerRepository(_connectionString);
            try
            {
                var deleted = repo.Delete(id);
                if (!deleted) return NotFound();
                return Ok();
            }
            catch (DbUpdateException)
            {
                // FK relationships to gowns/ads are Restrict — this patron has postings on record.
                return BadRequest(new { message = "This patron has gowns or ads on record and can't be deleted. Remove those first." });
            }
        }

        [HttpPost("gowns/post-for-patron")]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> PostGownForPatron([FromForm] AdminCreateGownDraftRequest request)
        {
            var ownerRepo = new OwnerRepository(_connectionString);
            if (ownerRepo.Get(request.OwnerId) == null) return NotFound(new { message = "Patron not found." });

            var listingTypeValid = Enum.TryParse<ListingType>(request.ListingType, out var listingType);

            if (request.MorePictures?.Count > GownController.MaxMorePictures)
                return BadRequest(new { message = $"You can upload up to {GownController.MaxMorePictures} additional photos." });
            if (request.PriceMax.HasValue && request.Price.HasValue && request.PriceMax.Value <= request.Price.Value)
                return BadRequest(new { message = "The high end of the price range must be more than the low end." });

            if (request.Finalize)
            {
                // Comping a listing live skips the card/subscription step entirely, so it
                // needs to already look like a real listing — same required fields a patron's
                // own form enforces before it'll let them submit. Drafts stay zero-validation.
                if (string.IsNullOrWhiteSpace(request.Description) || string.IsNullOrWhiteSpace(request.Color) ||
                    string.IsNullOrWhiteSpace(request.Size) || !request.Price.HasValue || request.Price.Value <= 0 ||
                    string.IsNullOrWhiteSpace(request.Location) || !listingTypeValid)
                    return BadRequest(new { message = "Description, color, size, price, location, and rent/sale are required to publish immediately." });
                if (request.PrimaryPicture == null)
                    return BadRequest(new { message = "A primary picture is required to publish immediately." });
            }

            // Finalize comps the listing live with no Stripe subscription at all, so a
            // promo/volume rate would have nothing to apply to — only resolve one otherwise.
            var pricing = request.Finalize
                ? new PromoCodeCalculator.PricingResolveResult { Success = true }
                : PromoCodeCalculator.ResolvePricing(
                    _connectionString, request.PromoCode, _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m),
                    request.BatchId.HasValue, request.BatchSize ?? 1);
            if (!pricing.Success)
                return BadRequest(new { message = pricing.Error });

            string primaryUrl = null;
            if (request.PrimaryPicture != null)
                primaryUrl = await _storage.SaveAsync(request.PrimaryPicture, "gowns");

            var repo = new GownRepository(_connectionString);
            var posting = new GownPosting
            {
                OwnerId = request.OwnerId,
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
                PrimaryPictureUrl = primaryUrl,
                BatchId = request.BatchId,
                OneTimeFeeUsd = request.OneTimeFeeUsd,
                PromoCodeId = pricing.PromoCodeId,
                MonthlyFeeOverride = pricing.MonthlyFeeOverride,
                PromoDurationMonths = pricing.PromoDurationMonths
            };
            var id = repo.Create(posting);

            if (request.MorePictures?.Count > 0)
            {
                var moreUrls = new List<string>();
                foreach (var file in request.MorePictures)
                    moreUrls.Add(await _storage.SaveAsync(file, "gowns"));
                repo.AddPictures(id, moreUrls);
            }

            if (request.Finalize)
                repo.ActivateListing(id, null, null);
            return Ok(new { id, finalized = request.Finalize });
        }

        [HttpGet("concierge/queue")]
        public IActionResult GetConciergeQueue()
        {
            var repo = new GownRepository(_connectionString);
            return Ok(repo.GetConciergeQueue());
        }

        [HttpPost("concierge/{batchId}/mark-ready")]
        public async Task<IActionResult> MarkConciergeReady(Guid batchId, [FromBody] MarkConciergeReadyRequest request)
        {
            var repo = new GownRepository(_connectionString);
            var batch = repo.GetByBatchId(batchId);
            if (batch.Count == 0) return NotFound();

            var batchIds = batch.Select(g => g.Id).ToHashSet();
            foreach (var entry in request.Fees.Where(f => batchIds.Contains(f.Id)))
                repo.MarkConciergeReady(entry.Id, entry.OneTimeFeeUsd);

            var owner = batch[0].Owner;
            await _emailSender.SendAsync(
                owner.Email,
                "Your concierge draft is ready to review — Regowned",
                EmailTemplates.ConciergeDraftReady(owner.Name, batch.Count, $"{FrontendBaseUrl()}/mylistings", FrontendBaseUrl())
            );

            return Ok();
        }

        [HttpPost("email/promo")]
        public async Task<IActionResult> SendPromoEmail([FromBody] SendPromoEmailRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { message = "Subject and message are required." });

            var frontendBaseUrl = FrontendBaseUrl();
            var body = EmailTemplates.Promotional(request.Message, frontendBaseUrl);
            var owners = new OwnerRepository(_connectionString).GetAll();

            var sent = 0;
            foreach (var recipient in owners)
            {
                try
                {
                    await _emailSender.SendAsync(recipient.Email, request.Subject, body);
                    sent++;
                }
                catch
                {
                    // one failed send shouldn't block the rest of the blast
                }
            }

            return Ok(new { sent, total = owners.Count });
        }

        [HttpPost("email/spread-the-word")]
        public async Task<IActionResult> SendSpreadTheWordEmail([FromBody] SendSpreadTheWordRequest request)
        {
            var emails = (request.Emails ?? new List<string>())
                .Select(e => e.Trim())
                .Where(e => !string.IsNullOrEmpty(e))
                .Distinct()
                .ToList();
            if (emails.Count == 0)
                return BadRequest(new { message = "Enter at least one email address." });

            var frontendBaseUrl = FrontendBaseUrl();
            var body = EmailTemplates.SpreadTheWord(frontendBaseUrl);

            var sent = 0;
            foreach (var email in emails)
            {
                try
                {
                    await _emailSender.SendAsync(email, "Have you heard about Regowned?", body);
                    sent++;
                }
                catch
                {
                    // one failed send shouldn't block the rest of the batch
                }
            }

            return Ok(new { sent, total = emails.Count });
        }

        [HttpPost("promocodes/create")]
        public IActionResult CreatePromoCode([FromBody] PromoCode request)
        {
            if (string.IsNullOrWhiteSpace(request.Code))
                return BadRequest(new { message = "A code is required." });

            var repo = new PromoCodeRepository(_connectionString);
            if (repo.GetByCode(request.Code) != null)
                return BadRequest(new { message = "A promo code with that name already exists." });

            var created = repo.Create(new PromoCode
            {
                Code = request.Code,
                DiscountType = request.DiscountType,
                DiscountValue = request.DiscountValue,
                IsActive = true,
                MaxUses = request.MaxUses,
                ExpiresAt = request.ExpiresAt,
                DurationMonths = request.DurationMonths
            });
            return Ok(created);
        }

        [HttpPost("promocodes/{id}/edit")]
        public IActionResult EditPromoCode(int id, [FromBody] PromoCode request)
        {
            if (string.IsNullOrWhiteSpace(request.Code))
                return BadRequest(new { message = "A code is required." });

            var repo = new PromoCodeRepository(_connectionString);
            var existingWithCode = repo.GetByCode(request.Code);
            if (existingWithCode != null && existingWithCode.Id != id)
                return BadRequest(new { message = "A promo code with that name already exists." });

            repo.Update(new PromoCode
            {
                Id = id,
                Code = request.Code,
                DiscountType = request.DiscountType,
                DiscountValue = request.DiscountValue,
                MaxUses = request.MaxUses,
                ExpiresAt = request.ExpiresAt,
                DurationMonths = request.DurationMonths
            });
            return Ok();
        }

        [HttpGet("contact-messages")]
        public IActionResult GetContactMessages()
        {
            var repo = new ContactMessageRepository(_connectionString);
            return Ok(repo.GetOpen());
        }

        [HttpGet("contact-messages/resolved")]
        public IActionResult GetResolvedContactMessages(int page = 1, int pageSize = 20)
        {
            var repo = new ContactMessageRepository(_connectionString);
            return Ok(new
            {
                items = repo.GetResolvedPage(page, pageSize),
                totalCount = repo.CountResolved()
            });
        }

        [HttpPost("contact-messages/{id}/reply")]
        public async Task<IActionResult> ReplyToContactMessage(int id, [FromBody] ReplyToContactMessageRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Reply))
                return BadRequest(new { message = "Please enter a reply." });

            var repo = new ContactMessageRepository(_connectionString);
            var contactMessage = repo.Get(id);
            if (contactMessage == null) return NotFound();

            repo.Reply(id, request.Reply);

            await _emailSender.SendAsync(
                contactMessage.Owner.Email,
                "Reply from Regowned",
                EmailTemplates.ContactReply(contactMessage.Topic, contactMessage.Message, request.Reply, FrontendBaseUrl())
            );

            return Ok();
        }

        [HttpPost("contact-messages/{id}/resolve")]
        public IActionResult ResolveContactMessage(int id)
        {
            var repo = new ContactMessageRepository(_connectionString);
            if (!repo.Resolve(id)) return NotFound();
            return Ok();
        }

        [HttpPost("promocodes/{id}/toggle")]
        public IActionResult TogglePromoCode(int id, [FromBody] TogglePromoRequest request)
        {
            var repo = new PromoCodeRepository(_connectionString);
            repo.SetActive(id, request.IsActive);
            return Ok();
        }
    }

    public class TogglePromoRequest
    {
        public bool IsActive { get; set; }
    }
}
