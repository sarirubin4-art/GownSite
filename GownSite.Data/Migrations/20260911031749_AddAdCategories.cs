using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Deliberately NOT dropping the old "Category" int column here (EF's
            // auto-scaffold wanted to, since the C# model no longer maps it). Dropping it
            // in the same migration that's applied to production *before* the new code
            // deploys would break every ad-related endpoint on the still-running old code
            // for however long GitHub Actions takes to build and deploy — this stays purely
            // additive instead. "Category" is left as an unused, unmapped leftover column;
            // safe to drop in a later cleanup migration once the old code is long gone.
            migrationBuilder.AddColumn<string>(
                name: "Categories",
                table: "Ads",
                type: "nvarchar(max)",
                nullable: true);

            // Backfill every existing ad's new Categories column from its old single
            // Category value, using the enum's current ordinal->name mapping (see the
            // AdCategory enum in GownPosting.cs — values are always appended, never
            // inserted, so these ordinals are stable). ELSE 'Other' is defensive only —
            // every row should already hold a valid 0-10 value — so an unexpected one
            // lands in a real, visible category instead of a silent NULL that would make
            // the ad quietly vanish from every category filter with nothing to explain why.
            migrationBuilder.Sql(@"
                UPDATE Ads SET Categories = CASE Category
                    WHEN 0 THEN 'Makeup'
                    WHEN 1 THEN 'Hair'
                    WHEN 2 THEN 'Alterations'
                    WHEN 3 THEN 'GownRental'
                    WHEN 4 THEN 'Other'
                    WHEN 5 THEN 'Photography'
                    WHEN 6 THEN 'PartyPlanners'
                    WHEN 7 THEN 'Gemachs'
                    WHEN 8 THEN 'GirlsWomensApparel'
                    WHEN 9 THEN 'Sheitels'
                    WHEN 10 THEN 'Bridal'
                    ELSE 'Other'
                END");

            // The leftover "Category" column is still NOT NULL, but the new code never sets
            // it (it's unmapped) — without a default, every new-code INSERT would violate
            // that constraint and every ad post would 500. A default lets new-code inserts
            // succeed silently (old-code reads of a new-code-created row see a harmless
            // fallback value for however long the deploy window lasts) without requiring
            // new code to know or care that the old column still physically exists.
            migrationBuilder.Sql(@"
                ALTER TABLE Ads ADD CONSTRAINT DF_Ads_Category DEFAULT 0 FOR Category");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Ads_Category')
                    ALTER TABLE Ads DROP CONSTRAINT DF_Ads_Category");

            migrationBuilder.DropColumn(
                name: "Categories",
                table: "Ads");
        }
    }
}
