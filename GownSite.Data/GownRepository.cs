using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public class GownSearchFilters
    {
        public List<string> Colors { get; set; } = new();
        public List<string> Sizes { get; set; } = new();
        public List<string> Locations { get; set; } = new();
        public List<string> Styles { get; set; } = new();
        public List<ListingType> ListingTypes { get; set; } = new();
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        // Free-text words left over after the search bar pulls out colors/sizes/styles etc.
        // (e.g. "lace long sleeve"), matched against the description and other text fields.
        public string Keywords { get; set; }
        // When true, results also include near-misses (neighboring sizes, related colors and
        // styles) after the exact matches — see GownSearchMatcher. Off by default so callers
        // like the no-results analytics re-check keep their strict meaning.
        public bool IncludeSimilar { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 24;
    }

    public class GownSearchResult
    {
        public List<GownPosting> Items { get; set; }
        public int TotalCount { get; set; }
        // Items are ordered exact matches first, then close, then the rest — so the client
        // can tell which group any result belongs to from its overall position alone.
        public int ExactCount { get; set; }
        public int CloseCount { get; set; }
    }

    public class HomeShowcaseStyle
    {
        public string Style { get; set; }
        public string ImageUrl { get; set; }
        public int Count { get; set; }
    }

    public class HomeShowcase
    {
        public List<GownPosting> Newest { get; set; }
        public List<HomeShowcaseStyle> Styles { get; set; }
        public List<string> Colors { get; set; }
        public List<HomeShowcaseBrand> Brands { get; set; }
    }

    public class HomeShowcaseBrand
    {
        public string Name { get; set; }
        public string SearchTerm { get; set; }
        public string ImageUrl { get; set; }
        public int Count { get; set; }
        public int Tier { get; set; }
    }

    public class GownRepository
    {
        private readonly string _connectionString;
        public GownRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        // No Owner include — this backs the public, unauthenticated /api/gown/search
        // response (the main browse page), and nothing in the search results UI reads
        // owner data. Including it here would serialize every matching listing's owner
        // Name/Number/Email into one response, the same leak class as Get(int id) above.
        public GownSearchResult Search(GownSearchFilters filters)
        {
            using var context = new GownDataContext(_connectionString);
            var query = context.Gowns
                .Include(g => g.MorePictures)
                .Where(g => g.IsActive)
                .AsQueryable();

            if (filters.Locations.Count > 0)
                query = query.Where(g => filters.Locations.Contains(g.Location));
            if (filters.ListingTypes.Count > 0)
                query = query.Where(g => filters.ListingTypes.Contains(g.ListingType));
            // A range-priced gown (PriceMax set) matches a price filter if the two ranges
            // overlap at all, not just if its low end falls inside the filter window.
            if (filters.MinPrice.HasValue)
                query = query.Where(g => (g.PriceMax ?? g.Price) >= filters.MinPrice.Value);
            if (filters.MaxPrice.HasValue)
                query = query.Where(g => g.Price <= filters.MaxPrice.Value);

            var candidates = query.OrderByDescending(g => g.CreatedDate).ToList();

            // Color/size/style/keywords are graded per gown rather than filtered in SQL (they're
            // comma-separated strings, and near-misses need ranking, not just a yes/no).
            // Ordering: match group, then sold gowns last within each group, then best score,
            // then — only meaningful with a single color selected — the gown that's mostly that
            // color, then newest (OrderBy is stable over the CreatedDate order above).
            var keywords = GownSearchMatcher.ParseKeywords(filters.Keywords);
            var targetColor = filters.Colors.Count == 1 ? filters.Colors[0] : null;
            var results = candidates
                .Select(g => (Gown: g, Match: GownSearchMatcher.Evaluate(g, filters, keywords)))
                .Where(x => x.Match.Tier == GownMatchTier.Exact
                    || (filters.IncludeSimilar && x.Match.Tier != GownMatchTier.None))
                .OrderBy(x => x.Match.Tier)
                .ThenBy(x => x.Gown.IsSold)
                .ThenByDescending(x => x.Match.Score)
                .ThenByDescending(x => targetColor == null ? 0 : GetColorScore(x.Gown.ColorScoresJson, targetColor))
                .ToList();

            var page = filters.Page < 1 ? 1 : filters.Page;
            var pageSize = filters.PageSize < 1 ? 24 : filters.PageSize;
            return new GownSearchResult
            {
                Items = results.Skip((page - 1) * pageSize).Take(pageSize).Select(x => x.Gown).ToList(),
                TotalCount = results.Count,
                ExactCount = results.Count(x => x.Match.Tier == GownMatchTier.Exact),
                CloseCount = results.Count(x => x.Match.Tier == GownMatchTier.Close)
            };
        }

        // Everything the home page needs in one call: the newest available gowns, plus which
        // styles, colors and designers currently have at least one available (live, unsold)
        // gown — the home page only offers shortcuts that actually lead somewhere. Same
        // no-Owner rule as Search, since this is public too.
        public HomeShowcase GetHomeShowcase(IEnumerable<string> styles, int newestCount, int maxBrands)
        {
            using var context = new GownDataContext(_connectionString);
            // This runs on every home page view, so the style/color/brand scan reads only the
            // columns it needs; full rows (with pictures) are loaded just for the newest few.
            var available = context.Gowns
                .Where(g => g.IsActive && !g.IsSold)
                .OrderByDescending(g => g.CreatedDate)
                .Select(g => new { g.Id, g.StyleTags, g.Color, g.PrimaryPictureUrl, g.Brand })
                .ToList();

            List<string> SplitTags(string s) => (s ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

            // A gown tagged with several styles would otherwise put the same photo on several
            // tiles — prefer the newest gown not already used for another tile.
            var usedIds = new HashSet<int>();
            var styleTiles = new List<HomeShowcaseStyle>();
            foreach (var style in styles)
            {
                var gowns = available.Where(g => SplitTags(g.StyleTags).Contains(style)).ToList();
                if (gowns.Count == 0) continue;
                var cover = gowns.FirstOrDefault(g => !usedIds.Contains(g.Id)) ?? gowns[0];
                usedIds.Add(cover.Id);
                styleTiles.Add(new HomeShowcaseStyle { Style = style, ImageUrl = cover.PrimaryPictureUrl, Count = gowns.Count });
            }

            return new HomeShowcase
            {
                Newest = context.Gowns
                    .Include(g => g.MorePictures)
                    .Where(g => g.IsActive && !g.IsSold)
                    .OrderByDescending(g => g.CreatedDate)
                    .Take(newestCount)
                    .ToList(),
                Styles = styleTiles,
                Colors = available.SelectMany(g => SplitTags(g.Color)).Distinct().ToList(),
                // Brand is free text typed by the seller: non-designers ("Custom", "N/A") are
                // dropped, spellings of the same designer are grouped, and the best-known names
                // lead (see DesignerDirectory), then whichever has the most gowns. The button
                // searches by the sellers' own most common spelling, since that's what the
                // keyword search will find in their listings.
                Brands = GroupDesigners(available.Select(g => (g.Brand, g.PrimaryPictureUrl)))
                    .Take(maxBrands)
                    .ToList()
            };
        }

        // `gowns` must be newest-first: each designer's photo is its newest gown's. Known
        // designers group under their proper name; unknown ones group with any earlier entry
        // spelled within a typo or two ("Isabella Sanchez" / "Isabella Sanchiz").
        private static IEnumerable<HomeShowcaseBrand> GroupDesigners(IEnumerable<(string Brand, string PictureUrl)> gowns)
        {
            var groups = new List<(string Key, (string Name, int Tier)? Known, List<(string Spelling, string PictureUrl)> Gowns)>();
            foreach (var (brand, pictureUrl) in gowns)
            {
                if (!DesignerDirectory.IsDesigner(brand)) continue;
                var spelling = brand.Trim();
                var known = DesignerDirectory.Lookup(spelling);
                var key = known?.Name ?? DesignerDirectory.Normalize(spelling);
                var group = groups.FirstOrDefault(g => known != null
                    ? g.Known?.Name == known.Value.Name
                    : g.Known == null && DesignerDirectory.IsCloseSpelling(g.Key, key));
                if (group.Gowns == null)
                {
                    group = (key, known, new List<(string, string)>());
                    groups.Add(group);
                }
                group.Gowns.Add((spelling, pictureUrl));
            }

            return groups
                .Select(g =>
                {
                    var commonSpelling = g.Gowns.GroupBy(x => x.Spelling).OrderByDescending(s => s.Count()).First().Key;
                    return new HomeShowcaseBrand
                    {
                        Name = g.Known?.Name ?? commonSpelling,
                        SearchTerm = commonSpelling,
                        ImageUrl = g.Gowns[0].PictureUrl,
                        Count = g.Gowns.Count,
                        Tier = g.Known?.Tier ?? DesignerDirectory.Unranked
                    };
                })
                .OrderByDescending(b => b.Tier)
                .ThenByDescending(b => b.Count)
                .ThenBy(b => b.Name);
        }

        public List<string> GetDistinctLocations()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Where(g => g.ModerationStatus != ModerationStatus.Rejected && g.ModerationStatus != ModerationStatus.Removed)
                .Select(g => g.Location)
                .Where(l => !string.IsNullOrEmpty(l))
                .Distinct()
                .OrderBy(l => l)
                .ToList();
        }

        // Deliberately does NOT include Owner — this backs the public /api/gown/get response
        // (and most other call sites, which only need the posting's own fields), and Owner
        // has no [JsonIgnore] on Name/Number/Email, so including it here would serialize a
        // patron's contact info into that public payload regardless of their
        // DisplayOwnerName/Number/Email choices. Callers that genuinely need Owner (sending
        // an email, building the gated Inquire response) should use GetWithOwner instead.
        public GownPosting Get(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.MorePictures)
                .FirstOrDefault(g => g.Id == id);
        }

        public GownPosting GetWithOwner(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .FirstOrDefault(g => g.Id == id);
        }

        // Whether My Listings would show this owner anything at all — any gown or ad, in any
        // state (same unfiltered sets as GetByOwner and AdRepository.GetByOwner). Backs the
        // header's My Listings link, which only appears once there's something to manage.
        public bool OwnerHasListingsOrAds(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns.Any(g => g.OwnerId == ownerId) || context.Ads.Any(a => a.OwnerId == ownerId);
        }

        public List<GownPosting> GetByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.MorePictures)
                .Include(g => g.PromoCode)
                .Where(g => g.OwnerId == ownerId)
                .OrderByDescending(g => g.CreatedDate)
                .ToList();
        }

        public int CountActiveByOwner(int ownerId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns.Count(g => g.OwnerId == ownerId && g.IsActive);
        }

        public int Create(GownPosting posting)
        {
            using var context = new GownDataContext(_connectionString);
            posting.CreatedDate = DateTime.UtcNow;
            posting.IsActive = false;
            posting.InquiryCount = 0;
            posting.ModerationStatus = ModerationStatus.Draft;
            context.Gowns.Add(posting);
            context.SaveChanges();
            return posting.Id;
        }

        public void Update(GownPosting posting)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == posting.Id);
            if (existing == null) return;

            existing.Description = posting.Description;
            existing.Color = posting.Color;
            existing.Size = posting.Size;
            existing.Price = posting.Price;
            existing.PriceMax = posting.PriceMax;
            existing.Location = posting.Location;
            existing.ListingType = posting.ListingType;
            existing.DisplayOwnerName = posting.DisplayOwnerName;
            existing.DisplayOwnerNumber = posting.DisplayOwnerNumber;
            existing.DisplayOwnerEmail = posting.DisplayOwnerEmail;
            existing.Brand = posting.Brand;
            existing.PricePaid = posting.PricePaid;
            existing.Condition = posting.Condition;
            existing.Length = posting.Length;
            existing.StyleTags = posting.StyleTags;
            existing.Notes = posting.Notes;
            context.SaveChanges();
        }

        public void SetPrimaryPicture(int id, string url)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.PrimaryPictureUrl = url;
            context.SaveChanges();
        }

        public void SetColorScores(int id, string colorScoresJson)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ColorScoresJson = colorScoresJson;
            context.SaveChanges();
        }

        // Null/missing (a gown scored before this feature shipped, or tagged with a
        // non-solid option like Floral/Multi/Other that never gets a score) sorts last.
        // If every candidate is missing — e.g. the selected color is one of those
        // non-solid options — this is a no-op and the prior CreatedDate order survives,
        // since OrderByDescending is a stable sort.
        private static double GetColorScore(string colorScoresJson, string color)
        {
            if (string.IsNullOrEmpty(colorScoresJson)) return double.MinValue;
            try
            {
                var scores = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, double>>(colorScoresJson);
                return scores != null && scores.TryGetValue(color, out var score) ? score : double.MinValue;
            }
            catch (System.Text.Json.JsonException)
            {
                return double.MinValue;
            }
        }

        public void ActivateListing(int id, string stripeSubscriptionId, string stripeCustomerId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsActive = true;
            existing.StripeSubscriptionId = stripeSubscriptionId;
            existing.StripeCustomerId = stripeCustomerId;
            existing.ModerationStatus = ModerationStatus.Approved;
            context.SaveChanges();
        }

        public void SubmitForReview(int id, string stripeCustomerId, string stripePaymentMethodId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.StripeCustomerId = stripeCustomerId;
            existing.StripePaymentMethodId = stripePaymentMethodId;
            existing.ModerationStatus = ModerationStatus.PendingReview;
            context.SaveChanges();
        }

        // Returns whether this call actually changed the row's PromoCodeId (vs. re-applying the
        // code already on it) — callers use this to decide whether to count a redemption. The
        // PromoCodeId change is detected and written in one atomic conditional UPDATE (not a
        // SELECT followed by a separate write), so two concurrent calls for the same row can't
        // both see "not yet applied" and both report a new application.
        public bool ApplyPromo(int id, int promoCodeId, decimal? monthlyFeeOverride, int? promoDurationMonths)
        {
            using var context = new GownDataContext(_connectionString);
            var isNewApplication = context.Gowns
                .Where(g => g.Id == id && g.PromoCodeId != promoCodeId)
                .ExecuteUpdate(s => s.SetProperty(g => g.PromoCodeId, promoCodeId)) > 0;

            context.Gowns.Where(g => g.Id == id)
                .ExecuteUpdate(s => s
                    .SetProperty(g => g.MonthlyFeeOverride, monthlyFeeOverride)
                    .SetProperty(g => g.PromoDurationMonths, promoDurationMonths));

            return isNewApplication;
        }

        // Writes the same promo to every id in one atomic UPDATE, so a mid-write failure (a
        // transient DB error) can't leave some gowns in the batch discounted and others not.
        // Returns the number of rows actually matched/updated — callers should compare this
        // against the number of ids requested, since an id can vanish (e.g. concurrent delete)
        // between an earlier validation pass and this call.
        public int ApplyPromoToBatch(IEnumerable<int> ids, int promoCodeId, decimal? monthlyFeeOverride, int? promoDurationMonths)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns.Where(g => ids.Contains(g.Id))
                .ExecuteUpdate(s => s
                    .SetProperty(g => g.PromoCodeId, promoCodeId)
                    .SetProperty(g => g.MonthlyFeeOverride, monthlyFeeOverride)
                    .SetProperty(g => g.PromoDurationMonths, promoDurationMonths));
        }

        public List<GownPosting> GetActive()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Include(g => g.PromoCode)
                .Where(g => g.IsActive)
                .OrderByDescending(g => g.CreatedDate)
                .ToList();
        }

        public void TakeDown(int id, string reason)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsActive = false;
            existing.ModerationStatus = ModerationStatus.Removed;
            existing.RejectionReason = reason;
            context.SaveChanges();
        }

        public List<GownPosting> GetPendingReview()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Include(g => g.PromoCode)
                .Where(g => g.ModerationStatus == ModerationStatus.PendingReview)
                .OrderBy(g => g.CreatedDate)
                .ToList();
        }

        public void ApproveListing(int id, string stripeSubscriptionId)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.Approved;
            existing.IsActive = true;
            existing.StripeSubscriptionId = stripeSubscriptionId;
            context.SaveChanges();
        }

        public void RejectListing(int id, string reason)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.Rejected;
            existing.RejectionReason = reason;
            context.SaveChanges();
        }

        // Lets an owner send a Rejected listing back into the review queue after fixing
        // whatever the admin flagged, instead of deleting it and drafting a new one from
        // scratch. Reuses the Stripe customer/payment method already on file from the
        // listing's original card-setup step, so no new payment info is needed.
        public void ResubmitListing(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.ModerationStatus = ModerationStatus.PendingReview;
            existing.RejectionReason = null;
            context.SaveChanges();
        }

        public void CancelListing(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsActive = false;
            context.SaveChanges();
        }

        public void MarkSold(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.IsSold = true;
            context.SaveChanges();
        }

        public void IncrementInquiry(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.InquiryCount++;
            context.SaveChanges();
        }

        public List<GownPosting> GetConciergeQueue()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Include(g => g.MorePictures)
                .Where(g => g.NeedsConciergeDraft)
                .OrderBy(g => g.CreatedDate)
                .ToList();
        }

        public void MarkConciergeReady(int id, decimal oneTimeFeeUsd)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            existing.NeedsConciergeDraft = false;
            existing.OneTimeFeeUsd = oneTimeFeeUsd;
            context.SaveChanges();
        }

        public List<GownPosting> GetByBatchId(Guid batchId)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Gowns
                .Include(g => g.Owner)
                .Where(g => g.BatchId == batchId)
                .ToList();
        }

        public void AddPictures(int gownPostingId, List<string> urls)
        {
            using var context = new GownDataContext(_connectionString);
            int order = 0;
            foreach (var url in urls)
            {
                context.GownPictures.Add(new GownPicture
                {
                    GownPostingId = gownPostingId,
                    Url = url,
                    SortOrder = order++
                });
            }
            context.SaveChanges();
        }

        public void RemovePictures(int gownPostingId, List<int> pictureIds)
        {
            if (pictureIds == null || pictureIds.Count == 0) return;
            using var context = new GownDataContext(_connectionString);
            var toRemove = context.GownPictures
                .Where(p => p.GownPostingId == gownPostingId && pictureIds.Contains(p.Id))
                .ToList();
            context.GownPictures.RemoveRange(toRemove);
            context.SaveChanges();
        }

        // Only ever called on a Draft or a still-PendingReview listing (see
        // GownController.DeleteDraft) — neither has gone live yet, so there's no active
        // Stripe subscription to cancel first. GownPicture's FK uses
        // DeleteBehavior.Restrict (see GownDataContext), so its rows must be removed
        // before the GownPosting row itself.
        public void DeleteDraft(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.Gowns.Include(g => g.MorePictures).FirstOrDefault(g => g.Id == id);
            if (existing == null) return;

            context.GownPictures.RemoveRange(existing.MorePictures);
            context.Gowns.Remove(existing);
            context.SaveChanges();
        }
    }
}
