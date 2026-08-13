using Microsoft.EntityFrameworkCore;

namespace GownSite.Data;

public class GownDataContext : DbContext
{
    private readonly string _connectionString;

    public GownDataContext(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlServer(_connectionString, sql => sql.EnableRetryOnFailure());
    }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GownPosting>()
            .HasOne<PromoCode>().WithMany()
            .HasForeignKey(g => g.PromoCodeId).IsRequired(false);

        modelBuilder.Entity<GownPosting>()
            .HasIndex(g => g.BatchId);

        modelBuilder.Entity<Ad>()
            .HasOne<PromoCode>().WithMany()
            .HasForeignKey(a => a.PromoCodeId).IsRequired(false);

        foreach (var relationship in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
        {
            relationship.DeleteBehavior = DeleteBehavior.Restrict;
        }
    }

    public DbSet<Owner> Owners { get; set; }
    public DbSet<GownPosting> Gowns { get; set; }
    public DbSet<GownPicture> GownPictures { get; set; }
    public DbSet<Ad> Ads { get; set; }
    public DbSet<PromoCode> PromoCodes { get; set; }
    public DbSet<SearchAlert> SearchAlerts { get; set; }
}