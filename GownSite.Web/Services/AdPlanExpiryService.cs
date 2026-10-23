using GownSite.Data;

namespace GownSite.Web.Services
{
    // Hourly backstop for prepaid ad plans: normally StripeWebhookController takes a
    // cancelled 6-month/yearly ad down when Stripe ends its subscription, but if that
    // event is never delivered (webhook not configured yet, an outage Stripe gave up
    // retrying through), the ad would otherwise stay live for free indefinitely.
    public class AdPlanExpiryService : BackgroundService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AdPlanExpiryService> _logger;

        public AdPlanExpiryService(IConfiguration configuration, ILogger<AdPlanExpiryService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var expired = new AdRepository(_configuration.GetConnectionString("ConStr")).ExpireEndedPrepaidAds();
                    if (expired > 0) _logger.LogInformation("Took down {Count} prepaid ads past their paid period", expired);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Prepaid ad expiry check failed");
                }

                try { await Task.Delay(TimeSpan.FromHours(1), stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }
    }
}
