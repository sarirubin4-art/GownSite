using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;
using System.Linq;
using System.Security.Claims;

namespace GownSite.Web.Controllers
{
    public class CreateCheckoutSessionRequest
    {
        public int GownPostingId { get; set; }
    }

    public class ConfirmSessionRequest
    {
        public string SessionId { get; set; }
    }

    public class CreateAdCheckoutSessionRequest
    {
        public int AdId { get; set; }
    }

    public class CreateBatchSetupSessionRequest
    {
        public List<int> GownPostingIds { get; set; } = new();
    }

    public class PricingResponse
    {
        public decimal GownMonthlyFee { get; set; }
        public decimal AdMonthlyFee { get; set; }
    }

    public class ApplyPromoRequest
    {
        public int Id { get; set; }
        public string PromoCode { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PaymentController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;

        public PaymentController(IConfiguration configuration, IEmailSender emailSender)
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

        [HttpGet("pricing")]
        public IActionResult Pricing()
        {
            return Ok(new PricingResponse
            {
                GownMonthlyFee = _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m),
                AdMonthlyFee = _configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m)
            });
        }

        // Attaches a discount to an ALREADY-RUNNING subscription. Unlike CreatePromoAwareSubscriptionAsync
        // (used at initial approval, which can use a Stripe trial for a 100%-off period), a trial can only be
        // set when a subscription is first created — so here we always use a Coupon, with "forever" duration
        // for a lifetime discount or "repeating" for a limited number of months. Passing a single-item
        // Discounts list REPLACES any discount already on the subscription rather than stacking with it, and
        // Stripe applies the change starting with the next invoice — the current billing period is untouched.
        private static async Task ApplyPromoToSubscriptionAsync(string subscriptionId, decimal fullFeeUsd, decimal resolvedFee, int? durationMonths)
        {
            var percentOff = Math.Max(0m, (1 - (resolvedFee / fullFeeUsd)) * 100m);
            if (percentOff <= 0)
            {
                await new SubscriptionService().UpdateAsync(subscriptionId, new SubscriptionUpdateOptions
                {
                    Discounts = new List<SubscriptionDiscountOptions>()
                });
                return;
            }

            var hasDuration = durationMonths.HasValue && durationMonths.Value > 0;
            var couponOptions = new CouponCreateOptions
            {
                PercentOff = percentOff,
                Duration = hasDuration ? "repeating" : "forever"
            };
            if (hasDuration) couponOptions.DurationInMonths = durationMonths!.Value;

            var coupon = await new CouponService().CreateAsync(couponOptions);
            await new SubscriptionService().UpdateAsync(subscriptionId, new SubscriptionUpdateOptions
            {
                Discounts = new List<SubscriptionDiscountOptions> { new() { Coupon = coupon.Id } }
            });
        }

        [HttpPost("apply-gown-promo")]
        public async Task<IActionResult> ApplyGownPromo([FromBody] ApplyPromoRequest request)
        {
            var gownRepo = new GownRepository(_connectionString);
            var posting = gownRepo.Get(request.Id);
            if (posting == null) return NotFound();
            if (posting.OwnerId != CurrentOwnerId()) return Forbid();
            if (!posting.IsActive || string.IsNullOrEmpty(posting.StripeSubscriptionId))
                return BadRequest(new { message = "This listing doesn't have an active subscription to apply a promo to." });

            var promoRepo = new PromoCodeRepository(_connectionString);
            var promo = promoRepo.GetByCode(request.PromoCode);
            var feeUsd = _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m);
            var resolved = PromoCodeCalculator.Resolve(promo, feeUsd, 1);
            if (!resolved.Success)
                return BadRequest(new { message = resolved.Error });

            try
            {
                await ApplyPromoToSubscriptionAsync(posting.StripeSubscriptionId, feeUsd, resolved.ResolvedFee!.Value, resolved.DurationMonths);
            }
            catch (StripeException ex)
            {
                return BadRequest(new { message = $"Could not apply promo: {ex.Message}" });
            }

