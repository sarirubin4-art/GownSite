using GownSite.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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

    public class OwnerViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Number { get; set; }
        public string Email { get; set; }
        public bool IsAdmin { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class OwnerController : ControllerBase
    {
        private readonly string _connectionString;
        private static readonly PasswordHasher<Owner> _hasher = new();

        public OwnerController(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("ConStr");
        }

        [HttpPost("signup")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { message = "Name, email, and password are required." });

            var repo = new OwnerRepository(_connectionString);
            if (repo.FindByEmail(request.Email) != null)
                return BadRequest(new { message = "An account with that email already exists." });

            var owner = new Owner
            {
                Name = request.Name,
                Number = request.Number,
                Email = request.Email
            };
            owner.PasswordHash = _hasher.HashPassword(owner, request.Password);
            repo.Create(owner);

            await SignInOwner(owner);
            return Ok(ToViewModel(owner));
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
            IsAdmin = owner.IsAdmin
        };
    }
}
