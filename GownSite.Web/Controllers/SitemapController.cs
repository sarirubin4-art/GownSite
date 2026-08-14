using System.Text;
using GownSite.Data;
using Microsoft.AspNetCore.Mvc;

namespace GownSite.Web.Controllers
{
    public class SitemapController : Controller
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;

        public SitemapController(IConfiguration configuration)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
        }

        [HttpGet("sitemap.xml")]
        public IActionResult Index()
        {
            var baseUrl = _configuration["Frontend:BaseUrl"] ?? $"{Request.Scheme}://{Request.Host}";
            baseUrl = baseUrl.TrimEnd('/');

            var gowns = new GownRepository(_connectionString).GetActive();
            var ads = new AdRepository(_connectionString).GetActive();

            var sb = new StringBuilder();
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
            sb.Append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

            void AddUrl(string path, string changefreq, string priority, DateTime? lastMod = null)
            {
                sb.Append("  <url>\n");
                sb.Append($"    <loc>{baseUrl}{path}</loc>\n");
                if (lastMod.HasValue)
                    sb.Append($"    <lastmod>{lastMod.Value:yyyy-MM-dd}</lastmod>\n");
                sb.Append($"    <changefreq>{changefreq}</changefreq>\n");
                sb.Append($"    <priority>{priority}</priority>\n");
                sb.Append("  </url>\n");
            }

            AddUrl("/", "daily", "1.0");
            AddUrl("/search", "daily", "0.9");
            AddUrl("/ads", "daily", "0.8");
            AddUrl("/terms", "yearly", "0.3");
            AddUrl("/privacy", "yearly", "0.3");

            foreach (var gown in gowns)
                AddUrl($"/gown/{gown.Id}", "weekly", "0.7", gown.CreatedDate == default ? null : gown.CreatedDate);

            foreach (var ad in ads)
                AddUrl($"/ad/{ad.Id}", "weekly", "0.6", ad.CreatedDate == default ? null : ad.CreatedDate);

            sb.Append("</urlset>");

            return Content(sb.ToString(), "application/xml", Encoding.UTF8);
        }
    }
}
