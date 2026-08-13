using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddModerationPromoAlertsAndAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "Owners",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ModerationStatus",
                table: "Gowns",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyFeeOverride",
                table: "Gowns",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromoCodeId",
                table: "Gowns",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Gowns",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripePaymentMethodId",
                table: "Gowns",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ModerationStatus",
                table: "Ads",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyFeeOverride",
                table: "Ads",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromoCodeId",
                table: "Ads",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "Ads",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StripePaymentMethodId",
                table: "Ads",
                type: "nvarchar(max)",
                nullable: true);

            // Backfill: rows created before moderation existed were never actually reviewed
            // under this new concept, but anything already live/sold/subscribed was already
            // vetted in practice under the old flow — mark those Approved so they stay visible.
            // Anything else (never activated) stays Draft (0), the default, which accurately
            // reflects that it was never a completed, reviewable submission.
            migrationBuilder.Sql(@"
                UPDATE Gowns SET ModerationStatus = 2 /* Approved */
                    WHERE IsActive = 1 OR IsSold = 1 OR StripeSubscriptionId IS NOT NULL;
                UPDATE Ads SET ModerationStatus = 2 /* Approved */
                    WHERE IsActive = 1 OR StripeSubscriptionId IS NOT NULL;
            ");

            migrationBuilder.CreateTable(
                name: "PromoCodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DiscountType = table.Column<int>(type: "int", nullable: false),
                    DiscountValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    MaxUses = table.Column<int>(type: "int", nullable: true),
                    TimesUsed = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PromoCodes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SearchAlerts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Colors = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Sizes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Locations = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Styles = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ListingTypes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    UnsubscribeToken = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SearchAlerts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Gowns_PromoCodeId",
                table: "Gowns",
                column: "PromoCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_Ads_PromoCodeId",
                table: "Ads",
                column: "PromoCodeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Ads_PromoCodes_PromoCodeId",
                table: "Ads",
                column: "PromoCodeId",
                principalTable: "PromoCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Gowns_PromoCodes_PromoCodeId",
                table: "Gowns",
                column: "PromoCodeId",
                principalTable: "PromoCodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Ads_PromoCodes_PromoCodeId",
                table: "Ads");

            migrationBuilder.DropForeignKey(
                name: "FK_Gowns_PromoCodes_PromoCodeId",
                table: "Gowns");

            migrationBuilder.DropTable(
                name: "PromoCodes");

            migrationBuilder.DropTable(
                name: "SearchAlerts");

            migrationBuilder.DropIndex(
                name: "IX_Gowns_PromoCodeId",
                table: "Gowns");

            migrationBuilder.DropIndex(
                name: "IX_Ads_PromoCodeId",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "IsAdmin",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "ModerationStatus",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "MonthlyFeeOverride",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "PromoCodeId",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "StripePaymentMethodId",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "ModerationStatus",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "MonthlyFeeOverride",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "PromoCodeId",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "StripePaymentMethodId",
                table: "Ads");
        }
    }
}
