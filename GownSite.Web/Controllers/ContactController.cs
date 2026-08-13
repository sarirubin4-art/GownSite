using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GownSite.Web.Controllers
{
    public class BusinessInquiryRequest
    {
        public string Message { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ContactController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;

        public ContactController(IConfiguration configuration, IEmailSender emailSender)
        {
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _emailSender = emailSender;
        }

        private string FrontendBaseUrl()
        {
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            return string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
        }

        [HttpPost("business-inquiry")]
        public async Task<IActionResult> BusinessInquiry([FromBody] BusinessInquiryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { message = "Please enter a message." });

            var adminEmail = _configuration["Email:AdminNotificationEmail"];
            if (string.IsNullOrEmpty(adminEmail))
                return StatusCode(503, new { message = "Contact isn't set up yet." });

            var ownerRepo = new OwnerRepository(_connectionString);
            var owner = ownerRepo.Get(CurrentOwnerId());
            if (owner == null) return NotFound();

            await _emailSender.SendAsync(
                adminEmail,
                "Bulk discount inquiry — Regowned",
                EmailTemplates.BusinessInquiry(owner.Name, owner.Email, owner.Number, request.Message, FrontendBaseUrl())
            );

            return Ok();
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
