using GownSite.Data;
using GownSite.Web.Filters;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GownSite.Web.Controllers
{
    public class BusinessInquiryRequest
    {
        public string Message { get; set; }
        public string Topic { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ContactController : ControllerBase
    {
        private readonly string _connectionString;

        public ContactController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConStr");
        }

        [HttpPost("business-inquiry")]
        [RequireVerifiedEmail]
        public IActionResult BusinessInquiry([FromBody] BusinessInquiryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { message = "Please enter a message." });

            var topic = string.IsNullOrWhiteSpace(request.Topic) ? "Bulk discount inquiry" : request.Topic;
            new ContactMessageRepository(_connectionString).Create(CurrentOwnerId(), topic, request.Message);

            return Ok();
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
