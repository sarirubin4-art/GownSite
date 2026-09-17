using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdContactVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "DisplayOwnerEmail",
                table: "Gowns",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "DisplayOwnerNumber",
                table: "Gowns",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "InquiryCount",
                table: "Ads",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "ShowEmail",
                table: "Ads",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowName",
                table: "Ads",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowPhone",
                table: "Ads",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DisplayOwnerEmail",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "DisplayOwnerNumber",
                table: "Gowns");

            migrationBuilder.DropColumn(
                name: "InquiryCount",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "ShowEmail",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "ShowName",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "ShowPhone",
                table: "Ads");
        }
    }
}
