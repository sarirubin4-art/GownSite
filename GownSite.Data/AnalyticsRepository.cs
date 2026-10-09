using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;

namespace GownSite.Data
{
    public class CountRow
    {
        public string Label { get; set; }
        public int Count { get; set; }
        public double Percent { get; set; }
        // Location rows only — lets the admin page filter the view log to exactly this
        // place (an exact match, not a text search that would also catch "Lakewood, CO").
        public string City { get; set; }
        public string RegionCode { get; set; }
        public string CountryCode { get; set; }
        // Generic filter value for the non-location breakdowns (source/device/page type).
        public string Key { get; set; }
    }

    public class TopPageRow
    {
        public string PageType { get; set; }
        public int? EntityId { get; set; }
        public string Path { get; set; }
        public string Title { get; set; }
        public int Count { get; set; }
        public int Visitors { get; set; }
    }

    public class NoResultSearchRow
    {
        public string Detail { get; set; }
        public int Count { get; set; }
        public DateTime LastSeen { get; set; }
    }

    public class FunnelCounts
    {
        public int Visitors { get; set; }
        public int Signups { get; set; }
        public int GownsPosted { get; set; }
        public int GownContactVisitors { get; set; }
        public int AdContactVisitors { get; set; }
    }

    public class AdPerformanceRow
    {
        public int AdId { get; set; }
        public string Title { get; set; }
        public int Impressions { get; set; }
        public int CardClicks { get; set; }
        public int Views { get; set; }
        public int WebsiteClicks { get; set; }
        public int Contacts { get; set; }
    }

    public class AnalyticsBreakdown
    {
        public int TotalViews { get; set; }
        public int UniqueVisitors { get; set; }
        public List<CountRow> Cities { get; set; }
        public List<CountRow> Regions { get; set; }
        public List<CountRow> Sources { get; set; }
        public List<CountRow> Devices { get; set; }
        public List<CountRow> PageTypes { get; set; }
        public List<TopPageRow> TopPages { get; set; }
        public List<NoResultSearchRow> NoResultSearches { get; set; }
        public FunnelCounts Funnel { get; set; }
        public List<AdPerformanceRow> Ads { get; set; }
    }

    public class ViewLogFilter
    {
        public DateTime? FromUtc { get; set; }
        public DateTime? ToUtc { get; set; }
        public string PageType { get; set; }
        public string Source { get; set; }
        public string Device { get; set; }
        public string City { get; set; }
        public string RegionCode { get; set; }
        public string CountryCode { get; set; }
        public string VisitorId { get; set; }
        public int? EntityId { get; set; }
        public string Search { get; set; }
    }

    public class ViewLogRow
    {
        public long Id { get; set; }
        public DateTime CreatedDate { get; set; }
        public string Path { get; set; }
        public string PageType { get; set; }
        public int? EntityId { get; set; }
        public string Title { get; set; }
        public string Location { get; set; }
        public string Source { get; set; }
        public bool IsEntry { get; set; }
        public string Device { get; set; }
        public string VisitorId { get; set; }
    }

    public class EntityViewCounts
    {
        public int Total { get; set; }
        public int Last30Days { get; set; }
    }

    public class AnalyticsRepository
    {
        private readonly string _connectionString;
        public AnalyticsRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public void AddPageView(PageView view)
        {
            using var context = new GownDataContext(_connectionString);
            context.PageViews.Add(view);
            context.SaveChanges();
        }

        public void AddEvent(SiteEvent siteEvent)
        {
            using var context = new GownDataContext(_connectionString);
            context.SiteEvents.Add(siteEvent);
            context.SaveChanges();
        }

        // Just the two columns the overview needs, so "today"/"this week"/the daily chart
        // can be bucketed by Eastern-time calendar day in memory — SQL Server can do the
        // time-zone conversion (AT TIME ZONE) but EF has no translation for it.
        public List<(DateTime CreatedDate, string VisitorId)> GetViewStampsSince(DateTime fromUtc)
        {
            using var context = new GownDataContext(_connectionString);
            return context.PageViews
                .Where(v => v.CreatedDate >= fromUtc)
                .Select(v => new { v.CreatedDate, v.VisitorId })
                .AsEnumerable()
                .Select(v => (v.CreatedDate, v.VisitorId))
                .ToList();
        }

        public int CountAllViews()
        {
            using var context = new GownDataContext(_connectionString);
            return context.PageViews.Count();
        }

