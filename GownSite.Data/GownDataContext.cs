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
        modelBuilder.Entity<Owner>()
            .HasIndex(o => o.Email)
            .IsUnique();

        modelBuilder.Entity<GownPosting>()
            .HasOne(g => g.PromoCode).WithMany()
            .HasForeignKey(g => g.PromoCodeId).IsRequired(false);

        modelBuilder.Entity<GownPosting>()
            .HasIndex(g => g.BatchId);

        modelBuilder.Entity<GownPosting>()
            .HasIndex(g => g.NeedsConciergeDraft);

        modelBuilder.Entity<Ad>()
            .HasOne(a => a.PromoCode).WithMany()
            .HasForeignKey(a => a.PromoCodeId).IsRequired(false);

        // EF only applies a C# property initializer (`= 0.5`) to rows inserted through
        // this context — it doesn't know to use it as the *column's* default, so without
        // this, the migration that adds these columns would backfill every existing ad
        // with 0.0 (top-left corner) instead of 0.5 (centered, matching how every ad
        // displayed before this column existed).
        // HasDefaultValue alone also implicitly marks the property ValueGeneratedOnAdd,
        // which makes EF treat an explicit 0.0 (a legitimate crop dragged to the far
        // left/top edge) as "not set" and silently substitute the DB default of 0.5
        // instead — ValueGeneratedNever forces EF to always send whatever value the app
        // set, while the column keeps its DB-level default for anything inserted outside EF.
        modelBuilder.Entity<Ad>()
            .Property(a => a.ImageFocalX).HasDefaultValue(0.5).ValueGeneratedNever();
        modelBuilder.Entity<Ad>()
            .Property(a => a.ImageFocalY).HasDefaultValue(0.5).ValueGeneratedNever();

        modelBuilder.Entity<ContactMessage>()
            .HasIndex(c => c.IsResolved);

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
    public DbSet<ContactMessage> ContactMessages { get; set; }
}