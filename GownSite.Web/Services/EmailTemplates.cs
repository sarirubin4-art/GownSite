using System.Collections.Generic;
using System.Linq;

namespace GownSite.Web.Services
{
    public static class EmailTemplates
    {
        public static string VerifyEmail(string ownerName, string verifyUrl, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                EmailLayout.Heading($"Welcome, {ownerName}!") +
                $"<p>Thanks for joining Regowned. Please verify your email address to activate your account.</p>" +
                EmailLayout.Button("Verify My Email", verifyUrl) +
                $"<p style=\"font-size:13px;color:#8A6D72;\">If the button doesn't work, copy and paste this link into your browser:<br>{verifyUrl}</p>",
                frontendBaseUrl);

        public static string NewSubmissionAdmin(string type, string ownerName, string description, string adminUrl, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                $"<p>A new {type} was submitted by <strong>{ownerName}</strong> and is awaiting your review.</p>" +
                $"<p>{description}</p>" +
                EmailLayout.Button("Review in Admin Dashboard", adminUrl),
                frontendBaseUrl);

        public static string NewSubmissionAdminBatch(string ownerName, List<string> descriptions, string adminUrl, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                $"<p><strong>{ownerName}</strong> submitted {descriptions.Count} gowns in one batch, all awaiting your review.</p>" +
                $"<ul>{string.Join("", descriptions.Select(d => $"<li>{d}</li>"))}</ul>" +
                EmailLayout.Button("Review in Admin Dashboard", adminUrl),
                frontendBaseUrl);

        public static string BusinessInquiry(string ownerName, string ownerEmail, string ownerNumber, string message, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                $"<p><strong>{ownerName}</strong> ({ownerEmail}{(string.IsNullOrEmpty(ownerNumber) ? "" : $", {ownerNumber}")}) asked about the bulk discount:</p>" +
                $"<p>{message}</p>",
                frontendBaseUrl);

        public static string Approved(string type, string listingUrl, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                EmailLayout.Heading("You're Live!") +
                $"<p>Good news — your {type} on Regowned has been approved and is now live!</p>" +
                EmailLayout.Button("View It", listingUrl),
                frontendBaseUrl);

        public static string Removed(string type, string reason, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                $"<p>Your {type} on Regowned has been taken down by an administrator.</p>" +
                $"<p><strong>Reason:</strong> {reason}</p>" +
                $"<p>Your subscription has been canceled and you will not be charged further.</p>",
                frontendBaseUrl);

        public static string Rejected(string type, string reason, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                $"<p>Your {type} submission on Regowned was not approved.</p>" +
                $"<p><strong>Reason:</strong> {reason}</p>" +
                $"<p>You're welcome to submit a new listing that addresses this.</p>",
                frontendBaseUrl);

        public static string AlertMatch(string gownUrl, string unsubscribeUrl, string frontendBaseUrl) =>
            EmailLayout.Wrap(
                EmailLayout.Heading("A Match Just Went Live!") +
                $"<p>A gown matching your saved search just went live on Regowned!</p>" +
                EmailLayout.Button("View the Listing", gownUrl) +
                $"<p style=\"margin-top:24px;font-size:12px;color:#8A6D72;\"><a href=\"{unsubscribeUrl}\" style=\"color:#8A6D72;\">Unsubscribe from this alert</a></p>",
                frontendBaseUrl);

        // Marketing email meant for prospective customers outside the patron list — showcases
        // the site's own square ad creatives as a quick visual of what Regowned offers.
        public static string SpreadTheWord(string frontendBaseUrl)
        {
            string img(string file) =>
                $"<td width=\"50%\" style=\"padding:6px;\"><img src=\"{frontendBaseUrl}/promo-ads/{file}\" width=\"100%\" style=\"display:block;border-radius:12px;\" alt=\"\" /></td>";

            var grid = $@"<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""margin:20px 0;"">
                <tr>{img("1-welcome.png")}{img("2-simcha-easier.png")}</tr>
                <tr>{img("3-buy-sell-rent.png")}{img("4-simcha-services.png")}</tr>
                <tr>{img("5-advertise.png")}<td width=""50%""></td></tr>
            </table>";

            return EmailLayout.Wrap(
                EmailLayout.Heading("Have You Heard About Regowned?") +
                $"<p>Regowned is the easiest way to buy, sell, or rent gently-loved gowns for every simcha — and to find trusted vendors for hair, makeup, alterations, and more, all in one place.</p>" +
                grid +
                EmailLayout.Button("Visit Regowned", frontendBaseUrl),
                frontendBaseUrl);
        }

        // Admin-authored promotional blast (sales, announcements) sent to every registered patron.
        public static string Promotional(string message, string frontendBaseUrl)
        {
            var paragraphs = string.Join("", message
                .Split('\n')
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .Select(line => $"<p>{line.Trim()}</p>"));

            return EmailLayout.Wrap(
                paragraphs +
                EmailLayout.Button("Shop Now", $"{frontendBaseUrl}/search"),
                frontendBaseUrl);
        }
    }
}
