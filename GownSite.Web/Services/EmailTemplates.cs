using System.Collections.Generic;
using System.Linq;

namespace GownSite.Web.Services
{
    public static class EmailTemplates
    {
        public static string NewSubmissionAdmin(string type, string ownerName, string description, string adminUrl) =>
            $"<p>A new {type} was submitted by <strong>{ownerName}</strong> and is awaiting your review.</p>" +
            $"<p>{description}</p>" +
            $"<p><a href=\"{adminUrl}\">Review it in the admin dashboard</a></p>";

        public static string NewSubmissionAdminBatch(string ownerName, List<string> descriptions, string adminUrl) =>
            $"<p><strong>{ownerName}</strong> submitted {descriptions.Count} gowns in one batch, all awaiting your review.</p>" +
            $"<ul>{string.Join("", descriptions.Select(d => $"<li>{d}</li>"))}</ul>" +
            $"<p><a href=\"{adminUrl}\">Review them in the admin dashboard</a></p>";

        public static string BusinessInquiry(string ownerName, string ownerEmail, string ownerNumber, string message) =>
            $"<p><strong>{ownerName}</strong> ({ownerEmail}{(string.IsNullOrEmpty(ownerNumber) ? "" : $", {ownerNumber}")}) asked about the bulk discount:</p>" +
            $"<p>{message}</p>";

        public static string Approved(string type, string listingUrl) =>
            $"<p>Good news — your {type} on Regowned has been approved and is now live!</p>" +
            $"<p><a href=\"{listingUrl}\">View it here</a></p>";

        public static string Removed(string type, string reason) =>
            $"<p>Your {type} on Regowned has been taken down by an administrator.</p>" +
            $"<p><strong>Reason:</strong> {reason}</p>" +
            $"<p>Your subscription has been canceled and you will not be charged further.</p>";

        public static string Rejected(string type, string reason) =>
            $"<p>Your {type} submission on Regowned was not approved.</p>" +
            $"<p><strong>Reason:</strong> {reason}</p>" +
            $"<p>You're welcome to submit a new listing that addresses this.</p>";

        public static string AlertMatch(string gownUrl, string unsubscribeUrl) =>
            $"<p>A gown matching your saved search just went live on Regowned!</p>" +
            $"<p><a href=\"{gownUrl}\">View the listing</a></p>" +
            $"<p style=\"margin-top:24px;font-size:12px;color:#888;\"><a href=\"{unsubscribeUrl}\">Unsubscribe from this alert</a></p>";
    }
}
