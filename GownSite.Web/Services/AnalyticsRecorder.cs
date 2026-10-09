using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using GownSite.Data;

namespace GownSite.Web.Services
{
    // Turns a request into an anonymous PageView/SiteEvent row: who (a keyed hash, never
    // the IP itself), where (GeoLite2 city lookup), how they arrived (referrer), and on what
    // (device). Skips bots and the admin's own browsing so neither inflates the numbers.
    // Recording never throws — analytics failing must never break the page or action that
    // triggered it.
    public class AnalyticsRecorder
    {
        private static readonly Regex BotRegex = new(
            @"bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|preview|headless|lighthouse|pingdom|uptime|monitor|python|curl|wget|httpclient|okhttp|java/|go-http|axios|node-fetch|postman",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex GownPath = new(@"^/gown/(\d+)$", RegexOptions.Compiled);
        private static readonly Regex AdPath = new(@"^/ad/(\d+)$", RegexOptions.Compiled);

        private readonly string _connectionString;
        private readonly GeoLocator _geo;
        private readonly byte[] _visitorKey;
        private readonly ILogger<AnalyticsRecorder> _logger;

        // Matches the browser's visit length (VISIT_IDLE_MS in ClientApp's utils/analytics.js).
        private static readonly TimeSpan VisitWindow = TimeSpan.FromMinutes(30);

        public AnalyticsRecorder(IConfiguration configuration, GeoLocator geo, ILogger<AnalyticsRecorder> logger)
        {
            _connectionString = configuration.GetConnectionString("ConStr");
            _geo = geo;
            _logger = logger;
            // Any server-side secret works as the visitor-hash key — it only has to be stable
            // (so the same visitor hashes the same way across restarts) and unknown to anyone
            // with just the database (so the hashes can't be brute-forced back to IPs). Falls
            // back to the MaxMind key, which is already configured wherever analytics runs.
            var secret = configuration["Analytics:VisitorSalt"] ?? configuration["MaxMind:LicenseKey"] ?? "regowned-local-dev";
            _visitorKey = Encoding.UTF8.GetBytes(secret);
        }

        public void RecordPageView(HttpContext http, string path, string referrer, string utmSource, bool isEntry)
        {
            try
            {
                if (ShouldIgnore(http)) return;

                path = NormalizePath(path);
                var (pageType, entityId) = ClassifyPath(path);
                if (pageType == null) return;

                var repo = new AnalyticsRepository(_connectionString);
                // An owner checking on their own listing isn't the kind of view they (or the
                // admin) want counted — it'd inflate exactly the number shown on My Listings.
                if (entityId.HasValue && CurrentOwnerId(http) is int ownerId
                    && repo.GetListingOwnerId(pageType, entityId.Value) == ownerId)
                    return;

                // Each page counts once per visit. The browser already enforces this (see
                // ClientApp's utils/analytics.js), so this is the backstop for browsers that
                // block storage or a reload that lost it: the same visitor viewing the same
                // page again within the visit window isn't a new view.
                var visitorId = VisitorId(http);
                if (repo.HasRecentPageView(visitorId, path, DateTime.UtcNow - VisitWindow)) return;

                var geo = _geo.Lookup(ClientIp(http));
                repo.AddPageView(new PageView
                {
                    CreatedDate = DateTime.UtcNow,
                    Path = path,
                    PageType = pageType,
                    EntityId = entityId,
                    VisitorId = visitorId,
                    CountryCode = geo?.CountryCode,
                    Country = Truncate(geo?.Country, 80),
                    RegionCode = Truncate(geo?.RegionCode, 10),
                    Region = Truncate(geo?.Region, 80),
                    City = Truncate(geo?.City, 100),
                    IsEntry = isEntry,
                    Source = isEntry ? ClassifySource(referrer, utmSource, http.Request.Host.Host) : null,
                    Device = ClassifyDevice(http.Request.Headers.UserAgent.ToString())
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record page view for {Path}", path);
            }
        }

        // Events the browser reports itself (see SiteEventTypes.ClientReportable) come from an
        // anonymous endpoint anyone could script, and they feed numbers advertisers see on
        // My Listings — so one visitor repeating the same event on the same ad within the window
        // counts once. Impressions get a long window (the client already sends one per
        // visit); clicks a short one, so genuine repeat clicks still count.
        public void RecordClientEvent(HttpContext http, string type, int? entityId)
        {
            var window = type == SiteEventTypes.AdImpression ? TimeSpan.FromHours(12) : TimeSpan.FromMinutes(1);
            RecordEvent(http, type, entityId, dedupeWindow: window);
        }

        // Unmet demand: someone searched for something specific and we had nothing. Only
        // counted when at least one filter was set (an unfiltered empty search just means no
        // gowns are live), only if the search is still empty now, and once per visit.
        public void RecordNoResultsSearch(HttpContext http, GownSearchFilters filters)
        {
            try
            {
                var detail = DescribeSearch(filters);
                if (detail == null || ShouldIgnore(http)) return;
                filters.Page = 1;
                filters.PageSize = 1;
                if (new GownRepository(_connectionString).Search(filters).TotalCount > 0) return;
                RecordEvent(http, SiteEventTypes.SearchNoResults, detail: detail, dedupeWindow: VisitWindow);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record no-results search");
            }
        }

        public static string DescribeSearch(GownSearchFilters f)
        {
            var parts = new List<string>();
            if (f.Colors?.Count > 0) parts.Add(string.Join("/", f.Colors.OrderBy(c => c)));
            if (f.Sizes?.Count > 0) parts.Add("Size " + string.Join("/", f.Sizes.OrderBy(s => s)));
            if (f.Styles?.Count > 0) parts.Add(string.Join("/", f.Styles.OrderBy(s => s)));
            if (f.ListingTypes?.Count > 0) parts.Add(string.Join("/", f.ListingTypes.OrderBy(t => t)));
            if (f.Locations?.Count > 0) parts.Add("in " + string.Join("/", f.Locations.OrderBy(l => l)));
            if (f.MinPrice.HasValue || f.MaxPrice.HasValue) parts.Add($"${f.MinPrice ?? 0}–{(f.MaxPrice.HasValue ? "$" + f.MaxPrice : "any")}");
            return parts.Count == 0 ? null : string.Join(", ", parts);
        }

        // dedupeWindow: skip if this visitor already has the same event (same type, entity, and
        // detail) within the window.
        public void RecordEvent(HttpContext http, string type, int? entityId = null, string detail = null, TimeSpan? dedupeWindow = null)
        {
            try
            {
                if (ShouldIgnore(http)) return;
                detail = Truncate(detail, 400);
                var repo = new AnalyticsRepository(_connectionString);
                var visitorId = VisitorId(http);
                if (dedupeWindow.HasValue && repo.HasRecentEvent(type, entityId, visitorId, DateTime.UtcNow - dedupeWindow.Value, detail)) return;
                repo.AddEvent(new SiteEvent
                {
                    CreatedDate = DateTime.UtcNow,
                    Type = type,
                    EntityId = entityId,
                    VisitorId = visitorId,
                    Detail = detail
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record {Type} event", type);
            }
        }

        private static bool ShouldIgnore(HttpContext http)
        {
            if (http.User.IsInRole("Admin")) return true;
            var ua = http.Request.Headers.UserAgent.ToString();
            return string.IsNullOrWhiteSpace(ua) || BotRegex.IsMatch(ua);
        }

        // HMAC(secret, IP | user agent), truncated — without the secret it can't be reversed
        // to an IP, and it changes on its own whenever the visitor's IP or browser does.
        // It used to also mix in the current month, but that split one person into two
        // visitors in any 7/30-day range crossing a month boundary. The "2026-10" prefix is
        // that scheme frozen at the month it was dropped, so ids recorded before the change
        // still match the same visitor afterward. Rows age out after 13 months regardless.
        private const string VisitorIdEpoch = "2026-10";

        private string VisitorId(HttpContext http)
        {
            var input = $"{VisitorIdEpoch}|{ClientIp(http)}|{http.Request.Headers.UserAgent}";
            var hash = HMACSHA256.HashData(_visitorKey, Encoding.UTF8.GetBytes(input));
            return Convert.ToHexString(hash, 0, 8).ToLowerInvariant();
        }

        // App Service sits behind a load balancer, so the real client is the first entry of
        // X-Forwarded-For (which on Windows App Service also carries a ":port" suffix).
        private static IPAddress ClientIp(HttpContext http)
        {
            var forwarded = http.Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(forwarded))
            {
                var first = forwarded.Split(',')[0].Trim();
                if (IPAddress.TryParse(first, out var ip)) return ip;
                if (IPEndPoint.TryParse(first, out var endpoint)) return endpoint.Address;
            }
            var remote = http.Connection.RemoteIpAddress;
            return remote != null && remote.IsIPv4MappedToIPv6 ? remote.MapToIPv4() : remote;
        }

        private static int? CurrentOwnerId(HttpContext http) =>
            int.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        private static string NormalizePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return "/";
            // Never keep the query string — reset-password links carry a token there.
            var q = path.IndexOfAny(new[] { '?', '#' });
            if (q >= 0) path = path[..q];
            if (!path.StartsWith('/')) path = "/" + path;
            if (path.Length > 1) path = path.TrimEnd('/');
            return Truncate(path.ToLowerInvariant(), 300);
        }

        // null page type == don't record (the admin page itself).
        public static (string PageType, int? EntityId) ClassifyPath(string path)
        {
            var gown = GownPath.Match(path);
            if (gown.Success && int.TryParse(gown.Groups[1].Value, out var gownId)) return ("Gown", gownId);
            var ad = AdPath.Match(path);
            if (ad.Success && int.TryParse(ad.Groups[1].Value, out var adId)) return ("Ad", adId);

            string Starts(string prefix) => path == prefix || path.StartsWith(prefix + "/") ? prefix : null;

            if (path == "/") return ("Home", null);
            if (Starts("/admin") != null) return (null, null);
            if (path == "/search") return ("Search", null);
            if (path == "/ads") return ("AdDirectory", null);
            if (path.Contains("payment") || path.Contains("setup-success") || path.Contains("billing-setup")) return ("Checkout", null);
            if (Starts("/postagown") != null) return ("PostGown", null);
            if (Starts("/advertise") != null) return ("Advertise", null);
            if (Starts("/concierge") != null) return ("Concierge", null);
            if (path is "/login" or "/signup" or "/forgot-password" or "/reset-password") return ("Account", null);
            if (path is "/mylistings" or "/myads" or "/account") return ("MyAccount", null);
            if (path is "/terms" or "/privacy") return ("Info", null);
            return ("Other", null);
        }

        // null == Direct (typed the address, a bookmark, or an app that strips the referrer —
        // WhatsApp usually does, which is why ?utm_source=whatsapp on shared links helps).
        public static string ClassifySource(string referrer, string utmSource, string ownHost)
        {
            if (!string.IsNullOrWhiteSpace(utmSource))
            {
                var utm = utmSource.Trim().ToLowerInvariant();
                return utm switch
                {
                    "whatsapp" or "wa" => "WhatsApp",
                    "facebook" or "fb" => "Facebook",
                    "instagram" or "ig" => "Instagram",
                    "email" or "newsletter" => "Email",
                    "google" => "Google",
                    _ => Truncate(utmSource.Trim(), 100)
                };
            }

            if (string.IsNullOrWhiteSpace(referrer) || !Uri.TryCreate(referrer, UriKind.Absolute, out var uri)) return null;

            // Android apps send android-app://<package>/ as the referrer.
            if (uri.Scheme == "android-app")
            {
                var app = uri.Host;
                if (app.Contains("android.gm")) return "Email";
                if (app.Contains("googlequicksearchbox")) return "Google";
                if (app.Contains("whatsapp")) return "WhatsApp";
                if (app.Contains("facebook")) return "Facebook";
                if (app.Contains("instagram")) return "Instagram";
                return Truncate(app, 100);
            }

            var host = uri.Host.ToLowerInvariant();
            if (host.StartsWith("www.")) host = host[4..];
            var own = (ownHost ?? "").ToLowerInvariant();
            if (own.StartsWith("www.")) own = own[4..];
            if (host == own || host.EndsWith("regowned.com") || host == "localhost") return null;

            if (host.StartsWith("mail.") || host.Contains("outlook.") || host.Contains("mail.yahoo")) return "Email";
            if (host.Contains("google.")) return "Google";
            if (host.Contains("bing.")) return "Bing";
            if (host.Contains("yahoo.")) return "Yahoo";
            if (host.Contains("duckduckgo.")) return "DuckDuckGo";
            if (host.Contains("facebook.") || host == "fb.com" || host.EndsWith(".fb.com")) return "Facebook";
            if (host.Contains("instagram.")) return "Instagram";
            if (host.Contains("whatsapp.") || host == "wa.me") return "WhatsApp";
            if (host == "t.co" || host.Contains("twitter.") || host == "x.com") return "X (Twitter)";
            if (host.Contains("pinterest.")) return "Pinterest";
            if (host.Contains("stripe.com")) return "Stripe checkout";
            return Truncate(host, 100);
        }

        public static string ClassifyDevice(string userAgent)
        {
            if (string.IsNullOrEmpty(userAgent)) return null;
            if (Regex.IsMatch(userAgent, @"iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)", RegexOptions.IgnoreCase)) return "Tablet";
            if (Regex.IsMatch(userAgent, @"Mobi|iPhone|iPod|Android", RegexOptions.IgnoreCase)) return "Mobile";
            return "Desktop";
        }

        private static string Truncate(string value, int max) =>
            value == null ? null : value.Length <= max ? value : value[..max];
    }
}
