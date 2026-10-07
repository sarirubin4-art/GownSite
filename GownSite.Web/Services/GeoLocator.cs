using System.Formats.Tar;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using MaxMind.GeoIP2;

namespace GownSite.Web.Services
{
    public record GeoResult(string CountryCode, string Country, string RegionCode, string Region, string City);

    // IP -> city/state/country via MaxMind's free GeoLite2 City database, looked up
    // in-process so visitor IPs never leave our own server. The database file itself is
    // downloaded (and kept fresh) by GeoDatabaseUpdater; until the first download finishes,
    // or if no MaxMind key is configured, every lookup just returns null ("Unknown").
    public class GeoLocator
    {
        private DatabaseReader _reader;
        private readonly ILogger<GeoLocator> _logger;

        public GeoLocator(IWebHostEnvironment env, ILogger<GeoLocator> logger)
        {
            _logger = logger;
            // App Service only guarantees $HOME survives restarts and redeploys (the deployed
            // site folder is replaced on every push), so the database lives there in
            // production; locally it goes in a gitignored App_Data folder next to the app.
            var root = Environment.GetEnvironmentVariable("WEBSITE_SITE_NAME") != null
                ? Path.Combine(Environment.GetEnvironmentVariable("HOME") ?? env.ContentRootPath, "data")
                : Path.Combine(env.ContentRootPath, "App_Data");
            DatabasePath = Path.Combine(root, "geoip", "GeoLite2-City.mmdb");
            TryLoad();
        }

        public string DatabasePath { get; }
        public bool IsLoaded => _reader != null;

        public GeoResult Lookup(IPAddress ip)
        {
            var reader = _reader;
            if (reader == null || ip == null) return null;
            try
            {
                if (!reader.TryCity(ip, out var city) || city == null) return null;
                var subdivision = city.MostSpecificSubdivision;
                return new GeoResult(
                    city.Country?.IsoCode,
                    city.Country?.Name,
                    subdivision?.IsoCode,
                    subdivision?.Name,
                    city.City?.Name);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "GeoIP lookup failed for {Ip}", ip);
                return null;
            }
        }

        // Loads the whole file into memory (FileAccessMode.Memory), so the updater can
        // overwrite the file on disk afterward without fighting a lock on it.
        public bool TryLoad()
        {
            if (!File.Exists(DatabasePath)) return false;
            try
            {
                var old = _reader;
                _reader = new DatabaseReader(DatabasePath, MaxMind.Db.FileAccessMode.Memory);
                old?.Dispose();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not load GeoIP database at {Path}", DatabasePath);
                return false;
            }
        }
    }

    // Downloads GeoLite2 City on startup if missing and re-downloads it weekly (MaxMind
    // publishes updates twice a week, and their license requires keeping it current).
    // Also prunes analytics rows past the retention window once a day while it's awake.
    public class GeoDatabaseUpdater : BackgroundService
    {
        private static readonly TimeSpan RefreshAge = TimeSpan.FromDays(7);
        private const int RetentionMonths = 13;

        private readonly GeoLocator _locator;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<GeoDatabaseUpdater> _logger;

        public GeoDatabaseUpdater(GeoLocator locator, IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<GeoDatabaseUpdater> logger)
        {
            _locator = locator;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Let the app finish starting up before doing anything network-heavy.
            try { await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); } catch (OperationCanceledException) { return; }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RefreshIfStaleAsync(stoppingToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "GeoIP database refresh failed");
                }

                try
                {
                    var deleted = new Data.AnalyticsRepository(_configuration.GetConnectionString("ConStr"))
                        .DeleteOlderThan(DateTime.UtcNow.AddMonths(-RetentionMonths));
                    if (deleted > 0) _logger.LogInformation("Pruned {Count} analytics rows past retention", deleted);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Analytics retention cleanup failed");
                }

                try { await Task.Delay(TimeSpan.FromHours(24), stoppingToken); } catch (OperationCanceledException) { return; }
            }
        }

        private async Task RefreshIfStaleAsync(CancellationToken ct)
        {
            var accountId = _configuration["MaxMind:AccountId"];
            var licenseKey = _configuration["MaxMind:LicenseKey"];
            if (string.IsNullOrEmpty(accountId) || string.IsNullOrEmpty(licenseKey))
            {
                _logger.LogInformation("MaxMind:AccountId/LicenseKey not configured — visitor locations will show as Unknown");
                return;
            }

            var path = _locator.DatabasePath;
            if (File.Exists(path) && DateTime.UtcNow - File.GetLastWriteTimeUtc(path) < RefreshAge)
            {
                if (!_locator.IsLoaded) _locator.TryLoad();
                return;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(5);
            using var request = new HttpRequestMessage(HttpMethod.Get,
                "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz");
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountId}:{licenseKey}")));

            // MaxMind redirects to a pre-signed storage URL; HttpClient follows it and
            // (correctly) drops the Authorization header on the cross-host hop.
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();

            // Save the archive first, then sniff it: depending on how the storage host labels
            // the response, the body can arrive still gzipped or already decompressed by the
            // transport, so check for the gzip magic bytes rather than assuming either.
            var archivePath = path + ".archive";
            await using (var http = await response.Content.ReadAsStreamAsync(ct))
            await using (var file = File.Create(archivePath))
            {
                await http.CopyToAsync(file, ct);
            }

            // A web page instead of an archive means something between us and MaxMind's
            // storage host answered instead — in practice a network content filter on a dev
            // machine. Say so plainly rather than failing deep inside the tar parser.
            if (response.Content.Headers.ContentType?.MediaType == "text/html")
            {
                File.Delete(archivePath);
                throw new InvalidOperationException(
                    "GeoLite2 download returned a web page instead of the database — likely blocked by a network/content filter. " +
                    "Locations will show as Unknown until the download succeeds (it retries daily).");
            }

            var tempPath = path + ".download";
            await using (var archive = File.OpenRead(archivePath))
            {
                var magic = new byte[2];
                var isGzip = await archive.ReadAsync(magic, ct) == 2 && magic[0] == 0x1F && magic[1] == 0x8B;
                archive.Position = 0;
                _logger.LogInformation("GeoLite2 download: {Bytes} bytes, content-type {Type}, gzip={IsGzip}",
                    archive.Length, response.Content.Headers.ContentType?.MediaType, isGzip);
                await using Stream tarStream = isGzip ? new GZipStream(archive, CompressionMode.Decompress) : archive;
                var tar = new TarReader(tarStream);
                TarEntry entry;
                var found = false;
                while ((entry = await tar.GetNextEntryAsync(cancellationToken: ct)) != null)
                {
                    if (entry.EntryType == TarEntryType.RegularFile && entry.Name.EndsWith(".mmdb", StringComparison.OrdinalIgnoreCase))
                    {
                        await entry.ExtractToFileAsync(tempPath, overwrite: true, ct);
                        found = true;
                        break;
                    }
                }
                if (!found) throw new InvalidOperationException("GeoLite2 download contained no .mmdb file");
            }

            File.Delete(archivePath);
            File.Move(tempPath, path, overwrite: true);
            File.SetLastWriteTimeUtc(path, DateTime.UtcNow);
            if (_locator.TryLoad()) _logger.LogInformation("GeoIP database updated at {Path}", path);
        }
    }
}
