using GownSite.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Security.Claims;

namespace GownSite.Web.Filters
{
    // Server-side backstop for the frontend's verification gate — a determined caller could
    // hit these endpoints directly, so posting/contacting actions are blocked here too, not
    // just hidden in the UI. Reads the owner fresh from the DB (not the sign-in cookie's
    // claims) so access unlocks immediately once they verify, without needing to log back in.
    public class RequireVerifiedEmailAttribute : Attribute, IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var idClaim = context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (idClaim == null || !int.TryParse(idClaim, out var ownerId))
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var configuration = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
            var connectionString = configuration.GetConnectionString("ConStr");
            var owner = new OwnerRepository(connectionString).Get(ownerId);

            if (owner == null)
            {
                context.Result = new UnauthorizedResult();
                return;
            }
            if (!owner.EmailVerified)
            {
                context.Result = new ObjectResult(new { message = "Please verify your email before doing this." }) { StatusCode = 403 };
                return;
            }

            await next();
        }
    }
}
