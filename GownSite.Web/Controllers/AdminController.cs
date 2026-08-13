using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    public class SendSpreadTheWordRequest
    {
        public List<string> Emails { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;

        public AdminController(IConfiguration configuration, IEmailSender emailSender)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _emailSender = emailSender;
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
            var repo = new OwnerRepository(_connectionString);
            return Ok(repo.GetAll());
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
