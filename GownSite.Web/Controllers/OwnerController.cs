using GownSite.Data;
using GownSite.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
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

    public class UpdateProfileRequest
    {
        public string Name { get; set; }
        public string Number { get; set; }
    }

    public class ChangeEmailRequest
    {
        public string NewEmail { get; set; }
        public string CurrentPassword { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string CurrentPassword { get; set; }
        public string NewPassword { get; set; }
    }

    // What an email-change confirmation link carries. It's encrypted and signed (ASP.NET
    // Data Protection) rather than stored in the database, so this needs no new columns.
    // FromEmail pins it to the address the request was made from: once the email changes
    // again, an older link stops working instead of being able to undo the newer change.
    public class EmailChangeTicket
    {
        public int OwnerId { get; set; }
        public string FromEmail { get; set; }
        public string ToEmail { get; set; }
    }

    public class OwnerViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Number { get; set; }
        public string Email { get; set; }
        public bool IsAdmin { get; set; }
        public bool EmailVerified { get; set; }
        public bool IsBusinessAccount { get; set; }
        public decimal? BusinessMonthlyFeeUsd { get; set; }
        public int? BusinessGownAllowance { get; set; }
        public bool BusinessBillingComplete { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class OwnerController : ControllerBase
    {
        private readonly string _connectionString;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;
        private static readonly PasswordHasher<Owner> _hasher = new();
        private readonly AnalyticsRecorder _analytics;
        private readonly ITimeLimitedDataProtector _emailChangeProtector;
        private readonly StripeCustomerSync _stripeCustomerSync;
        private static readonly TimeSpan EmailChangeLinkLifetime = TimeSpan.FromHours(24);

        public OwnerController(IConfiguration configuration, IEmailSender emailSender, AnalyticsRecorder analytics, IDataProtectionProvider dataProtection, StripeCustomerSync stripeCustomerSync)
        {
            _stripeCustomerSync = stripeCustomerSync;
            _configuration = configuration;
            _connectionString = configuration.GetConnectionString("ConStr");
            _emailSender = emailSender;
            _analytics = analytics;
            _emailChangeProtector = dataProtection.CreateProtector("Regowned.EmailChange.v1").ToTimeLimitedDataProtector();
        }

        private string FrontendBaseUrl()
        {
            var frontendBaseUrl = _configuration["Frontend:BaseUrl"];
            return string.IsNullOrEmpty(frontendBaseUrl) ? $"{Request.Scheme}://{Request.Host}" : frontendBaseUrl;
        }

        private static readonly Regex EmailRegex = new(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled);

        public static bool IsValidEmail(string email) => !string.IsNullOrWhiteSpace(email) && EmailRegex.IsMatch(email.Trim());

        // Name/phone rules shared by signup, the patron's own My Account page, and
        // AdminController.EditOwner so they can't drift apart. Returns null when valid.
        public static string ValidateNameAndNumber(string name, string number)
        {
            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(number))
                return "Name and phone number are required.";
            if (number.Count(char.IsDigit) < 10)
                return "Please enter a valid phone number.";
            return null;
        }

        [HttpPost("signup")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) ||
                string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Number))
                return BadRequest(new { message = "Name, email, phone number, and password are required." });

            if (!IsValidEmail(request.Email))
                return BadRequest(new { message = "Please enter a valid email address." });

            var validationError = ValidateNameAndNumber(request.Name, request.Number);
            if (validationError != null) return BadRequest(new { message = validationError });

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

            _analytics.RecordEvent(HttpContext, SiteEventTypes.Signup, owner.Id);
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
            // The token can expire or be used by a second submission between the lookup above
            // and this save — report that rather than claiming a reset that didn't happen.
            if (!repo.ResetPassword(request.Token, newHash))
                return BadRequest(new { message = "This reset link is invalid or has expired. Please request a new one." });
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

        [HttpPost("update-profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
        {
            var validationError = ValidateNameAndNumber(request.Name, request.Number);
            if (validationError != null) return BadRequest(new { message = validationError });

            var repo = new OwnerRepository(_connectionString);
            var before = repo.Get(CurrentOwnerId());
            if (before == null) return Unauthorized();
            var name = request.Name.Trim();
            repo.UpdateNameAndNumber(before.Id, name, request.Number.Trim());
            // Stripe only stores name and email, so a phone-only edit doesn't need a sync.
            if (name != before.Name) await _stripeCustomerSync.SyncOwnerContactAsync(before.Id);
            return Ok(ToViewModel(repo.Get(before.Id)));
        }

        // Doesn't change anything yet — emails a confirmation link to the NEW address, and the
        // change only happens when it's clicked (ConfirmEmailChange). That way a typo can't lock
        // a patron out, and nobody can point an account at an address they don't control.
        // Requires the current password so a borrowed/stolen logged-in session alone can't
        // take over the account by redirecting its email (and with it, password resets).
        [HttpPost("change-email")]
        [Authorize]
        public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest request)
        {
            var repo = new OwnerRepository(_connectionString);
            var owner = repo.Get(CurrentOwnerId());
            if (owner == null) return Unauthorized();
            if (!PasswordMatches(owner, request.CurrentPassword))
                return BadRequest(new { message = "Your current password is incorrect." });

            var newEmail = (request.NewEmail ?? "").Trim();
            if (!IsValidEmail(newEmail))
                return BadRequest(new { message = "Please enter a valid email address." });
            if (string.Equals(newEmail, owner.Email, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "That's already your email address." });
            if (repo.FindByEmail(newEmail) != null)
                return BadRequest(new { message = "An account with that email already exists." });

            var ticket = new EmailChangeTicket { OwnerId = owner.Id, FromEmail = owner.Email, ToEmail = newEmail };
            var token = _emailChangeProtector.Protect(JsonSerializer.Serialize(ticket), EmailChangeLinkLifetime);
            var confirmUrl = $"{Request.Scheme}://{Request.Host}/api/owner/confirm-email-change?token={Uri.EscapeDataString(token)}";
            await _emailSender.SendAsync(
                newEmail,
                "Confirm your new email — Regowned",
                EmailTemplates.ConfirmEmailChange(owner.Name, newEmail, confirmUrl, FrontendBaseUrl())
            );
            return Ok();
        }

        // Clicked from the confirmation email, so like VerifyEmail it doesn't require being
        // logged in — the signed link itself is the proof. Redirects back to My Account with
        // the outcome in the query string for the page to show.
        [HttpGet("confirm-email-change")]
        public async Task<IActionResult> ConfirmEmailChange([FromQuery] string token)
        {
            IActionResult Outcome(string result) => Redirect($"{FrontendBaseUrl()}/account?emailChange={result}");

            EmailChangeTicket ticket;
            try
            {
                if (string.IsNullOrEmpty(token)) return Outcome("invalid");
                ticket = JsonSerializer.Deserialize<EmailChangeTicket>(_emailChangeProtector.Unprotect(token, out _));
            }
            catch (Exception ex) when (ex is CryptographicException || ex is JsonException || ex is FormatException)
            {
                // Tampered with, malformed, or past its 24 hours.
                return Outcome("invalid");
            }

            var repo = new OwnerRepository(_connectionString);
            var owner = ticket == null ? null : repo.Get(ticket.OwnerId);
            if (owner == null || !string.Equals(owner.Email, ticket.FromEmail, StringComparison.OrdinalIgnoreCase))
                return Outcome("invalid");

            var existing = repo.FindByEmail(ticket.ToEmail);
            if (existing != null && existing.Id != owner.Id) return Outcome("taken");
            try
            {
                repo.SetEmail(owner.Id, ticket.ToEmail, markVerified: true);
            }
            catch (DbUpdateException)
            {
                // Someone else claimed this address between the check above and the save.
                return Outcome("taken");
            }
            await _stripeCustomerSync.SyncOwnerContactAsync(owner.Id);

            try
            {
                await _emailSender.SendAsync(
                    ticket.FromEmail,
                    "Your Regowned email was changed",
                    EmailTemplates.EmailChanged(owner.Name, ticket.ToEmail, FrontendBaseUrl())
                );
            }
            catch
            {
                // Courtesy notice only — the change itself already succeeded, so a failed
                // send to the old address shouldn't turn into an error page for the patron.
            }
            return Outcome("done");
        }

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var repo = new OwnerRepository(_connectionString);
            var owner = repo.Get(CurrentOwnerId());
            if (owner == null) return Unauthorized();
            if (!PasswordMatches(owner, request.CurrentPassword))
                return BadRequest(new { message = "Your current password is incorrect." });
            if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters." });

            owner.PasswordHash = _hasher.HashPassword(owner, request.NewPassword);
            if (!repo.SetPasswordHash(owner.Id, owner.PasswordHash)) return Unauthorized();
            // The new password invalidates every existing login cookie (SessionStampValidator),
            // including this one — re-issue it so the patron stays logged in on THIS device
            // while every other device gets logged out.
            await SignInOwner(owner);
            try
            {
                await _emailSender.SendAsync(
                    owner.Email,
                    "Your Regowned password was changed",
                    EmailTemplates.PasswordChanged(owner.Name, FrontendBaseUrl())
                );
            }
            catch
            {
                // Same as the email-changed notice: informational, the change already happened.
            }
            return Ok();
        }

        private int CurrentOwnerId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier));

        private static bool PasswordMatches(Owner owner, string password) =>
            _hasher.VerifyHashedPassword(owner, owner.PasswordHash, password ?? "") != PasswordVerificationResult.Failed;

        private async Task SignInOwner(Owner owner)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, owner.Id.ToString()),
                new(ClaimTypes.Name, owner.Name),
                new(ClaimTypes.Email, owner.Email),
                new(SessionStampValidator.StampClaimType, SessionStampValidator.StampFor(owner))
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
            EmailVerified = owner.EmailVerified,
            IsBusinessAccount = owner.IsBusinessAccount,
            BusinessMonthlyFeeUsd = owner.BusinessMonthlyFeeUsd,
            BusinessGownAllowance = owner.BusinessGownAllowance,
            BusinessBillingComplete = !string.IsNullOrEmpty(owner.BusinessStripeSubscriptionId)
        };
    }
}
