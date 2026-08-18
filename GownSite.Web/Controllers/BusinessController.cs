using GownSite.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;
using System.Security.Claims;

namespace GownSite.Web.Controllers
{
    public class ConfirmBusinessSetupSessionRequest
    {
        public string SessionId { get; set; }
    }

    // One-time card-setup + flat-rate subscription creation for an owner already
    // designated a "business account" by the admin (see AdminController's
    // owners/{id}/business-plan endpoints). Mirrors PaymentController's per-gown
    // create-setup-session/confirm-setup-session pair, but owner-scoped instead of
    // gown-scoped — this Subscription covers the owner's whole allowance, not one gown.
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class BusinessController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;

        public BusinessController(IConfiguration configuration)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
        }

        private string FrontendBaseUrl()
        {
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            return string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
        }

        [HttpPost("create-setup-session")]
        public async Task<IActionResult> CreateSetupSession()
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(CurrentOwnerId());
            if (owner == null) return NotFound();
            if (!owner.IsBusinessAccount)
                return BadRequest(new { message = "This account isn't set up as a business account." });

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
                SuccessUrl = $"{frontendBaseUrl}/business/billing-setup-success?session_id={{CHECKOUT_SESSION_ID}}",
                CancelUrl = $"{frontendBaseUrl}/business/billing-setup?canceled=true",
                Metadata = new Dictionary<string, string>
                {
                    { "ownerId", owner.Id.ToString() }
                }
            };

            var session = await new SessionService().CreateAsync(options);
            return Ok(new { url = session.Url });
        }

        [HttpPost("confirm-setup-session")]
        public async Task<IActionResult> ConfirmSetupSession([FromBody] ConfirmBusinessSetupSessionRequest request)
        {
            if (string.IsNullOrEmpty(_configuration["Stripe:SecretKey"]))
                return StatusCode(503, new { message = "Stripe isn't configured yet." });

            var session = await new SessionService().GetAsync(request.SessionId);
            if (session == null || session.Status != "complete")
                return BadRequest(new { message = "Card setup was not completed." });

            if (!session.Metadata.TryGetValue("ownerId", out var ownerIdStr) || !int.TryParse(ownerIdStr, out var ownerId))
                return BadRequest(new { message = "Could not identify the account for this setup." });
            if (ownerId != CurrentOwnerId()) return Forbid();

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(ownerId);
            if (owner == null || !owner.IsBusinessAccount)
                return BadRequest(new { message = "This account isn't set up as a business account." });

            var setupIntent = await new SetupIntentService().GetAsync(session.SetupIntentId);

            Subscription subscription;
            try
            {
                subscription = await CreateFlatSubscriptionAsync(session.CustomerId, setupIntent.PaymentMethodId, owner.BusinessMonthlyFeeUsd!.Value);
            }
            catch (StripeException ex)
            {
                return BadRequest(new { message = $"Payment could not be processed: {ex.Message}" });
            }

            ownerRepo.SetBusinessStripeInfo(ownerId, session.CustomerId, setupIntent.PaymentMethodId, subscription.Id);

            return Ok();
        }

        private static async Task<Subscription> CreateFlatSubscriptionAsync(string customerId, string paymentMethodId, decimal monthlyFeeUsd)
        {
            var price = await new PriceService().CreateAsync(new PriceCreateOptions
            {
                Currency = "usd",
                UnitAmountDecimal = monthlyFeeUsd * 100,
                Recurring = new PriceRecurringOptions { Interval = "month" },
                ProductData = new PriceProductDataOptions { Name = "Regowned Business Plan" }
            });

            return await new SubscriptionService().CreateAsync(new SubscriptionCreateOptions
            {
                Customer = customerId,
                DefaultPaymentMethod = paymentMethodId,
                Items = new List<SubscriptionItemOptions> { new() { Price = price.Id } },
                PaymentBehavior = "error_if_incomplete"
            });
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
