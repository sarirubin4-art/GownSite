using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdImageFocalPoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "ImageFocalX",
                table: "Ads",
                type: "float",
                nullable: false,
                defaultValue: 0.5);

            migrationBuilder.AddColumn<double>(
                name: "ImageFocalY",
                table: "Ads",
                type: "float",
                nullable: false,
                defaultValue: 0.5);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageFocalX",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "ImageFocalY",
                table: "Ads");
        }
    }
}
