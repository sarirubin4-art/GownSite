using Microsoft.AspNetCore.Authentication.Cookies;
using GownSite.Data;
using GownSite.Web.Services;
using System.Text.Json.Serialization;

namespace GownSite.Web;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllersWithViews()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
                options.JsonSerializerOptions.NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString;
            });

        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "GownSiteAuth";
                options.ExpireTimeSpan = TimeSpan.FromDays(30);
                options.SlidingExpiration = true;
                // Logs out other devices after a password change — see SessionStampValidator.
                options.Events.OnValidatePrincipal = context =>
                    context.HttpContext.RequestServices.GetRequiredService<SessionStampValidator>().ValidateAsync(context);
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = 401;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = 403;
                    return Task.CompletedTask;
                };
            });
        builder.Services.AddAuthorization();

        var azureStorageConnectionString = builder.Configuration["AzureStorage:ConnectionString"];
        if (!string.IsNullOrEmpty(azureStorageConnectionString))
        {
            builder.Services.AddSingleton<IFileStorageService>(new BlobFileStorageService(azureStorageConnectionString));
        }
        else
        {
            builder.Services.AddSingleton<IFileStorageService, LocalFileStorageService>();
        }

        builder.Services.AddSingleton<IGownColorScoreService, GownColorScoreService>();

        // Site traffic: GeoLite2 city lookup (database kept fresh by GeoDatabaseUpdater)
        // plus the recorder that turns requests into anonymous PageView/SiteEvent rows.
        builder.Services.AddHttpClient();
        builder.Services.AddSingleton<GeoLocator>();
        builder.Services.AddSingleton<AnalyticsRecorder>();
        builder.Services.AddSingleton<StripeCustomerSync>();
        builder.Services.AddSingleton(sp => new SessionStampValidator(
            ownerId => new OwnerRepository(builder.Configuration.GetConnectionString("ConStr")).Get(ownerId),
            sp.GetRequiredService<ILogger<SessionStampValidator>>()));
        builder.Services.AddHostedService<GeoDatabaseUpdater>();

        var emailConnectionString = builder.Configuration["Email:ConnectionString"];
        if (!string.IsNullOrEmpty(emailConnectionString))
        {
            builder.Services.AddSingleton<IEmailSender>(new AzureEmailSender(emailConnectionString, builder.Configuration["Email:SenderAddress"]));
        }
        else
        {
            builder.Services.AddSingleton<IEmailSender, NoOpEmailSender>();
        }

        var app = builder.Build();

        Stripe.StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];

        Directory.CreateDirectory(Path.Combine(app.Environment.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "uploads", "gowns"));

        if (app.Environment.IsDevelopment())
        {
            SeedData.EnsureSeeded(builder.Configuration.GetConnectionString("ConStr")!);
        }

        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();

            // Canonicalize www.regowned.com -> regowned.com so the two aren't treated
            // as separate sites (search engines, shared links, etc).
            app.Use(async (context, next) =>
            {
                if (string.Equals(context.Request.Host.Host, "www.regowned.com", StringComparison.OrdinalIgnoreCase))
                {
                    var target = $"https://regowned.com{context.Request.Path}{context.Request.QueryString}";
                    context.Response.Redirect(target, permanent: true);
                    return;
                }
                await next();
            });
        }

        //app.UseHttpsRedirection();
        // index.html must never be served from a browser cache: it's the one file that points
        // at the current build's hashed JS bundle, so a stale copy keeps a visitor on old
        // front-end code after a deploy. The hashed bundles themselves are safe to cache.
        var staticFileOptions = new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                if (ctx.File.Name == "index.html")
                    ctx.Context.Response.Headers.CacheControl = "no-cache";
            }
        };
        app.UseStaticFiles(staticFileOptions);
        if (app.Environment.IsDevelopment())
        {
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "npm",
                Arguments = "run dev",
                WorkingDirectory = Path.Combine(Directory.GetCurrentDirectory(), "ClientApp"),
                UseShellExecute = true
            };
        
            var spaProcess = System.Diagnostics.Process.Start(psi);
            app.Lifetime.ApplicationStopping.Register(() =>
            {
                if (spaProcess is { HasExited: false })
                {
                    spaProcess.Kill(true);
                }
            });
        }
        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllerRoute(
            name: "default",
            pattern: "{controller}/{action=Index}/{id?}");

        app.MapFallbackToFile("index.html", staticFileOptions);

        app.Run();
    }
}