            gownRepo.ApplyPromo(request.Id, promo.Id, resolved.ResolvedFee, resolved.DurationMonths);
            promoRepo.IncrementUsage(promo.Id);

            return Ok();
        }

        [HttpPost("apply-ad-promo")]
        public async Task<IActionResult> ApplyAdPromo([FromBody] ApplyPromoRequest request)
        {
            var adRepo = new AdRepository(_connectionString);
            var ad = adRepo.Get(request.Id);
            if (ad == null) return NotFound();
            if (ad.OwnerId != CurrentOwnerId()) return Forbid();
            if (!ad.IsActive || string.IsNullOrEmpty(ad.StripeSubscriptionId))
                return BadRequest(new { message = "This ad doesn't have an active subscription to apply a promo to." });

            var promoRepo = new PromoCodeRepository(_connectionString);
            var promo = promoRepo.GetByCode(request.PromoCode);
            var feeUsd = _configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m);
            var resolved = PromoCodeCalculator.Resolve(promo, feeUsd, 1);
            if (!resolved.Success)
                return BadRequest(new { message = resolved.Error });

            try
            {
                await ApplyPromoToSubscriptionAsync(ad.StripeSubscriptionId, feeUsd, resolved.ResolvedFee!.Value, resolved.DurationMonths);
            }
            catch (StripeException ex)
            {
                return BadRequest(new { message = $"Could not apply promo: {ex.Message}" });
            }

            adRepo.ApplyPromo(request.Id, promo.Id, resolved.ResolvedFee, resolved.DurationMonths);
            promoRepo.IncrementUsage(promo.Id);

            return Ok();
        }

        [HttpPost("create-checkout-session")]
        public IActionResult CreateCheckoutSession([FromBody] CreateCheckoutSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet. Add your Stripe test keys to appsettings.Development.json to enable payment." });

            var gownRepo = new GownRepository(_connectionString);
            var posting = gownRepo.Get(request.GownPostingId);
            if (posting == null) return NotFound();
            if (posting.OwnerId != CurrentOwnerId()) return Forbid();

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(posting.OwnerId);

            var feeUsd = _configuration.GetValue<decimal>("Stripe:MonthlyListingFeeUsd", 9.99m);
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            if (string.IsNullOrEmpty(frontendBaseUrl))
                frontendBaseUrl = $"{Request.Scheme}://{Request.Host}";

            var options = new SessionCreateOptions
            {
                Mode = "subscription",
                CustomerEmail = owner.Email,
                LineItems = new List<SessionLineItemOptions>
                {
                    new()
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            UnitAmountDecimal = feeUsd * 100,
                            Recurring = new SessionLineItemPriceDataRecurringOptions { Interval = "month" },
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = "Regowned Monthly Listing Fee",
                                Description = posting.Description
                            }
                        }
                    }
                },
                SuccessUrl = $"{frontendBaseUrl}/paymentsuccess?session_id={{CHECKOUT_SESSION_ID}}&postingId={posting.Id}",
                CancelUrl = $"{frontendBaseUrl}/postagown/payment/{posting.Id}?canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "postingId", posting.Id.ToString() },
                    { "ownerId", posting.OwnerId.ToString() }
                }
            };

            var session = new SessionService().Create(options);
            return Ok(new { url = session.Url });
        }

        [HttpPost("confirm-session")]
        public async Task<IActionResult> ConfirmSession([FromBody] ConfirmSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var session = await new SessionService().GetAsync(request.SessionId);
            if (session == null || session.PaymentStatus != "paid" && session.Status != "complete")
                return BadRequest(new { message = "Payment was not completed." });

            if (!session.Metadata.TryGetValue("postingId", out var postingIdStr) || !int.TryParse(postingIdStr, out var postingId))
                return BadRequest(new { message = "Could not identify the listing for this payment." });

            var gownRepo = new GownRepository(_connectionString);
            var posting = gownRepo.Get(postingId);
            if (posting == null) return NotFound();
            if (posting.OwnerId != CurrentOwnerId()) return Forbid();

            gownRepo.ActivateListing(postingId, session.SubscriptionId, session.CustomerId);
            return Ok(new { postingId });
        }

        [HttpPost("create-setup-session")]
        public async Task<IActionResult> CreateSetupSession([FromBody] CreateCheckoutSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet. Add your Stripe test keys to appsettings.Development.json to enable payment." });

            var gownRepo = new GownRepository(_connectionString);
            var posting = gownRepo.Get(request.GownPostingId);
            if (posting == null) return NotFound();
            if (posting.OwnerId != CurrentOwnerId()) return Forbid();

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(posting.OwnerId);

            var customer = await new CustomerService().CreateAsync(new CustomerCreateOptions
            {
                Email = owner.Email,
                Name = owner.Name
            });

            var frontendBaseUrl = FrontendBaseUrl();
            var options = new SessionCreateOptions
            {
                Mode = "setup",
                Currency = "usd",
                Customer = customer.Id,
                SuccessUrl = $"{frontendBaseUrl}/postagown/setup-success?session_id={{CHECKOUT_SESSION_ID}}&postingId={posting.Id}",
                CancelUrl = $"{frontendBaseUrl}/postagown/payment-setup/{posting.Id}?canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "postingId", posting.Id.ToString() },
                    { "ownerId", posting.OwnerId.ToString() }
                }
            };

            var session = await new SessionService().CreateAsync(options);
            return Ok(new { url = session.Url });
        }

        [HttpPost("confirm-setup-session")]
        public async Task<IActionResult> ConfirmSetupSession([FromBody] ConfirmSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var session = await new SessionService().GetAsync(request.SessionId);
            if (session == null || session.Status != "complete")
                return BadRequest(new { message = "Card setup was not completed." });

            if (!session.Metadata.TryGetValue("postingId", out var postingIdStr) || !int.TryParse(postingIdStr, out var postingId))
                return BadRequest(new { message = "Could not identify the listing for this submission." });

            var gownRepo = new GownRepository(_connectionString);
            var posting = gownRepo.Get(postingId);
            if (posting == null) return NotFound();
            if (posting.OwnerId != CurrentOwnerId()) return Forbid();

            var setupIntent = await new SetupIntentService().GetAsync(session.SetupIntentId);
            gownRepo.SubmitForReview(postingId, session.CustomerId, setupIntent.PaymentMethodId);

            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (!string.IsNullOrEmpty(adminEmail))
            {
                await _emailSender.SendAsync(
                    adminEmail,
                    "New gown submitted for review — Regowned",
                    EmailTemplates.NewSubmissionAdmin("gown", posting.Owner.Name, posting.Description, $"{FrontendBaseUrl()}/admin", FrontendBaseUrl())
                );
            }

            return Ok(new { postingId });
        }

        [HttpPost("create-batch-setup-session")]
        public async Task<IActionResult> CreateBatchSetupSession([FromBody] CreateBatchSetupSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet. Add your Stripe test keys to appsettings.Development.json to enable payment." });

            var ids = (request.GownPostingIds ?? new List<int>()).Distinct().ToList();
            if (ids.Count == 0)
                return BadRequest(new { message = "No gowns to submit." });
            if (ids.Count > GownController.MaxBatchGowns)
                return BadRequest(new { message = $"You can submit up to {GownController.MaxBatchGowns} gowns at a time." });

            var gownRepo = new GownRepository(_connectionString);
            var postings = new List<GownPosting>();
            foreach (var id in ids)
            {
                var posting = gownRepo.Get(id);
                if (posting == null) return NotFound(new { message = $"Listing {id} was not found." });
                if (posting.OwnerId != CurrentOwnerId()) return Forbid();
                if (posting.ModerationStatus != ModerationStatus.Draft)
                    return BadRequest(new { message = $"Listing {id} has already been submitted." });
                postings.Add(posting);
            }

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(CurrentOwnerId());

            var customer = await new CustomerService().CreateAsync(new CustomerCreateOptions
            {
                Email = owner.Email,
                Name = owner.Name
            });

            var frontendBaseUrl = FrontendBaseUrl();
            var idsCsv = string.Join(",", ids);
            var options = new SessionCreateOptions
            {
                Mode = "setup",
                Currency = "usd",
                Customer = customer.Id,
                SuccessUrl = $"{frontendBaseUrl}/postagown/bulk-setup-success?session_id={{CHECKOUT_SESSION_ID}}",
                CancelUrl = $"{frontendBaseUrl}/postagown/bulk-payment-setup?ids={idsCsv}&canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "postingIds", idsCsv },
                    { "ownerId", CurrentOwnerId().ToString() }
                }
            };

            var session = await new SessionService().CreateAsync(options);
            return Ok(new { url = session.Url });
        }

        [HttpPost("confirm-batch-setup-session")]
        public async Task<IActionResult> ConfirmBatchSetupSession([FromBody] ConfirmSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var session = await new SessionService().GetAsync(request.SessionId);
            if (session == null || session.Status != "complete")
                return BadRequest(new { message = "Card setup was not completed." });

            if (!session.Metadata.TryGetValue("postingIds", out var idsCsv) || string.IsNullOrEmpty(idsCsv))
                return BadRequest(new { message = "Could not identify the listings for this submission." });

            var ids = idsCsv.Split(',').Select(int.Parse).ToList();

            var gownRepo = new GownRepository(_connectionString);
            var postings = new List<GownPosting>();
            foreach (var id in ids)
            {
                var posting = gownRepo.Get(id);
                if (posting == null) return NotFound();
                if (posting.OwnerId != CurrentOwnerId()) return Forbid();
                postings.Add(posting);
            }

            var setupIntent = await new SetupIntentService().GetAsync(session.SetupIntentId);
            foreach (var id in ids)
                gownRepo.SubmitForReview(id, session.CustomerId, setupIntent.PaymentMethodId);

            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (!string.IsNullOrEmpty(adminEmail))
            {
                await _emailSender.SendAsync(
                    adminEmail,
                    "New gown batch submitted for review — Regowned",
                    EmailTemplates.NewSubmissionAdminBatch(postings[0].Owner.Name, postings.Select(p => p.Description).ToList(), $"{FrontendBaseUrl()}/admin", FrontendBaseUrl())
                );
            }

            return Ok(new { postingIds = ids });
        }

        [HttpPost("create-ad-checkout-session")]
        public IActionResult CreateAdCheckoutSession([FromBody] CreateAdCheckoutSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet. Add your Stripe test keys to appsettings.Development.json to enable payment." });

            var adRepo = new AdRepository(_connectionString);
            var ad = adRepo.Get(request.AdId);
            if (ad == null) return NotFound();
            if (ad.OwnerId != CurrentOwnerId()) return Forbid();

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(CurrentOwnerId());

            var feeUsd = _configuration.GetValue<decimal>("Stripe:MonthlyAdFeeUsd", 14.99m);
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            if (string.IsNullOrEmpty(frontendBaseUrl))
                frontendBaseUrl = $"{Request.Scheme}://{Request.Host}";

            var options = new SessionCreateOptions
            {
                Mode = "subscription",
                CustomerEmail = owner.Email,
                LineItems = new List<SessionLineItemOptions>
                {
                    new()
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            UnitAmountDecimal = feeUsd * 100,
                            Recurring = new SessionLineItemPriceDataRecurringOptions { Interval = "month" },
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = "Regowned Monthly Ad Placement",
                                Description = ad.Title
                            }
                        }
                    }
                },
                SuccessUrl = $"{frontendBaseUrl}/adpaymentsuccess?session_id={{CHECKOUT_SESSION_ID}}&adId={ad.Id}",
                CancelUrl = $"{frontendBaseUrl}/advertise/payment/{ad.Id}?canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "adId", ad.Id.ToString() },
                    { "ownerId", ad.OwnerId.ToString() }
                }
            };

            var session = new SessionService().Create(options);
            return Ok(new { url = session.Url });
        }

        [HttpPost("confirm-ad-session")]
        public async Task<IActionResult> ConfirmAdSession([FromBody] ConfirmSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var session = await new SessionService().GetAsync(request.SessionId);
            if (session == null || session.PaymentStatus != "paid" && session.Status != "complete")
                return BadRequest(new { message = "Payment was not completed." });

            if (!session.Metadata.TryGetValue("adId", out var adIdStr) || !int.TryParse(adIdStr, out var adId))
                return BadRequest(new { message = "Could not identify the ad for this payment." });

            var adRepo = new AdRepository(_connectionString);
            var ad = adRepo.Get(adId);
            if (ad == null) return NotFound();
            if (ad.OwnerId != CurrentOwnerId()) return Forbid();

            adRepo.Activate(adId, session.SubscriptionId, session.CustomerId);
            return Ok(new { adId });
        }

        [HttpPost("create-ad-setup-session")]
        public async Task<IActionResult> CreateAdSetupSession([FromBody] CreateAdCheckoutSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet. Add your Stripe test keys to appsettings.Development.json to enable payment." });

            var adRepo = new AdRepository(_connectionString);
            var ad = adRepo.Get(request.AdId);
            if (ad == null) return NotFound();
            if (ad.OwnerId != CurrentOwnerId()) return Forbid();

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(CurrentOwnerId());

            var customer = await new CustomerService().CreateAsync(new CustomerCreateOptions
            {
                Email = owner.Email,
                Name = owner.Name
            });

            var frontendBaseUrl = FrontendBaseUrl();
            var options = new SessionCreateOptions
            {
                Mode = "setup",
                Currency = "usd",
                Customer = customer.Id,
                SuccessUrl = $"{frontendBaseUrl}/advertise/setup-success?session_id={{CHECKOUT_SESSION_ID}}&adId={ad.Id}",
                CancelUrl = $"{frontendBaseUrl}/advertise/payment-setup/{ad.Id}?canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "adId", ad.Id.ToString() },
                    { "ownerId", ad.OwnerId.ToString() }
                }
            };

            var session = await new SessionService().CreateAsync(options);
            return Ok(new { url = session.Url });
        }

        [HttpPost("confirm-ad-setup-session")]
        public async Task<IActionResult> ConfirmAdSetupSession([FromBody] ConfirmSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var session = await new SessionService().GetAsync(request.SessionId);
            if (session == null || session.Status != "complete")
                return BadRequest(new { message = "Card setup was not completed." });

            if (!session.Metadata.TryGetValue("adId", out var adIdStr) || !int.TryParse(adIdStr, out var adId))
                return BadRequest(new { message = "Could not identify the ad for this submission." });

            var adRepo = new AdRepository(_connectionString);
            var ad = adRepo.Get(adId);
            if (ad == null) return NotFound();
            if (ad.OwnerId != CurrentOwnerId()) return Forbid();

            var setupIntent = await new SetupIntentService().GetAsync(session.SetupIntentId);
            adRepo.SubmitForReview(adId, session.CustomerId, setupIntent.PaymentMethodId);

            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (!string.IsNullOrEmpty(adminEmail))
            {
                var ownerRepo = new OwnerRepository(_connectionString);
                var owner = ownerRepo.Get(ad.OwnerId ?? 0);
                await _emailSender.SendAsync(
                    adminEmail,
                    "New ad submitted for review — Regowned",
                    EmailTemplates.NewSubmissionAdmin("ad", owner?.Name ?? "an advertiser", ad.Title, $"{FrontendBaseUrl()}/admin", FrontendBaseUrl())
                );
            }

            return Ok(new { adId });
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
