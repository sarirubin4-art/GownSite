namespace GownSite.Web.Services
{
    // Local/dev default when Email:ConnectionString isn't configured — logs instead of
    // sending, so nothing real goes out while testing. Production uses AzureEmailSender instead.
    public class NoOpEmailSender : IEmailSender
    {
        private readonly ILogger<NoOpEmailSender> _logger;

        public NoOpEmailSender(ILogger<NoOpEmailSender> logger)
        {
            _logger = logger;
        }

        public Task SendAsync(string toEmail, string subject, string htmlBody)
        {
            _logger.LogInformation("[NoOpEmailSender] To: {ToEmail} | Subject: {Subject}\n{Body}", toEmail, subject, htmlBody);
            return Task.CompletedTask;
        }
    }
}
