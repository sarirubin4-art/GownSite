using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Mvc;

namespace GownSite.Web.Controllers
{
    public class TrackViewRequest
    {
        public string Path { get; set; }
        public string Referrer { get; set; }
        public string UtmSource { get; set; }
        public bool IsEntry { get; set; }
    }

    public class TrackEventRequest
    {
        public string Type { get; set; }
        public int? EntityId { get; set; }
    }

    // Anonymous, fire-and-forget endpoints the SPA calls as visitors move around. Always
    // answers 204 for a well-formed request, even when the recorder decides to skip it
    // (bot, admin, owner viewing their own listing), so the browser has nothing to retry.
    // The admin-side reporting endpoints live in AdminController (analytics/*).
    [Route("api/analytics")]
    [ApiController]
    public class AnalyticsController : ControllerBase
    {
        private readonly AnalyticsRecorder _recorder;

        public AnalyticsController(AnalyticsRecorder recorder)
        {
            _recorder = recorder;
        }

        [HttpPost("view")]
        public IActionResult TrackView([FromBody] TrackViewRequest request)
        {
            if (request == null) return BadRequest();
            _recorder.RecordPageView(HttpContext, request.Path, request.Referrer, request.UtmSource, request.IsEntry);
            return NoContent();
        }

        // A gown search that stayed empty on screen for a few seconds (see ClientApp's
        // SearchGowns). Takes the structured filters rather than a description, so the server
        // both writes the label itself and re-checks the search really is empty.
        [HttpPost("no-results")]
        public IActionResult TrackNoResultsSearch([FromBody] GownSearchFilters filters)
        {
            if (filters == null) return BadRequest();
            _recorder.RecordNoResultsSearch(HttpContext, filters);
            return NoContent();
        }

        [HttpPost("event")]
        public IActionResult TrackEvent([FromBody] TrackEventRequest request)
        {
            if (request == null || !SiteEventTypes.ClientReportable.Contains(request.Type)) return BadRequest();
            _recorder.RecordClientEvent(HttpContext, request.Type, request.EntityId);
            return NoContent();
        }
    }
}
