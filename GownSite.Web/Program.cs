using Microsoft.AspNetCore.Authentication.Cookies;
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
        app.UseStaticFiles();
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

        app.MapFallbackToFile("index.html");

        app.Run();
    }
}