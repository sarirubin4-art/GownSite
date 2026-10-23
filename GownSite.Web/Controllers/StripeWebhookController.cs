using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Stripe;

namespace GownSite.Web.Controllers
{
    // Stripe calls this when billing events happen after a subscription is created — the
    // one part of billing the site otherwise never hears about. Registered in the Stripe
    // dashboard (Developers → Webhooks) for invoice.payment_failed and
    // customer.subscription.deleted; Stripe:WebhookSecret is that endpoint's signing secret.
    //
    // Renewal failures: Stripe retries on its own schedule (Billing → Revenue recovery
    // settings) and emails nothing by itself unless configured to — this tells the owner
    // after each failed try, with a link to pay. Once retries run out, Stripe cancels the
    // subscription, and the deleted event takes the ad/gown down here.
    [Route("api/stripe/webhook")]
    [ApiController]
    public class StripeWebhookController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;
        private readonly ILogger<StripeWebhookController> _logger;

        public StripeWebhookController(IConfiguration configuration, IEmailSender emailSender, ILogger<StripeWebhookController> logger)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _emailSender = emailSender;
            _logger = logger;
        }

        [HttpPost]
        public async Task<IActionResult> Receive()
        {
            var secret = _configuration["Stripe:WebhookSecret"];
            if (string.IsNullOrEmpty(secret)) return StatusCode(503);

            var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
            Event stripeEvent;
            try
            {
                // throwOnApiVersionMismatch: false — the dashboard endpoint's API version may
                // differ from this library's pinned one (see LegacyInvoiceSubscriptionId).
                stripeEvent = EventUtility.ConstructEvent(json, Request.Headers["Stripe-Signature"], secret, throwOnApiVersionMismatch: false);
            }
            catch (StripeException)
            {
                return BadRequest();
            }

            // Stripe redelivers an event it didn't see a quick 2xx for, which would otherwise
            // repeat the emails below. In-memory only, so this covers the usual case (a retry
            // to the same running instance), not a redelivery that lands after a restart.
            if (!RecentEventIds.TryAdd(stripeEvent.Id, DateTime.UtcNow)) return Ok();
            foreach (var old in RecentEventIds.Where(e => e.Value < DateTime.UtcNow.AddDays(-3)).Select(e => e.Key).ToList())
                RecentEventIds.TryRemove(old, out _);

            try
            {
                switch (stripeEvent.Type)
                {
                    case EventTypes.InvoicePaymentFailed:
                        await OnPaymentFailed((Invoice)stripeEvent.Data.Object, json);
                        break;
                    case EventTypes.CustomerSubscriptionDeleted:
                        await OnSubscriptionDeleted((Subscription)stripeEvent.Data.Object);
                        break;
                }
            }
            catch
            {
                // Not handled after all — let Stripe's redelivery try it again.
                RecentEventIds.TryRemove(stripeEvent.Id, out _);
                throw;
            }

            // Anything else is acknowledged and ignored, so Stripe doesn't keep redelivering it.
            return Ok();
        }

        private async Task OnPaymentFailed(Invoice invoice, string json)
        {
            // The very first charge happens at admin approval with error_if_incomplete, so
            // the admin already sees that failure on the spot — only renewals land here.
            if (invoice.BillingReason != "subscription_cycle") return;
            var subscriptionId = invoice.Parent?.SubscriptionDetails?.SubscriptionId ?? LegacyInvoiceSubscriptionId(json);
            if (string.IsNullOrEmpty(subscriptionId))
            {
                _logger.LogWarning("Stripe invoice {InvoiceId} payment failed with no subscription id in the event", invoice.Id);
                return;
            }

            var target = FindTarget(subscriptionId);
            if (target == null)
            {
                _logger.LogWarning("Stripe payment failed for unknown subscription {SubscriptionId}", subscriptionId);
                return;
            }

            await SendAsync(target.OwnerEmail, "Payment problem — Regowned",
                EmailTemplates.PaymentFailed(target.Description, invoice.HostedInvoiceUrl, invoice.NextPaymentAttempt, FrontendBaseUrl()));
            await SendAdminAsync($"A renewal payment failed (attempt {invoice.AttemptCount}) for {target.OwnerName} ({target.OwnerEmail}) — {target.Description}. " +
                (invoice.NextPaymentAttempt.HasValue ? $"Stripe will retry on {invoice.NextPaymentAttempt.Value:MMMM d}." : "Stripe has no further retries scheduled."));
        }

        private async Task OnSubscriptionDeleted(Subscription subscription)
        {
            var target = FindTarget(subscription.Id);
            if (target == null) return;
            var paymentFailed = subscription.CancellationDetails?.Reason == "payment_failed";

            // An ad with no subscription behind it should never stay live, whatever ended it
            // (an owner's Cancel or admin take-down already deactivated it, so that's a no-op).
            // Gowns only come down for non-payment: Mark as Sold also cancels the
            // subscription but deliberately keeps the gown live with its Sold badge.
            var tookSomethingDown = false;
            foreach (var ad in target.Ads.Where(a => a.IsActive))
            {
                new AdRepository(_connectionString).Cancel(ad.Id);
                tookSomethingDown = true;
            }
            if (paymentFailed)
            {
                foreach (var gown in target.Gowns.Where(g => g.IsActive && !g.IsSold))
                {
                    new GownRepository(_connectionString).CancelListing(gown.Id);
                    tookSomethingDown = true;
                }
            }

            if (!paymentFailed) return;

            if (target.IsBusinessPlan)
            {
                // A business plan covers many gowns with no per-gown subscription to cancel,
                // so what happens to them is the admin's call — just flag it.
                await SendAdminAsync($"{target.OwnerName} ({target.OwnerEmail})'s business plan subscription was canceled by Stripe after renewal payments kept failing. Their gowns are still live — decide whether to remove the plan.");
                return;
            }

            if (tookSomethingDown)
            {
                await SendAsync(target.OwnerEmail, "Your listing was taken down — Regowned",
                    EmailTemplates.TakenDownForNonPayment(target.Description, $"{FrontendBaseUrl()}/mylistings", FrontendBaseUrl()));
                await SendAdminAsync($"Took down {target.Description} for {target.OwnerName} ({target.OwnerEmail}) — Stripe canceled the subscription after renewal payments kept failing.");
            }
        }

        // Webhook endpoints created on a Stripe API version before 2025-03-31 put the
        // invoice's subscription at the top level ("subscription") rather than under
        // "parent", and this Stripe.net version no longer maps that field — so read it raw.
        private static string LegacyInvoiceSubscriptionId(string json)
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            return doc.RootElement.GetProperty("data").GetProperty("object").TryGetProperty("subscription", out var sub)
                   && sub.ValueKind == System.Text.Json.JsonValueKind.String
                ? sub.GetString()
                : null;
        }

        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTime> RecentEventIds = new();

        private class Target
        {
            public string OwnerName { get; set; }
            public string OwnerEmail { get; set; }
            public string Description { get; set; }
            public bool IsBusinessPlan { get; set; }
            public List<Ad> Ads { get; set; } = new();
            public List<GownPosting> Gowns { get; set; } = new();
        }

        private Target FindTarget(string subscriptionId)
        {
            var ads = new AdRepository(_connectionString).GetBySubscriptionId(subscriptionId);
            if (ads.Count > 0)
                return new Target { OwnerName = ads[0].Owner?.Name, OwnerEmail = ads[0].Owner?.Email, Description = $"ad \"{ads[0].Title}\"", Ads = ads };

            var gowns = new GownRepository(_connectionString).GetBySubscriptionId(subscriptionId);
            if (gowns.Count > 0)
                return new Target
                {
                    OwnerName = gowns[0].Owner?.Name,
                    OwnerEmail = gowns[0].Owner?.Email,
                    Description = gowns.Count == 1 ? "gown listing" : $"{gowns.Count} gown listings",
                    Gowns = gowns
                };

            var businessOwner = new OwnerRepository(_connectionString).GetByBusinessSubscriptionId(subscriptionId);
            if (businessOwner != null)
                return new Target { OwnerName = businessOwner.Name, OwnerEmail = businessOwner.Email, Description = "business plan", IsBusinessPlan = true };

            return null;
        }

        // A failed email is logged rather than thrown: the take-down has already happened,
        // and an error response would make Stripe redeliver and repeat the emails that did go.
        private async Task SendAsync(string to, string subject, string html)
        {
            if (string.IsNullOrEmpty(to)) return;
            try
            {
                await _emailSender.SendAsync(to, subject, html);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Stripe webhook email to {To} failed", to);
            }
        }

        private Task SendAdminAsync(string summary) =>
            SendAsync(_configuration["Email:AdminNotificationEmail"], "Payment problem — Regowned (admin)",
                EmailTemplates.PaymentProblemAdmin(summary, FrontendBaseUrl()));

        private string FrontendBaseUrl() => FrontendUrls.BaseUrl(_configuration, Request);
    }
}
