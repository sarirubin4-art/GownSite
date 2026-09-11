using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GownSite.Data;

public class GownDataContextFactory : IDesignTimeDbContextFactory<GownDataContext>
{
    public GownDataContext CreateDbContext(string[] args)
    {
        var basePath = Path.Combine(Directory.GetCurrentDirectory(),
            $"..{Path.DirectorySeparatorChar}GownSite.Web");
        var localOverridePath = Path.Combine(basePath, "appsettings.local.json");
        var hasLocalOverride = File.Exists(localOverridePath);

        var config = new ConfigurationBuilder()
           .SetBasePath(basePath)
           .AddJsonFile("appsettings.json")
           .AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true).Build();

        if (!config.GetSection("ConnectionStrings").GetChildren().Any(c => c.Key == "ConStr" && !string.IsNullOrWhiteSpace(c.Value)))
            throw new InvalidOperationException(
                "No ConnectionStrings:ConStr found in appsettings.json (or appsettings.local.json). " +
                "Design-time EF tooling has nothing to connect to.");
        var connStr = config.GetConnectionString("ConStr");

        // appsettings.local.json exists solely so `dotnet ef database update` can be
        // pointed at production for a migration, per the deploy workflow in CLAUDE.md —
        // but a session that forgets to delete it afterward silently sends every future
        // `dotnet ef` command in this repo to production instead of local dev SQL Express,
        // with no indication in the command's own output. This happened once already
        // (2026-09-11): a migration meant to test against local dev landed on production
        // because a prior session's appsettings.local.json was never cleaned up.
        //
        // A printed warning alone isn't a real guard — it's the same output channel that
        // already got missed once, by a session (human or agent) skimming past "Applying
        // migration... Done." A connection string that doesn't look like local dev now
        // hard-stops here instead, and only proceeds with an explicit, one-time opt-in via
        // REGOWNED_ALLOW_REMOTE_EF=1 (set inline on the command, not saved anywhere, so it
        // can't linger the way the override file itself did).
        var looksLocal = connStr.Contains("sqlexpress", StringComparison.OrdinalIgnoreCase)
            || connStr.Contains("localhost", StringComparison.OrdinalIgnoreCase)
            || connStr.Contains("(local)", StringComparison.OrdinalIgnoreCase)
            || connStr.Contains("127.0.0.1", StringComparison.OrdinalIgnoreCase)
            || connStr.Contains(@"Data Source=.\", StringComparison.OrdinalIgnoreCase);

        if (hasLocalOverride)
        {
            if (!looksLocal)
            {
                var allowed = Environment.GetEnvironmentVariable("REGOWNED_ALLOW_REMOTE_EF") == "1";
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine();
                Console.WriteLine("############################################################");
                Console.WriteLine("# appsettings.local.json points at what looks like a REMOTE /");
                Console.WriteLine("# PRODUCTION database, not local dev.");
                Console.WriteLine(allowed
                    ? "# REGOWNED_ALLOW_REMOTE_EF=1 is set — proceeding as explicitly allowed."
                    : "# Refusing to proceed. If this is intentional (applying a migration to");
                if (!allowed)
                {
                    Console.WriteLine("# production per the deploy workflow), re-run with:");
                    Console.WriteLine("#   $env:REGOWNED_ALLOW_REMOTE_EF=\"1\"; dotnet ef <command> ...");
                }
                Console.WriteLine("# Delete GownSite.Web/appsettings.local.json as soon as you're done —");
                Console.WriteLine("# every `dotnet ef` command in this repo uses it while it exists.");
                Console.WriteLine("############################################################");
                Console.WriteLine();
                Console.ResetColor();

                if (!allowed)
                    throw new InvalidOperationException(
                        "appsettings.local.json targets a non-local database. Set REGOWNED_ALLOW_REMOTE_EF=1 " +
                        "on the command to proceed deliberately, or delete appsettings.local.json to use local dev.");
            }
            else
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine();
                Console.WriteLine("############################################################");
                Console.WriteLine("# appsettings.local.json override is active (looks like local dev).");
                Console.WriteLine("# Delete it as soon as you're done — every `dotnet ef` command in");
                Console.WriteLine("# this repo uses it while it exists.");
                Console.WriteLine("############################################################");
                Console.WriteLine();
                Console.ResetColor();
            }
        }

        return new GownDataContext(connStr);
    }
}
