using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGownConciergeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NeedsConciergeDraft",
                table: "Gowns",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "OneTimeFeeUsd",
                table: "Gowns",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Gowns_NeedsConciergeDraft",
                table: "Gowns",
                column: "NeedsConciergeDraft");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Gowns_NeedsConciergeDraft",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "NeedsConciergeDraft",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "OneTimeFeeUsd",
                table: "Gowns");
        }
    }
}
