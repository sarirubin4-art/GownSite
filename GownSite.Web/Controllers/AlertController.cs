using GownSite.Data;
using Microsoft.AspNetCore.Mvc;

namespace GownSite.Web.Controllers
{
    public class CreateAlertRequest
    {
        public string Email { get; set; }
        public List<string> Colors { get; set; } = new();
        public List<string> Sizes { get; set; } = new();
        public List<string> Locations { get; set; } = new();
        public List<string> Styles { get; set; } = new();
        public List<string> ListingTypes { get; set; } = new();
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AlertController : ControllerBase
    {
        private readonly string _connectionString;

        public AlertController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConStr");
        }

        [HttpPost("create")]
        public IActionResult Create([FromBody] CreateAlertRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
                return BadRequest(new { message = "An email address is required." });

            var hasCriteria = request.Colors.Count > 0 || request.Sizes.Count > 0 || request.Locations.Count > 0
                || request.Styles.Count > 0 || request.ListingTypes.Count > 0;
            if (!hasCriteria)
                return BadRequest(new { message = "Choose at least one thing to be notified about." });

            var repo = new SearchAlertRepository(_connectionString);
            repo.Create(new SearchAlert
            {
                Email = request.Email,
                Colors = string.Join(',', request.Colors),
                Sizes = string.Join(',', request.Sizes),
                Locations = string.Join('|', request.Locations),
                Styles = string.Join(',', request.Styles),
                ListingTypes = string.Join(',', request.ListingTypes)
            });

            return Ok();
        }

        [HttpGet("unsubscribe")]
        public IActionResult Unsubscribe(string token)
        {
            var repo = new SearchAlertRepository(_connectionString);
            var found = repo.DeactivateByToken(token ?? "");

            var message = found
                ? "You've been unsubscribed and won't receive any more alerts."
                : "That unsubscribe link isn't valid — it may have already been used.";
            return Content($"<html><body style=\"font-family:sans-serif;padding:40px;text-align:center;\"><p>{message}</p></body></html>", "text/html");
        }
    }
}
