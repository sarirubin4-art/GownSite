using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace GownSite.Data
{
    // Brand is free text typed by the seller, so before it's shown as a "Shop by designer"
    // button it needs three things this class provides: recognizing entries that aren't a
    // designer at all ("Custom", "N/A", "my seamstress"), recognizing well-known designers
    // under their usual spellings ("oscar dela renta", "Jovani Fashions"), and a prestige
    // tier so the home page leads with the names shoppers get excited about.
    //
    // The list is hand-maintained — add a name here when a new well-known designer starts
    // showing up in listings. Anything not listed still appears, just after the known ones.
    public static class DesignerDirectory
    {
        public const int Luxury = 3, Designer = 2, Popular = 1, Unranked = 0;

        // Display name, tier, then any other spellings sellers commonly type.
        private static readonly (string Name, int Tier, string[] Aliases)[] Known =
        {
            // Luxury houses
            ("Gucci", Luxury, new string[0]),
            ("Chanel", Luxury, new string[0]),
            ("Dior", Luxury, new[] { "christian dior" }),
            ("Valentino", Luxury, new string[0]),
            ("Prada", Luxury, new string[0]),
            ("Givenchy", Luxury, new string[0]),
            ("Dolce & Gabbana", Luxury, new[] { "dolce and gabbana", "dolce gabbana", "d&g" }),
            ("Armani", Luxury, new[] { "giorgio armani", "armani prive", "emporio armani" }),
            ("Versace", Luxury, new string[0]),
            ("Alexander McQueen", Luxury, new[] { "mcqueen", "alexander mcqueen" }),
            ("Elie Saab", Luxury, new string[0]),
            ("Oscar de la Renta", Luxury, new[] { "oscar dela renta", "oscar delarenta", "odlr" }),
            ("Carolina Herrera", Luxury, new[] { "ch carolina herrera" }),
            ("Zuhair Murad", Luxury, new string[0]),
            ("Marchesa", Luxury, new[] { "marchesa notte" }),
            ("Vera Wang", Luxury, new[] { "white by vera wang" }),
            ("Monique Lhuillier", Luxury, new[] { "monique lhuiller" }),
            ("Reem Acra", Luxury, new string[0]),
            ("Naeem Khan", Luxury, new string[0]),
            ("Badgley Mischka", Luxury, new string[0]),
            ("Jenny Packham", Luxury, new string[0]),
            ("Self-Portrait", Luxury, new[] { "self portrait" }),
            ("Ralph Lauren", Luxury, new[] { "polo ralph lauren", "lauren ralph lauren" }),
            ("Zimmermann", Luxury, new string[0]),
            ("Alberta Ferretti", Luxury, new string[0]),
            ("Blumarine", Luxury, new string[0]),
            ("Ermanno Scervino", Luxury, new string[0]),
            ("Khaite", Luxury, new string[0]),

            // Established evening & bridal designers
            ("Pronovias", Designer, new string[0]),
            ("Christian Siriano", Designer, new[] { "siriano" }),
            ("Tadashi Shoji", Designer, new[] { "tadashi" }),
            ("Mac Duggal", Designer, new[] { "macduggal" }),
            ("Kay Unger", Designer, new string[0]),
            ("Theia", Designer, new string[0]),
            ("Amsale", Designer, new string[0]),
            ("Watters", Designer, new string[0]),
            ("Maggie Sottero", Designer, new string[0]),
            ("Rivini", Designer, new string[0]),
            ("Hayley Paige", Designer, new string[0]),
            ("Galia Lahav", Designer, new string[0]),
            ("Berta", Designer, new string[0]),
            ("Inbal Dror", Designer, new string[0]),
            ("Rasario", Designer, new string[0]),
            ("Aidan Mattox", Designer, new string[0]),
            ("Jovani", Designer, new[] { "jovani fashions" }),
            ("Sherri Hill", Designer, new[] { "sherrihill" }),
            ("Terani Couture", Designer, new[] { "terani" }),
            ("Nicole Miller", Designer, new string[0]),
            ("Halston", Designer, new[] { "halston heritage" }),
            ("Calvin Klein", Designer, new string[0]),
            ("Tahari", Designer, new[] { "tahari asl" }),
            ("BCBG", Designer, new[] { "bcbgmaxazria", "bcbg max azria" }),
            ("Kate Spade", Designer, new string[0]),
            ("Eliza J", Designer, new string[0]),
            ("Philosophy di Lorenzo Serafini", Designer, new[] { "philosophy di lorenzo", "philosophy" }),
            ("Costarellos", Designer, new string[0]),
            ("Pamella Roland", Designer, new string[0]),
            ("Rachel Gilbert", Designer, new string[0]),
            ("The Vampire's Wife", Designer, new[] { "vampires wife", "the vampires wife" }),

            // Popular occasion-wear brands
            ("Adrianna Papell", Popular, new string[0]),
            ("La Femme", Popular, new string[0]),
            ("Alyce Paris", Popular, new[] { "alyce" }),
            ("Mori Lee", Popular, new[] { "morilee", "mori lee by madeline gardner" }),
            ("Montage by Mon Cheri", Popular, new[] { "montage", "mon cheri" }),
            ("Rachel Allan", Popular, new string[0]),
            ("Allure", Popular, new[] { "allure bridals", "allure bridal" }),
            ("Stella York", Popular, new string[0]),
            ("Essense of Australia", Popular, new[] { "essence of australia" }),
            ("Ellie Wilde", Popular, new string[0]),
            ("Johnathan Kayne", Popular, new[] { "jonathan kayne" }),
            ("Ashley Lauren", Popular, new string[0]),
            ("Portia and Scarlett", Popular, new[] { "portia & scarlett" }),
            ("Primavera Couture", Popular, new[] { "primavera" }),
            ("Dave & Johnny", Popular, new[] { "dave and johnny" }),
            ("Alex Evenings", Popular, new string[0]),
            ("Cachet", Popular, new string[0]),
            ("Xscape", Popular, new string[0]),
            ("Betsy & Adam", Popular, new[] { "betsy and adam" }),
            ("Vince Camuto", Popular, new string[0]),
            ("JS Collections", Popular, new string[0]),
            ("Dress the Population", Popular, new string[0]),
            ("Jenny Yoo", Popular, new string[0]),
            ("Lulus", Popular, new string[0]),
            ("BHLDN", Popular, new string[0]),
            ("David's Bridal", Popular, new[] { "davids bridal" }),
            ("Morgan & Co", Popular, new[] { "morgan and co" }),
            ("Blondie Nites", Popular, new string[0]),
            ("Jasmine", Popular, new[] { "jasmine bridal" }),
            ("JNBY", Popular, new string[0]),
        };

        // Normalized seller entries that mean "no designer". Matched on the whole entry, plus
        // NotADesignerWords anywhere in it ("custom made by my aunt", "unknown brand").
        private static readonly HashSet<string> NotADesigner = new()
        {
            "custom", "custom made", "custommade", "customized", "made to order", "made to measure", "bespoke",
            "handmade", "hand made", "homemade", "home made", "tailor", "tailor made", "tailored",
            "seamstress", "dressmaker", "dress maker", "designer", "designer gown", "designer dress",
            "unknown", "not sure", "unsure", "dont know", "don't know", "idk", "na", "n a", "none", "no",
            "no brand", "no label", "no tag", "unbranded", "unlabeled", "generic", "other", "various",
            "boutique", "local boutique", "store", "vintage", "my own", "self", "me", "private", "own design",
            "imported", "europe", "european", "israel", "israeli", "china", "online", "amazon", "shein"
        };

        private static readonly string[] NotADesignerWords =
        {
            "custom", "handmade", "hand made", "homemade", "seamstress", "dressmaker", "tailor",
            "unknown", "not sure", "no brand", "no label", "unbranded", "made to order", "made by"
        };

        private static readonly Dictionary<string, (string Name, int Tier)> KnownByKey = BuildKnownIndex();

        private static Dictionary<string, (string Name, int Tier)> BuildKnownIndex()
        {
            var index = new Dictionary<string, (string, int)>();
            foreach (var (name, tier, aliases) in Known)
            {
                foreach (var spelling in aliases.Prepend(name))
                {
                    var key = Normalize(spelling);
                    // First listing wins — keeps a name listed twice (by mistake) at its higher tier.
                    if (key.Length > 0 && !index.ContainsKey(key)) index[key] = (name, tier);
                }
            }
            return index;
        }

        // Lowercase, "&" spelled out, punctuation dropped, whitespace collapsed:
        // "Dolce&Gabbana", "dolce & gabbana" and "Dolce and Gabbana." all become the same key.
        public static string Normalize(string raw)
        {
            var s = (raw ?? "").ToLowerInvariant().Replace("&", " and ").Replace("’", "'");
            s = Regex.Replace(s, @"[^a-z0-9' ]", " ").Replace("'", "");
            return Regex.Replace(s, @"\s+", " ").Trim();
        }

        public static bool IsDesigner(string raw)
        {
            var key = Normalize(raw);
            if (key.Length < 2 || !key.Any(char.IsLetter)) return false;
            if (KnownByKey.ContainsKey(key)) return true;
            if (NotADesigner.Contains(key)) return false;
            return !NotADesignerWords.Any(w => key.Contains(w));
        }

        // A known designer's canonical name and tier, matched on the whole entry or on its
        // leading words ("Sherri Hill 2023 collection" -> Sherri Hill), allowing for a typo or
        // two ("Monique Ihullier", "Zimmerman" — see IsCloseSpelling). Null when unknown.
        public static (string Name, int Tier)? Lookup(string raw)
        {
            var words = Normalize(raw).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            for (var n = words.Length; n >= 1; n--)
            {
                if (KnownByKey.TryGetValue(string.Join(" ", words.Take(n)), out var match)) return match;
            }
            for (var n = words.Length; n >= 1; n--)
            {
                var prefix = string.Join(" ", words.Take(n));
                foreach (var (key, match) in KnownByKey)
                {
                    if (IsCloseSpelling(prefix, key)) return match;
                }
            }
            return null;
        }

        // Same name allowing for small typos: one letter off for names of 6+ characters, two
        // for 12+. Short names must match exactly — "Prada" vs "Prado" aren't the same label.
        public static bool IsCloseSpelling(string a, string b)
        {
            a = Normalize(a);
            b = Normalize(b);
            if (a == b) return true;
            var len = Math.Min(a.Length, b.Length);
            var allowed = len >= 12 ? 2 : len >= 6 ? 1 : 0;
            return allowed > 0 && Math.Abs(a.Length - b.Length) <= allowed && EditDistance(a, b) <= allowed;
        }

        // Levenshtein distance — the fewest single-letter insertions, deletions or swaps
        // that turn one string into the other.
        private static int EditDistance(string a, string b)
        {
            var prev = new int[b.Length + 1];
            var curr = new int[b.Length + 1];
            for (var j = 0; j <= b.Length; j++) prev[j] = j;
            for (var i = 1; i <= a.Length; i++)
            {
                curr[0] = i;
                for (var j = 1; j <= b.Length; j++)
                {
                    var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                    curr[j] = Math.Min(Math.Min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
                }
                (prev, curr) = (curr, prev);
            }
            return prev[b.Length];
        }
    }
}
