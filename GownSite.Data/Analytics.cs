using System;
using System.ComponentModel.DataAnnotations;

namespace GownSite.Data
{
    // One row per page per visit (the SPA reports route changes — see ClientApp's
    // utils/analytics.js). Deliberately stores no IP address and no account identity:
    // VisitorId is a keyed hash of IP + user agent (see AnalyticsRecorder), so it can group
    // one person's views without being reversible to who they are.
    public class PageView
    {
        public long Id { get; set; }
        public DateTime CreatedDate { get; set; }

        [MaxLength(300)]
        public string Path { get; set; }
        // Home, Gown, Ad, Search, AdDirectory, PostGown, Advertise, Concierge, Account,
        // MyAccount, Checkout, Info, Other — see AnalyticsRecorder.ClassifyPath.
        [MaxLength(20)]
        public string PageType { get; set; }
        // The gown/ad id for Gown/Ad pages, so per-listing view counts are a simple filter.
        public int? EntityId { get; set; }

        [MaxLength(16)]
        public string VisitorId { get; set; }

        [MaxLength(2)]
        public string CountryCode { get; set; }
        [MaxLength(80)]
        public string Country { get; set; }
        [MaxLength(10)]
        public string RegionCode { get; set; }
        [MaxLength(80)]
        public string Region { get; set; }
        [MaxLength(100)]
        public string City { get; set; }

        // True for the first page of a visit (a fresh page load, not an in-app navigation)
        // — the only views where Source means anything, since later navigations within the
        // SPA have no external referrer.
        public bool IsEntry { get; set; }
        // Google, Facebook, Instagram, WhatsApp, Direct, a bare referring domain, etc.
        [MaxLength(100)]
        public string Source { get; set; }

        // Mobile, Tablet, Desktop
        [MaxLength(10)]
        public string Device { get; set; }
    }

    // Anything that isn't a page view but is still worth counting — see SiteEventTypes.
    public class SiteEvent
    {
        public long Id { get; set; }
        public DateTime CreatedDate { get; set; }
        [MaxLength(30)]
        public string Type { get; set; }
        public int? EntityId { get; set; }
        [MaxLength(16)]
        public string VisitorId { get; set; }
        // Free-form context — currently only the filter summary for SearchNoResults.
        [MaxLength(400)]
        public string Detail { get; set; }
    }

    public static class SiteEventTypes
    {
        // Floating ad card shown (deduped per ad per browser session client-side).
        public const string AdImpression = "AdImpression";
        // Floating ad card clicked through to its detail page.
        public const string AdClick = "AdClick";
        // "Learn More" (the advertiser's own website) clicked on an ad's detail page.
        public const string AdLinkClick = "AdLinkClick";
        // Contact info revealed — recorded server-side in Gown/AdController.Inquire.
        public const string GownContact = "GownContact";
        public const string AdContact = "AdContact";
        // A gown search with at least one filter that came back empty.
        public const string SearchNoResults = "SearchNoResults";
        public const string Signup = "Signup";

        // The only types the anonymous /api/analytics/event endpoint accepts from the
        // browser — everything else is recorded server-side where it actually happens.
        public static readonly string[] ClientReportable = { AdImpression, AdClick, AdLinkClick };
    }
}
