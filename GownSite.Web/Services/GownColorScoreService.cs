using System.Text.Json;
using GownSite.Data;

namespace GownSite.Web.Services
{
    public class GownColorScoreService : IGownColorScoreService
    {
        // Reading the photo back is a best-effort side computation riding on requests
        // that matter a lot more (payment confirmation, approval) — cap it well below
        // those flows' own timeouts so a slow storage backend can't stall them.
        private static readonly TimeSpan ReadTimeout = TimeSpan.FromSeconds(10);

        private readonly string _connectionString;
        private readonly IFileStorageService _storage;
        private readonly ILogger<GownColorScoreService> _logger;

        public GownColorScoreService(IConfiguration configuration, IFileStorageService storage, ILogger<GownColorScoreService> logger)
        {
            _connectionString = configuration.GetConnectionString("ConStr");
            _storage = storage;
            _logger = logger;
        }

        public async Task RecomputeAsync(int gownPostingId, byte[] primaryImageBytes = null)
        {
            // Best-effort ranking signal only — must never fail the approval/payment/edit
            // flow that triggered it (a corrupt image, a network blip fetching the photo
            // back from blob storage, etc. should just leave the score stale/missing).
            try
            {
                var repo = new GownRepository(_connectionString);
                var posting = repo.Get(gownPostingId);
                if (posting == null || string.IsNullOrEmpty(posting.PrimaryPictureUrl) || string.IsNullOrEmpty(posting.Color))
                    return;

                var colorTags = posting.Color.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (colorTags.Length == 0) return;

                var imageBytes = primaryImageBytes;
                if (imageBytes == null)
                {
                    using var cts = new CancellationTokenSource(ReadTimeout);
                    imageBytes = await _storage.ReadAsync(posting.PrimaryPictureUrl, cts.Token);
                }
                if (imageBytes == null) return;

                var scores = GownColorAnalyzer.ComputeScores(imageBytes, colorTags);
                repo.SetColorScores(gownPostingId, JsonSerializer.Serialize(scores));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to compute color scores for gown {GownId}", gownPostingId);
            }
        }
    }
}
