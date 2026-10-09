using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GownSite.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace GownSite.Web.Services
{
    // Makes a password change (or a "forgot password" reset) log out every OTHER device.
    //
    // A login cookie is a signed pass that's otherwise trusted on its own until it expires —
    // and with sliding expiration, a regularly-used one never does — so changing the password
    // used to leave any other logged-in device (a shared computer, or someone who got hold of
    // the session) logged in. Now each cookie carries a short fingerprint of the password
    // hash, and every request compares it to the account's current one. A new password means
    // a new fingerprint, so every cookie issued before the change stops working. Deleting an
    // account logs it out everywhere too, since there's no owner left to match.
    //
    // Cookies issued before this shipped have no fingerprint; rather than logging every patron
    // out at once, they're quietly given the current one on their next request. (The one gap:
    // a session left completely unused from rollout until after a password change gets the
    // NEW fingerprint when it next shows up. Rare, and it only affects pre-rollout cookies.)
    public class SessionStampValidator
    {
        public const string StampClaimType = "regowned:pwstamp";

        private readonly Func<int, Owner> _getOwner;
        private readonly ILogger<SessionStampValidator> _logger;

        public SessionStampValidator(Func<int, Owner> getOwner, ILogger<SessionStampValidator> logger)
        {
            _getOwner = getOwner;
            _logger = logger;
        }

        // Not the hash itself: just enough of a SHA-256 of it to detect a change, so the
        // cookie never carries anything usable for cracking the password.
        public static string StampFor(Owner owner) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(owner.PasswordHash ?? ""))).Substring(0, 16);

        public async Task ValidateAsync(CookieValidatePrincipalContext context)
        {
            var principal = context.Principal;
            if (!int.TryParse(principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var ownerId))
            {
                await RejectAsync(context);
                return;
            }

            Owner owner;
            try
            {
                owner = _getOwner(ownerId);
            }
            catch (Exception ex)
            {
                // A database hiccup shouldn't log everyone out or 500 every page — let the cookie
                // through this once; anything that actually needs the database fails on its own.
                _logger.LogWarning(ex, "Could not check session stamp for owner {OwnerId}; allowing request", ownerId);
                return;
            }

            if (owner == null)
            {
                await RejectAsync(context);
                return;
            }

            var expected = StampFor(owner);
            var stamp = principal.FindFirstValue(StampClaimType);
            if (stamp == null)
            {
                // Pre-rollout cookie: upgrade it in place instead of logging the patron out.
                var identity = new ClaimsIdentity(principal.Claims, principal.Identity?.AuthenticationType);
                identity.AddClaim(new Claim(StampClaimType, expected));
                context.ReplacePrincipal(new ClaimsPrincipal(identity));
                context.ShouldRenew = true;
                return;
            }

            if (stamp != expected) await RejectAsync(context);
        }

        private static async Task RejectAsync(CookieValidatePrincipalContext context)
        {
            context.RejectPrincipal();
            // Also deletes the cookie, so the browser stops sending a dead one on every request.
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }
    }
}
