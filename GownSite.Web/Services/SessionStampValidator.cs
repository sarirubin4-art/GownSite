using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GownSite.Data;
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
    // account logs it out everywhere too, since there's no owner left to match. Admin status
    // is part of the fingerprint as well, so removing someone's admin rights takes effect
    // immediately instead of lingering in their cookie's role claim.
    //
    // Cookies issued before this shipped have no fingerprint; rather than logging every patron
    // out at once, they're quietly given the current one on their next request. The one gap:
    // a session left completely unused from rollout until after a password change gets the
    // NEW fingerprint when it next shows up. That gap closes on its own within 30 days of
    // rollout: an unused cookie expires 30 days after its last use (the expiry is sealed inside
    // the signed cookie), and any pre-rollout cookie that IS used gets upgraded on that visit —
    // so after 30 days, no cookie without a fingerprint can still be valid. Closing it outright
    // would need a "password changed at" column and a migration, which wasn't worth it.
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
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{owner.PasswordHash}|{owner.IsAdmin}"))).Substring(0, 16);

        public Task ValidateAsync(CookieValidatePrincipalContext context)
        {
            var principal = context.Principal;
            if (!int.TryParse(principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var ownerId))
            {
                context.RejectPrincipal();
                return Task.CompletedTask;
            }

            Owner owner;
            try
            {
                owner = _getOwner(ownerId);
            }
            catch (Exception ex)
            {
                // Can't verify, so don't trust it — but rejecting never deletes the cookie (see
                // below), so this only treats the request as logged-out while the database is
                // unreachable; the same cookie works again as soon as it's back.
                _logger.LogWarning(ex, "Could not check session stamp for owner {OwnerId}; treating request as logged out", ownerId);
                context.RejectPrincipal();
                return Task.CompletedTask;
            }

            if (owner == null)
            {
                context.RejectPrincipal();
                return Task.CompletedTask;
            }

            var expected = StampFor(owner);
            var stamp = principal.FindFirstValue(StampClaimType);
            if (stamp == null)
            {
                // Pre-rollout cookie: upgrade it in place instead of logging the patron out —
                // unless its Admin role no longer matches the account, since the upgrade keeps
                // the cookie's existing claims and would otherwise carry a revoked role forward.
                if (principal.IsInRole("Admin") != owner.IsAdmin)
                {
                    context.RejectPrincipal();
                    return Task.CompletedTask;
                }
                var identity = new ClaimsIdentity(principal.Claims, principal.Identity?.AuthenticationType);
                identity.AddClaim(new Claim(StampClaimType, expected));
                context.ReplacePrincipal(new ClaimsPrincipal(identity));
                context.ShouldRenew = true;
                return Task.CompletedTask;
            }

            // Rejecting only ignores the cookie for this request; it deliberately does NOT send a
            // cookie-delete. A request still in flight with the old cookie while the patron changes
            // their password would otherwise have its delete land after ChangePassword's fresh
            // cookie and log them out on the very device they just used. A dead cookie is just
            // ignored until the browser replaces it at the next login.
            if (stamp != expected) context.RejectPrincipal();
            return Task.CompletedTask;
        }
    }
}
