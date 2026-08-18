using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOwnerBusinessPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BusinessGownAllowance",
                table: "Owners",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BusinessMonthlyFeeUsd",
                table: "Owners",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BusinessOverageFeePerGownUsd",
                table: "Owners",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessStripeCustomerId",
                table: "Owners",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessStripePaymentMethodId",
                table: "Owners",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessStripeSubscriptionId",
                table: "Owners",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsBusinessAccount",
                table: "Owners",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BusinessGownAllowance",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "BusinessMonthlyFeeUsd",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "BusinessOverageFeePerGownUsd",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "BusinessStripeCustomerId",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "BusinessStripePaymentMethodId",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "BusinessStripeSubscriptionId",
                table: "Owners");

            migrationBuilder.DropColumn(
                name: "IsBusinessAccount",
                table: "Owners");
        }
    }
}
