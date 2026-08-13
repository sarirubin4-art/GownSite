using GownSite.Data;
using Microsoft.AspNetCore.Identity;

namespace GownSite.Web;

public static class SeedData
{
    public static void EnsureSeeded(string connectionString)
    {
        using var context = new GownDataContext(connectionString);

        if (!context.Ads.Any())
        {
            context.Ads.AddRange(
                new Ad
                {
                    Title = "Radiant Bridal Makeup",
                    Category = AdCategory.Makeup,
                    ImageUrl = "https://picsum.photos/seed/gownsite-makeup/400/300",
                    Description = "Flawless, long-lasting makeup for your big day and every simcha in between.",
                    TargetUrl = null,
                    IsActive = true
                },
                new Ad
                {
                    Title = "Updo & Blowout Studio",
                    Category = AdCategory.Hair,
                    ImageUrl = "https://picsum.photos/seed/gownsite-hair/400/300",
                    Description = "Professional styling for brides, mothers, and guests of every simcha.",
                    TargetUrl = null,
                    IsActive = true
                },
                new Ad
                {
                    Title = "Precision Gown Alterations",
                    Category = AdCategory.Alterations,
                    ImageUrl = "https://picsum.photos/seed/gownsite-alterations/400/300",
                    Description = "Perfect fit guaranteed - hemming, taking in, bustling, and more.",
                    TargetUrl = null,
                    IsActive = true
                }
            );
        }

        if (!context.Gowns.Any())
        {
            var hasher = new PasswordHasher<Owner>();
            var owner = new Owner
            {
                Name = "Chaya Green",
                Number = "555-010-1234",
                Email = "sample.owner@example.com",
                IsAdmin = true
            };
            owner.PasswordHash = hasher.HashPassword(owner, "SampleOwner123!");
            context.Owners.Add(owner);
            context.SaveChanges();

            context.Gowns.AddRange(
                new GownPosting
                {
                    OwnerId = owner.Id,
                    Description = "Elegant champagne mother-of-the-bride gown, lightly worn, perfect for a fall wedding.",
                    Color = "Champagne",
                    Size = "10",
                    Price = 180,
                    Location = "Lakewood, NJ",
                    ListingType = ListingType.Rent,
                    PrimaryPictureUrl = "https://picsum.photos/seed/gownsite-gown1/600/800",
                    IsActive = true,
                    DisplayOwnerName = true,
                    CreatedDate = DateTime.UtcNow.AddDays(-2),
                    Brand = "Jovani",
                    Condition = "Like new",
                    StyleTags = "MotherOfBrideOrGroom,Evening"
                },
                new GownPosting
                {
                    OwnerId = owner.Id,
                    Description = "Stunning blush ball gown with beaded bodice, worn once for a wedding.",
                    Color = "Blush",
                    Size = "6",
                    Price = 450,
                    Location = "Brooklyn, NY",
                    ListingType = ListingType.Sale,
                    PrimaryPictureUrl = "https://picsum.photos/seed/gownsite-gown2/600/800",
                    IsActive = true,
                    DisplayOwnerName = false,
                    CreatedDate = DateTime.UtcNow.AddDays(-1),
                    Brand = "Sherri Hill",
                    Condition = "Worn once",
                    StyleTags = "BallGown,Bridal"
                }
            );
        }

        context.SaveChanges();
    }
}
