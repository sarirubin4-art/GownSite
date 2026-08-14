using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace GownSite.Web.Controllers
{
    public class SignupRequest
    {
        public string Name { get; set; }
        public string Number { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class LoginRequest
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }

    public class ForgotPasswordRequest
    {
        public string Email { get; set; }
    }

    public class ResetPasswordRequest
    {
        public string Token { get; set; }
        public string NewPassword { get; set; }
    }

    public class OwnerViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Number { get; set; }
        public string Email { get; set; }
        public bool IsAdmin { get; set; }
        public bool EmailVerified { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class OwnerController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;
        private static readonly PasswordHasher<Owner> _hasher = new();

        public OwnerController(IConfiguration configuration, IEmailSender emailSender)
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

        private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

        [HttpPost("signup")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) ||
                string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Number))
                return BadRequest(new { message = "Name, email, phone number, and password are required." });

            if (!EmailRegex.IsMatch(request.Email.Trim()))
                return BadRequest(new { message = "Please enter a valid email address." });

            if (request.Number.Count(char.IsDigit) < 10)
                return BadRequest(new { message = "Please enter a valid phone number." });

            var repo = new OwnerRepository(_connectionString);
            if (repo.FindByEmail(request.Email) != null)
                return BadRequest(new { message = "An account with that email already exists." });

            var owner = new Owner
            {
                Name = request.Name,
                Number = request.Number,
                Email = request.Email,
                EmailVerified = false,
                EmailVerificationToken = GenerateVerificationToken()
            };
            owner.PasswordHash = _hasher.HashPassword(owner, request.Password);
            try
            {
                repo.Create(owner);
            }
            catch (DbUpdateException)
            {
                // Two signups for the same email racing past the check above — the unique
                // index on Owner.Email is the real guard; this just keeps the response friendly.
                return BadRequest(new { message = "An account with that email already exists." });
            }

            await SendVerificationEmail(owner);

            await SignInOwner(owner);
            return Ok(ToViewModel(owner));
        }

        [HttpGet("verify-email")]
        public IActionResult VerifyEmail([FromQuery] string token)
        {
            var repo = new OwnerRepository(_connectionString);
            var verified = !string.IsNullOrEmpty(token) && repo.MarkVerified(token);
            return Redirect($"{FrontendBaseUrl()}/?verified={(verified ? "1" : "0")}");
        }

        [HttpPost("resend-verification")]
        [Authorize]
        public async Task<IActionResult> ResendVerification()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var repo = new OwnerRepository(_connectionString);
            var owner = repo.Get(int.Parse(idClaim));
            if (owner == null) return Unauthorized();
            if (owner.EmailVerified) return Ok();

            var token = GenerateVerificationToken();
            repo.SetVerificationToken(owner.Id, token);
            owner.EmailVerificationToken = token;

            await SendVerificationEmail(owner);
            return Ok();
        }

        private static string GenerateVerificationToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        private Task SendVerificationEmail(Owner owner)
        {
            var verifyUrl = $"{Request.Scheme}://{Request.Host}/api/owner/verify-email?token={owner.EmailVerificationToken}";
            return _emailSender.SendAsync(
                owner.Email,
                "Please verify your email — Regowned",
                EmailTemplates.VerifyEmail(owner.Name, verifyUrl, FrontendBaseUrl())
            );
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            var repo = new OwnerRepository(_connectionString);
            var owner = repo.FindByEmail(request.Email ?? "");
            // Always return Ok, whether or not the email is registered, so this endpoint
            // can't be used to check which emails have an account.
            if (owner == null) return Ok();

            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var expiresAt = DateTime.UtcNow.AddHours(1);
            repo.SetPasswordResetToken(owner.Id, token, expiresAt);

            var resetUrl = $"{FrontendBaseUrl()}/reset-password?token={token}";
            await _emailSender.SendAsync(
                owner.Email,
                "Reset your password — Regowned",
                EmailTemplates.ResetPassword(owner.Name, resetUrl, FrontendBaseUrl())
            );

            return Ok();
        }

        [HttpPost("reset-password")]
        public IActionResult ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
                return BadRequest(new { message = "A new password is required." });
            if (request.NewPassword.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });

            var repo = new OwnerRepository(_connectionString);
            var owner = repo.FindByValidPasswordResetToken(request.Token);
            if (owner == null)
                return BadRequest(new { message = "This reset link is invalid or has expired. Please request a new one." });

            var newHash = _hasher.HashPassword(owner, request.NewPassword);
            repo.ResetPassword(request.Token, newHash);
            return Ok();
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var repo = new OwnerRepository(_connectionString);
            var owner = repo.FindByEmail(request.Email ?? "");
            if (owner == null)
                return Unauthorized(new { message = "Invalid email or password." });

            var result = _hasher.VerifyHashedPassword(owner, owner.PasswordHash, request.Password ?? "");
            if (result == PasswordVerificationResult.Failed)
                return Unauthorized(new { message = "Invalid email or password." });

            await SignInOwner(owner);
            return Ok(ToViewModel(owner));
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok();
        }

        [HttpGet("me")]
        [Authorize]
        public IActionResult Me()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var repo = new OwnerRepository(_connectionString);
            var owner = repo.Get(int.Parse(idClaim));
            if (owner == null) return Unauthorized();
            return Ok(ToViewModel(owner));
        }

        private async Task SignInOwner(Owner owner)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, owner.Id.ToString()),
                new(ClaimTypes.Name, owner.Name),
                new(ClaimTypes.Email, owner.Email)
            };
            if (owner.IsAdmin)
            {
                claims.Add(new Claim(ClaimTypes.Role, "Admin"));
            }
            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
        }

        private static OwnerViewModel ToViewModel(Owner owner) => new()
        {
            Id = owner.Id,
            Name = owner.Name,
            Number = owner.Number,
            Email = owner.Email,
            IsAdmin = owner.IsAdmin,
            EmailVerified = owner.EmailVerified
        };
    }
}
