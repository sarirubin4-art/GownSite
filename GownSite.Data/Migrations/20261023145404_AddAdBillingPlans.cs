using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdBillingPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BillingPlan",
                table: "Ads",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelsAt",
                table: "Ads",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PlanStartedAt",
                table: "Ads",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BillingPlan",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "CancelsAt",
                table: "Ads");

            migrationBuilder.DropColumn(
                name: "PlanStartedAt",
                table: "Ads");
        }
    }
}