        public DateTime? FirstViewDate()
        {
            using var context = new GownDataContext(_connectionString);
            return context.PageViews.OrderBy(v => v.CreatedDate).Select(v => (DateTime?)v.CreatedDate).FirstOrDefault();
        }

        public List<CountRow> TopCities(DateTime? fromUtc, int take)
        {
            using var context = new GownDataContext(_connectionString);
            var views = ViewsSince(context, fromUtc);
            var total = views.Count();
            return CityRows(views, total).Take(take).ToList();
        }

        public AnalyticsBreakdown GetBreakdown(DateTime? fromUtc)
        {
            using var context = new GownDataContext(_connectionString);
            var views = ViewsSince(context, fromUtc);
            var events = context.SiteEvents.Where(e => fromUtc == null || e.CreatedDate >= fromUtc);

            var total = views.Count();
            var visitors = views.Select(v => v.VisitorId).Distinct().Count();

            var regions = views
                .GroupBy(v => new { v.CountryCode, v.Country, v.RegionCode, v.Region })
                .Select(g => new { g.Key.CountryCode, g.Key.Country, g.Key.RegionCode, g.Key.Region, Count = g.Count() })
                .AsEnumerable()
                // Within the US, the state is the useful level; elsewhere just the country.
                .GroupBy(r => r.CountryCode == "US"
                    // "none" so clicking the state-unknown row filters to exactly those views,
                    // rather than (with a null region) to every US view.
                    ? (Label: r.Region ?? "United States (state unknown)", Region: r.RegionCode ?? "none", Country: r.CountryCode)
                    : (Label: r.Country ?? "Unknown", Region: (string)null, Country: r.CountryCode))
                .Select(g => new CountRow
                {
                    Label = g.Key.Label,
                    RegionCode = g.Key.Region,
                    CountryCode = g.Key.Country,
                    Count = g.Sum(r => r.Count),
                    Percent = Percent(g.Sum(r => r.Count), total)
                })
                .OrderByDescending(r => r.Count)
                .Take(15)
                .ToList();

            // Source only means anything on the first page of a visit (see PageView.IsEntry),
            // so these percentages are "share of visits", not "share of page views".
            var entryViews = views.Where(v => v.IsEntry);
            var entryTotal = entryViews.Count();
            var sources = entryViews
                .GroupBy(v => v.Source)
                .Select(g => new { g.Key, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .Take(15)
                .AsEnumerable()
                .Select(g => new CountRow { Label = g.Key ?? "Direct", Key = g.Key ?? "Direct", Count = g.Count, Percent = Percent(g.Count, entryTotal) })
                .ToList();

            var devices = SimpleRows(views.GroupBy(v => v.Device).Select(g => new KeyCount { Key = g.Key, Count = g.Count() }), total, "Unknown");
            var pageTypes = SimpleRows(views.GroupBy(v => v.PageType).Select(g => new KeyCount { Key = g.Key, Count = g.Count() }), total, "Other");

            var topPages = views
                .GroupBy(v => new { v.PageType, v.EntityId, v.Path })
                .Select(g => new TopPageRow
                {
                    PageType = g.Key.PageType,
                    EntityId = g.Key.EntityId,
                    Path = g.Key.Path,
                    Count = g.Count(),
                    Visitors = g.Select(v => v.VisitorId).Distinct().Count()
                })
                .OrderByDescending(p => p.Count)
                .Take(15)
                .ToList();
            FillTitles(context, topPages.Select(p => (p.PageType, p.EntityId)), (i, title) => topPages[i].Title = title);

            var noResults = events
                .Where(e => e.Type == SiteEventTypes.SearchNoResults)
                .GroupBy(e => e.Detail)
                .Select(g => new NoResultSearchRow { Detail = g.Key, Count = g.Count(), LastSeen = g.Max(e => e.CreatedDate) })
                .OrderByDescending(r => r.Count).ThenByDescending(r => r.LastSeen)
                .Take(20)
                .ToList();
            noResults.ForEach(r => r.LastSeen = DateTime.SpecifyKind(r.LastSeen, DateTimeKind.Utc));

            var funnel = new FunnelCounts
            {
                Visitors = visitors,
                Signups = events.Count(e => e.Type == SiteEventTypes.Signup),
                GownsPosted = context.Gowns.Count(g => g.ModerationStatus != ModerationStatus.Draft && (fromUtc == null || g.CreatedDate >= fromUtc)),
                GownContactVisitors = events.Where(e => e.Type == SiteEventTypes.GownContact).Select(e => e.VisitorId).Distinct().Count(),
                AdContactVisitors = events.Where(e => e.Type == SiteEventTypes.AdContact).Select(e => e.VisitorId).Distinct().Count()
            };

            return new AnalyticsBreakdown
            {
                TotalViews = total,
                UniqueVisitors = visitors,
                Cities = CityRows(views, total).Take(15).ToList(),
                Regions = regions,
                Sources = sources,
                Devices = devices,
                PageTypes = pageTypes,
                TopPages = topPages,
                NoResultSearches = noResults,
                Funnel = funnel,
                Ads = GetAdPerformance(context, fromUtc)
            };
        }

        public (List<ViewLogRow> Items, int TotalCount) GetViewLog(ViewLogFilter filter, int page, int pageSize, int? maxRows = null)
        {
            using var context = new GownDataContext(_connectionString);
            var query = context.PageViews.AsQueryable();

            if (filter.FromUtc.HasValue) query = query.Where(v => v.CreatedDate >= filter.FromUtc);
            if (filter.ToUtc.HasValue) query = query.Where(v => v.CreatedDate < filter.ToUtc);
            if (!string.IsNullOrEmpty(filter.PageType)) query = query.Where(v => v.PageType == filter.PageType);
            if (!string.IsNullOrEmpty(filter.Source))
            {
                query = filter.Source == "Direct"
                    ? query.Where(v => v.IsEntry && v.Source == null)
                    : query.Where(v => v.Source == filter.Source);
            }
            if (!string.IsNullOrEmpty(filter.Device)) query = query.Where(v => v.Device == filter.Device);
            if (!string.IsNullOrEmpty(filter.City)) query = query.Where(v => v.City == filter.City);
            if (filter.RegionCode == "none") query = query.Where(v => v.RegionCode == null);
            else if (!string.IsNullOrEmpty(filter.RegionCode)) query = query.Where(v => v.RegionCode == filter.RegionCode);
            // "none" is the "Unknown" location row — visits the GeoIP lookup couldn't place.
            if (filter.CountryCode == "none") query = query.Where(v => v.CountryCode == null);
            else if (!string.IsNullOrEmpty(filter.CountryCode)) query = query.Where(v => v.CountryCode == filter.CountryCode);
            if (!string.IsNullOrEmpty(filter.VisitorId)) query = query.Where(v => v.VisitorId == filter.VisitorId);
            if (filter.EntityId.HasValue) query = query.Where(v => v.EntityId == filter.EntityId);
            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                var s = filter.Search.Trim();
                query = query.Where(v => v.Path.Contains(s) || v.City.Contains(s) || v.Region.Contains(s) || v.Country.Contains(s) || v.Source.Contains(s));
            }

            var totalCount = query.Count();
            var take = maxRows ?? pageSize;
            var rows = query
                .OrderByDescending(v => v.CreatedDate).ThenByDescending(v => v.Id)
                .Skip(maxRows.HasValue ? 0 : (page - 1) * pageSize)
                .Take(take)
                .ToList();

            var items = rows.Select(v => new ViewLogRow
            {
                Id = v.Id,
                CreatedDate = DateTime.SpecifyKind(v.CreatedDate, DateTimeKind.Utc),
                Path = v.Path,
                PageType = v.PageType,
                EntityId = v.EntityId,
                Location = LocationLabel(v.City, v.RegionCode, v.Region, v.Country, v.CountryCode),
                Source = v.IsEntry ? (v.Source ?? "Direct") : null,
                IsEntry = v.IsEntry,
                Device = v.Device,
                VisitorId = v.VisitorId
            }).ToList();
            FillTitles(context, items.Select(i => (i.PageType, i.EntityId)), (i, title) => items[i].Title = title);

            return (items, totalCount);
        }

        public Dictionary<int, EntityViewCounts> GetEntityViewCounts(string pageType, List<int> ids, DateTime last30Utc)
        {
            using var context = new GownDataContext(_connectionString);
            return context.PageViews
                .Where(v => v.PageType == pageType && v.EntityId != null && ids.Contains(v.EntityId.Value))
                .GroupBy(v => v.EntityId.Value)
                .Select(g => new { Id = g.Key, Total = g.Count(), Last30 = g.Count(v => v.CreatedDate >= last30Utc) })
                .ToDictionary(g => g.Id, g => new EntityViewCounts { Total = g.Total, Last30Days = g.Last30 });
        }

        public Dictionary<int, int> GetEventCounts(string type, List<int> ids)
        {
            using var context = new GownDataContext(_connectionString);
            return context.SiteEvents
                .Where(e => e.Type == type && e.EntityId != null && ids.Contains(e.EntityId.Value))
                .GroupBy(e => e.EntityId.Value)
                .Select(g => new { Id = g.Key, Count = g.Count() })
                .ToDictionary(g => g.Id, g => g.Count);
        }

        public bool HasRecentPageView(string visitorId, string path, DateTime sinceUtc)
        {
            using var context = new GownDataContext(_connectionString);
            return context.PageViews.Any(v => v.VisitorId == visitorId && v.Path == path && v.CreatedDate >= sinceUtc);
        }

        public bool HasRecentEvent(string type, int? entityId, string visitorId, DateTime sinceUtc)
        {
            using var context = new GownDataContext(_connectionString);
            return context.SiteEvents.Any(e => e.Type == type && e.EntityId == entityId && e.VisitorId == visitorId && e.CreatedDate >= sinceUtc);
        }

        public int? GetListingOwnerId(string pageType, int id)
        {
            using var context = new GownDataContext(_connectionString);
            return pageType switch
            {
                "Gown" => context.Gowns.Where(g => g.Id == id).Select(g => (int?)g.OwnerId).FirstOrDefault(),
                "Ad" => context.Ads.Where(a => a.Id == id).Select(a => a.OwnerId).FirstOrDefault(),
                _ => null
            };
        }

        // Retention — raw rows older than this are no longer needed once they've aged out
        // of every range the admin page offers.
        public int DeleteOlderThan(DateTime cutoffUtc)
        {
            using var context = new GownDataContext(_connectionString);
            var views = context.PageViews.Where(v => v.CreatedDate < cutoffUtc).ExecuteDelete();
            var events = context.SiteEvents.Where(e => e.CreatedDate < cutoffUtc).ExecuteDelete();
            return views + events;
        }

        public static string LocationLabel(string city, string regionCode, string region, string country, string countryCode)
        {
            var place = countryCode == "US" ? (regionCode ?? region) : country;
            if (!string.IsNullOrEmpty(city) && !string.IsNullOrEmpty(place)) return $"{city}, {place}";
            if (!string.IsNullOrEmpty(city)) return city;
            if (countryCode == "US" && !string.IsNullOrEmpty(region)) return $"{region}, USA";
            return country ?? "Unknown";
        }

        private static IQueryable<PageView> ViewsSince(GownDataContext context, DateTime? fromUtc) =>
            context.PageViews.Where(v => fromUtc == null || v.CreatedDate >= fromUtc);

        private static IEnumerable<CountRow> CityRows(IQueryable<PageView> views, int total) =>
            views
                .GroupBy(v => new { v.City, v.RegionCode, v.Region, v.Country, v.CountryCode })
                .Select(g => new { g.Key.City, g.Key.RegionCode, g.Key.Region, g.Key.Country, g.Key.CountryCode, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .Take(50)
                .AsEnumerable()
                .Select(g => new CountRow
                {
                    Label = LocationLabel(g.City, g.RegionCode, g.Region, g.Country, g.CountryCode),
                    City = g.City,
                    RegionCode = g.RegionCode,
                    CountryCode = g.CountryCode,
                    Count = g.Count,
                    Percent = Percent(g.Count, total)
                });

        private class KeyCount
        {
            public string Key { get; set; }
            public int Count { get; set; }
        }

        private static List<CountRow> SimpleRows(IQueryable<KeyCount> grouped, int total, string nullLabel) =>
            grouped
                .OrderByDescending(g => g.Count)
                .AsEnumerable()
                .Select(g => new CountRow { Label = g.Key ?? nullLabel, Key = g.Key, Count = g.Count, Percent = Percent(g.Count, total) })
                .ToList();

        private static List<AdPerformanceRow> GetAdPerformance(GownDataContext context, DateTime? fromUtc)
        {
            var ads = context.Ads
                .Where(a => a.IsActive)
                .Select(a => new { a.Id, a.Title })
                .ToList();
            if (ads.Count == 0) return new List<AdPerformanceRow>();
            var ids = ads.Select(a => a.Id).ToList();

            var eventCounts = context.SiteEvents
                .Where(e => (fromUtc == null || e.CreatedDate >= fromUtc) && e.EntityId != null && ids.Contains(e.EntityId.Value)
                    && (e.Type == SiteEventTypes.AdImpression || e.Type == SiteEventTypes.AdClick || e.Type == SiteEventTypes.AdLinkClick || e.Type == SiteEventTypes.AdContact))
                .GroupBy(e => new { e.EntityId, e.Type })
                .Select(g => new { g.Key.EntityId, g.Key.Type, Count = g.Count() })
                .ToList();
            var viewCounts = context.PageViews
                .Where(v => (fromUtc == null || v.CreatedDate >= fromUtc) && v.PageType == "Ad" && v.EntityId != null && ids.Contains(v.EntityId.Value))
                .GroupBy(v => v.EntityId)
                .Select(g => new { EntityId = g.Key, Count = g.Count() })
                .ToDictionary(g => g.EntityId.Value, g => g.Count);

            int EventCount(int id, string type) => eventCounts.FirstOrDefault(e => e.EntityId == id && e.Type == type)?.Count ?? 0;

            return ads
                .Select(a => new AdPerformanceRow
                {
                    AdId = a.Id,
                    Title = a.Title,
                    Impressions = EventCount(a.Id, SiteEventTypes.AdImpression),
                    CardClicks = EventCount(a.Id, SiteEventTypes.AdClick),
                    Views = viewCounts.GetValueOrDefault(a.Id),
                    WebsiteClicks = EventCount(a.Id, SiteEventTypes.AdLinkClick),
                    Contacts = EventCount(a.Id, SiteEventTypes.AdContact)
                })
                .OrderByDescending(r => r.Impressions + r.Views)
                .ToList();
        }

        // Gown/Ad rows store only an id — look up a human-readable label for each in one
        // query per table rather than one per row.
        private static void FillTitles(GownDataContext context, IEnumerable<(string PageType, int? EntityId)> rows, Action<int, string> setTitle)
        {
            var list = rows.ToList();
            var gownIds = list.Where(r => r.PageType == "Gown" && r.EntityId.HasValue).Select(r => r.EntityId.Value).Distinct().ToList();
            var adIds = list.Where(r => r.PageType == "Ad" && r.EntityId.HasValue).Select(r => r.EntityId.Value).Distinct().ToList();

            var gownTitles = gownIds.Count == 0 ? new Dictionary<int, string>() : context.Gowns
                .Where(g => gownIds.Contains(g.Id))
                .Select(g => new { g.Id, g.Brand, g.Color, g.Size, g.Description })
                .AsEnumerable()
                .ToDictionary(g => g.Id, g => GownTitle(g.Brand, g.Color, g.Size, g.Description));
            var adTitles = adIds.Count == 0 ? new Dictionary<int, string>() : context.Ads
                .Where(a => adIds.Contains(a.Id))
                .Select(a => new { a.Id, a.Title })
                .ToDictionary(a => a.Id, a => a.Title);

            for (var i = 0; i < list.Count; i++)
            {
                var (pageType, entityId) = list[i];
                if (!entityId.HasValue) continue;
                if (pageType == "Gown") setTitle(i, gownTitles.GetValueOrDefault(entityId.Value) ?? "(deleted gown)");
                else if (pageType == "Ad") setTitle(i, adTitles.GetValueOrDefault(entityId.Value) ?? "(deleted ad)");
            }
        }

        // Gowns have no title field, so build a short one from what a shopper would
        // recognize: brand, color(s), size(s) — falling back to the description's start.
        private static string GownTitle(string brand, string color, string size, string description)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(brand)) parts.Add(brand.Trim());
            if (!string.IsNullOrWhiteSpace(color)) parts.Add(color.Replace(",", "/"));
            if (!string.IsNullOrWhiteSpace(size)) parts.Add($"Size {size.Replace(",", "/")}");
            if (parts.Count > 0) return string.Join(" · ", parts);
            if (string.IsNullOrWhiteSpace(description)) return "Gown";
            return description.Length > 50 ? description[..50] + "…" : description;
        }

        private static double Percent(int count, int total) =>
            total == 0 ? 0 : Math.Round(count * 100.0 / total, 1);
    }
}
