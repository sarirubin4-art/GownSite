using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public enum GownMatchTier
    {
        Exact,
        // Every requested criterion matched at least loosely (a neighboring size, a related
        // color or style, some of the keywords).
        Close,
        // Exactly one requested criterion missed outright, everything else matched — the
        // "far-fetched but still worth a look" bucket.
        More,
        None
    }

    // Grades how well one gown fits the "soft" search criteria (color, size, style,
    // keywords). Location, Rent/Sale and price are hard filters applied before this runs —
    // a shopper in Lakewood isn't helped by a perfect match in Toronto, and a price cap is
    // a real budget — so they never loosen.
    //
    // Each specified criterion scores 2 (exact), 1 (near) or 0 (miss). Size is the one
    // criterion that can also rule a gown out completely: more than two sizes away isn't a
    // dress the shopper can wear, however well the rest matches.
    public static class GownSearchMatcher
    {
        private const int Exact = 2, Near = 1, Miss = 0, Excluded = -1;

        // Separate ladders — a women's 8 and a Girls 8 aren't neighbors. Distance is the
        // number of steps apart within the same ladder.
        private static readonly string[][] SizeLadders =
        {
            new[] { "00", "0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20", "22", "24", "26" },
            new[] { "Girls 12M", "Girls 18M", "Girls 24M", "Girls 2T", "Girls 3T", "Girls 4T", "Girls 4", "Girls 5",
                    "Girls 6", "Girls 6X", "Girls 7", "Girls 8", "Girls 10", "Girls 12", "Girls 14", "Girls 16" },
            new[] { "Maternity XS", "Maternity S", "Maternity M", "Maternity L", "Maternity XL" }
        };

        // Symmetric "a shopper asking for one would probably consider the other" pairs.
        private static readonly (string, string)[] RelatedColorPairs =
        {
            ("Ivory/White", "Champagne"), ("Ivory/White", "Beige"), ("Champagne", "Beige"), ("Champagne", "Blush"),
            ("Blush", "Pink"), ("Pink", "Purple"), ("Burgundy", "Purple"), ("Burgundy", "Pink"),
            ("Navy", "Blue"), ("Navy", "Black"), ("Emerald", "Sage"), ("Silver", "Gold"), ("Floral", "Multi")
        };

        private static readonly (string, string)[] RelatedStylePairs =
        {
            ("MotherOfBrideOrGroom", "Evening"), ("SisterOfBrideOrGroom", "Evening"), ("SisterOfBrideOrGroom", "ALine"),
            ("Evening", "BallGown"), ("Evening", "ALine"), ("BallGown", "Bridal"), ("ALine", "Bridal")
        };

        private const int SizeWeight = 4, StyleWeight = 3, ColorWeight = 3, KeywordWeight = 2;

        public static (GownMatchTier Tier, int Score) Evaluate(GownPosting gown, GownSearchFilters filters, List<string> keywords)
        {
            var levels = new List<(int Level, int Weight)>();
            if (filters.Sizes.Count > 0) levels.Add((SizeLevel(Split(gown.Size), filters.Sizes), SizeWeight));
            if (filters.Colors.Count > 0) levels.Add((RelatedLevel(Split(gown.Color), filters.Colors, RelatedColorPairs), ColorWeight));
            if (filters.Styles.Count > 0) levels.Add((RelatedLevel(Split(gown.StyleTags), filters.Styles, RelatedStylePairs), StyleWeight));
            if (keywords.Count > 0) levels.Add((KeywordLevel(gown, keywords), KeywordWeight));

            if (levels.Count == 0) return (GownMatchTier.Exact, 0);
            if (levels.Any(l => l.Level == Excluded)) return (GownMatchTier.None, 0);

            var score = levels.Sum(l => l.Level * l.Weight);
            var misses = levels.Count(l => l.Level == Miss);
            if (levels.All(l => l.Level == Exact)) return (GownMatchTier.Exact, score);
            if (misses == 0) return (GownMatchTier.Close, score);
            if (misses == 1 && levels.Count > 1) return (GownMatchTier.More, score);
            return (GownMatchTier.None, score);
        }

        // Lowercased, de-duplicated, split into words the same way KeywordLevel splits the
        // gown's text. A trailing plural "s" is dropped so "sleeves" still finds "sleeve"
        // (matching is word-prefix, so the singular also still finds the plural).
        public static List<string> ParseKeywords(string raw)
        {
            return (raw ?? "")
                .ToLowerInvariant()
                .Split(WordSeparators, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length >= 2)
                .Select(w => w.Length > 3 && w.EndsWith("s") && !w.EndsWith("ss") ? w[..^1] : w)
                .Distinct()
                .Take(10)
                .ToList();
        }

        private static int SizeLevel(List<string> gownSizes, List<string> wanted)
        {
            var best = int.MaxValue;
            foreach (var w in wanted)
            {
                foreach (var g in gownSizes)
                {
                    if (g == w) return Exact;
                    foreach (var ladder in SizeLadders)
                    {
                        var wi = Array.IndexOf(ladder, w);
                        var gi = Array.IndexOf(ladder, g);
                        if (wi >= 0 && gi >= 0) best = Math.Min(best, Math.Abs(wi - gi));
                    }
                }
            }
            return best switch
            {
                1 => Near,
                2 => Miss,
                _ => Excluded
            };
        }

        private static int RelatedLevel(List<string> gownValues, List<string> wanted, (string, string)[] relatedPairs)
        {
            if (gownValues.Any(wanted.Contains)) return Exact;
            var related = relatedPairs.Any(p =>
                (wanted.Contains(p.Item1) && gownValues.Contains(p.Item2)) ||
                (wanted.Contains(p.Item2) && gownValues.Contains(p.Item1)));
            return related ? Near : Miss;
        }

        private static int KeywordLevel(GownPosting gown, List<string> keywords)
        {
            // Word-prefix, not substring: "sleeve" finds "sleeves", but "lace" mustn't find
            // "necklace" or "red" find "embroidered".
            var words = string.Join(" ", gown.Description, gown.Brand, gown.Notes, gown.Condition, gown.Length)
                .ToLowerInvariant()
                .Split(WordSeparators, StringSplitOptions.RemoveEmptyEntries);
            var found = keywords.Count(k => words.Any(w => w.StartsWith(k)));
            return found == keywords.Count ? Exact : found > 0 ? Near : Miss;
        }

        private static readonly char[] WordSeparators =
            { ' ', ',', '.', ';', ':', '/', '!', '?', '"', '(', ')', '-', '\'', '\n', '\r', '\t', '&', '+' };

        private static List<string> Split(string commaSeparated) =>
            string.IsNullOrEmpty(commaSeparated)
                ? new List<string>()
                : commaSeparated.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }
}
