using SkiaSharp;

namespace GownSite.Web.Services
{
    // Classifies a gown photo's pixels against the site's fixed color palette
    // (ClientApp's COLOR_OPTIONS) and reports what % of the photo matches each of the
    // gown's own tagged colors. No ML/clustering needed — the palette is small and
    // known ahead of time, so every pixel is just assigned to its nearest reference
    // color. "Floral", "Multi" and "Other" aren't real colors and have no reference
    // entry, so they're silently absent from the result (callers/consumers treat a
    // missing score as "unknown", which is the correct behavior for those tags).
    public static class GownColorAnalyzer
    {
        private static readonly Dictionary<string, (byte R, byte G, byte B)> Palette = new()
        {
            ["Ivory/White"] = (250, 249, 246),
            ["Blush"] = (222, 180, 178),
            ["Champagne"] = (247, 231, 190),
            ["Beige"] = (222, 208, 178),
            ["Black"] = (30, 28, 30),
            ["Navy"] = (25, 35, 75),
            ["Burgundy"] = (100, 20, 35),
            ["Emerald"] = (0, 110, 75),
            ["Sage"] = (145, 160, 135),
            ["Blue"] = (40, 90, 190),
            ["Silver"] = (200, 200, 205),
            ["Gold"] = (196, 160, 80),
            ["Pink"] = (240, 145, 175),
            ["Purple"] = (110, 50, 150),
        };

        // Caps how many pixels get classified — enough to be stable, cheap enough to run
        // synchronously at upload/approval time without noticeably slowing the request.
        private const int MaxSamples = 10_000;

        public static Dictionary<string, double> ComputeScores(byte[] imageBytes, IEnumerable<string> colorTags)
        {
            var result = new Dictionary<string, double>();
            using var bitmap = SKBitmap.Decode(imageBytes);
            if (bitmap == null || bitmap.Width == 0 || bitmap.Height == 0) return result;

            var totalPixels = bitmap.Width * bitmap.Height;
            var stride = Math.Max(1, (int)Math.Sqrt((double)totalPixels / MaxSamples));

            var counts = new Dictionary<string, int>();
            var sampled = 0;
            for (var y = 0; y < bitmap.Height; y += stride)
            {
                for (var x = 0; x < bitmap.Width; x += stride)
                {
                    var pixel = bitmap.GetPixel(x, y);
                    var nearest = NearestPaletteColor(pixel.Red, pixel.Green, pixel.Blue);
                    counts[nearest] = counts.GetValueOrDefault(nearest) + 1;
                    sampled++;
                }
            }
            if (sampled == 0) return result;

            foreach (var tag in colorTags)
            {
                if (counts.TryGetValue(tag, out var count))
                    result[tag] = Math.Round(100.0 * count / sampled, 1);
            }
            return result;
        }

        private static string NearestPaletteColor(byte r, byte g, byte b)
        {
            var bestName = "";
            var bestDistance = double.MaxValue;
            foreach (var (name, target) in Palette)
            {
                var distance = RedmeanDistance(r, g, b, target.R, target.G, target.B);
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    bestName = name;
                }
            }
            return bestName;
        }

        // "Redmean" — a cheap, well-known approximation of perceptual color distance
        // that weights R/G/B differently depending on how red the pair of colors is,
        // without needing a full RGB->Lab conversion.
        private static double RedmeanDistance(byte r1, byte g1, byte b1, byte r2, byte g2, byte b2)
        {
            var rMean = (r1 + r2) / 2.0;
            double dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
            return Math.Sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
        }
    }
}
