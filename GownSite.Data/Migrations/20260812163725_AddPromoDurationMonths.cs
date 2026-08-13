using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPromoDurationMonths : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DurationMonths",
                table: "PromoCodes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromoDurationMonths",
                table: "Gowns",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromoDurationMonths",
                table: "Ads",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DurationMonths",
                table: "PromoCodes");

            migrationBuilder.DropColumn(
                name: "PromoDurationMonths",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "PromoDurationMonths",
                table: "Ads");
        }
    }
}
