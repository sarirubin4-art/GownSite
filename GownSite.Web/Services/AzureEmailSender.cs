using Azure;
using Azure.Communication.Email;

namespace GownSite.Web.Services
{
    public class AzureEmailSender : IEmailSender
    {
        private readonly EmailClient _client;
        private readonly string _senderAddress;

        public AzureEmailSender(string connectionString, string senderAddress)
        {
            _client = new EmailClient(connectionString);
            _senderAddress = senderAddress;
        }

        public async Task SendAsync(string toEmail, string subject, string htmlBody)
        {
            var message = new EmailMessage(
                senderAddress: _senderAddress,
                content: new EmailContent(subject) { Html = htmlBody },
                recipients: new EmailRecipients(new[] { new EmailAddress(toEmail) })
            );

            await _client.SendAsync(WaitUntil.Started, message);
        }
    }
}
