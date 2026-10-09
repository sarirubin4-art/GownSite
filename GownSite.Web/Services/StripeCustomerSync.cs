using GownSite.Data;
using Stripe;

namespace GownSite.Web.Services
{
    // Stripe keeps its own copy of each customer's email and name (set when they first paid),
    // and that copy is where receipts and invoices go. Every gown, ad, and business plan gets
    // its own Stripe customer, so after a patron's email or name changes on Regowned, this
    // pushes the current values to all of them.
    //
    // Best-effort by design: the account change has already been saved by the time this runs,
    // so a Stripe failure is logged rather than turned into an error for the patron.
    public class StripeCustomerSync
    {
        private readonly string _connectionString;
        private readonly ILogger<StripeCustomerSync> _logger;

        public StripeCustomerSync(IConfiguration configuration, ILogger<StripeCustomerSync> logger)
        {
            _connectionString = configuration.GetConnectionString("ConStr");
            _logger = logger;
        }

        public async Task SyncOwnerContactAsync(int ownerId)
        {
            // Local dev without a Stripe key configured — nothing to sync.
            if (string.IsNullOrEmpty(StripeConfiguration.ApiKey)) return;

            var repo = new OwnerRepository(_connectionString);
            var owner = repo.Get(ownerId);
            if (owner == null) return;

            var service = new CustomerService();
            var updates = repo.GetStripeCustomerIds(ownerId).Select(async customerId =>
            {
                try
                {
                    await service.UpdateAsync(customerId, new CustomerUpdateOptions { Email = owner.Email, Name = owner.Name });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not update Stripe customer {CustomerId} for owner {OwnerId}", customerId, ownerId);
                }
            });
            await Task.WhenAll(updates);
        }
    }
}
