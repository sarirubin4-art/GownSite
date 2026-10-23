namespace GownSite.Web.Services
{
    public static class FrontendUrls
    {
        // Base URL for links in emails and Stripe redirects: Frontend:BaseUrl when
        // configured, otherwise whatever host this request came in on.
        public static string BaseUrl(IConfiguration configuration, HttpRequest request)
        {
            var frontendBaseUrl = configuration["Frontend:BaseUrl"];
            return string.IsNullOrEmpty(frontendBaseUrl) ? $"{request.Scheme}://{request.Host}" : frontendBaseUrl;
        }
    }
}
