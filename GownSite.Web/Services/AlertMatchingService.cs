using GownSite.Data;

namespace GownSite.Web.Services
{
    public class AlertMatchingService
    {
        private readonly string _connectionString;
        private readonly IEmailSender _emailSender;

        public AlertMatchingService(string connectionString, IEmailSender emailSender)
        {
            _connectionString = connectionString;
            _emailSender = emailSender;
        }

        public async Task MatchAndNotifyAsync(GownPosting posting, string frontendBaseUrl)
        {
            var alertRepo = new SearchAlertRepository(_connectionString);
            var alerts = alertRepo.GetAllActive();

            foreach (var alert in alerts)
            {
                if (!Matches(alert, posting)) continue;

                try
                {
                    var gownUrl = $"{frontendBaseUrl}/gown/{posting.Id}";
                    var unsubscribeUrl = $"{frontendBaseUrl}/api/alert/unsubscribe?token={alert.UnsubscribeToken}";
                    await _emailSender.SendAsync(
                        alert.Email,
                        "A gown matching your search is now live — Regowned",
                        EmailTemplates.AlertMatch(gownUrl, unsubscribeUrl)
                    );
                }
                catch
                {
                    // one failed send shouldn't block matching/notifying the rest of the alerts
                }
            }
        }

        private static bool Matches(SearchAlert alert, GownPosting posting)
        {
            if (!MatchesSplitField(alert.Colors, posting.Color)) return false;
            if (!MatchesSplitField(alert.Sizes, posting.Size)) return false;
            if (!MatchesSplitField(alert.Styles, posting.StyleTags)) return false;
            if (!MatchesListingType(alert.ListingTypes, posting.ListingType)) return false;
            if (!MatchesLocation(alert.Locations, posting.Location)) return false;
            return true;
        }

        // Colors/Sizes/StyleTags are safe to comma-join+split (their individual values never
        // contain a literal comma), matching the same convention GownRepository.Search uses.
        private static bool MatchesSplitField(string alertField, string postingField)
        {
            if (string.IsNullOrEmpty(alertField)) return true; // no preference on this dimension = wildcard
            if (string.IsNullOrEmpty(postingField)) return false;

            var alertValues = alertField.Split(',');
            var postingValues = postingField.Split(',');
            return postingValues.Any(pv => alertValues.Contains(pv));
        }

        private static bool MatchesListingType(string alertField, ListingType listingType)
        {
            if (string.IsNullOrEmpty(alertField)) return true;
            return alertField.Split(',').Contains(listingType.ToString());
        }

        // Location values themselves often contain a literal comma (e.g. "Lakewood, NJ"), so
        // this field is pipe-joined instead of comma-joined — comma-splitting it would corrupt
        // any location containing one. Posting.Location is always a single exact string (never
        // itself multi-value), so this is a list-contains check, not a split-both-sides check.
        private static bool MatchesLocation(string alertField, string postingLocation)
        {
            if (string.IsNullOrEmpty(alertField)) return true;
            if (string.IsNullOrEmpty(postingLocation)) return false;

            return alertField.Split('|').Contains(postingLocation);
        }
    }
}
