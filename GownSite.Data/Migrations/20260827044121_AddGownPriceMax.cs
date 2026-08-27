using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGownPriceMax : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PriceMax",
                table: "Gowns",
                type: "decimal(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PriceMax",
                table: "Gowns");
        }
    }
}
