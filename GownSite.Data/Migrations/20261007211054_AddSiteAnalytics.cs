using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GownSite.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteAnalytics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PageViews",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    PageType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    EntityId = table.Column<int>(type: "int", nullable: true),
                    VisitorId = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    Country = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    RegionCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Region = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsEntry = table.Column<bool>(type: "bit", nullable: false),
                    Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Device = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PageViews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SiteEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    EntityId = table.Column<int>(type: "int", nullable: true),
                    VisitorId = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    Detail = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteEvents", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_CreatedDate",
                table: "PageViews",
                column: "CreatedDate");

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_PageType_EntityId",
                table: "PageViews",
                columns: new[] { "PageType", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_PageViews_VisitorId",
                table: "PageViews",
                column: "VisitorId");

            migrationBuilder.CreateIndex(
                name: "IX_SiteEvents_Type_CreatedDate",
                table: "SiteEvents",
                columns: new[] { "Type", "CreatedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_SiteEvents_Type_EntityId",
                table: "SiteEvents",
                columns: new[] { "Type", "EntityId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PageViews");

            migrationBuilder.DropTable(
                name: "SiteEvents");
        }
    }
}
