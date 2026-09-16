namespace GownSite.Web.Services
{
    // Recomputes a gown's per-color match scores (see GownPosting.ColorScoresJson)
    // whenever its photo or Color tags could have changed — called from wherever a
    // gown goes live (ActivateListing/ApproveListing) or gets edited afterward
    // (Edit/EditGown), since none of those reset moderation and re-trigger approval.
    public interface IGownColorScoreService
    {
        // primaryImageBytes lets a caller that already has the newly uploaded photo's
        // bytes in memory (Edit/EditGown/PostGownForPatron with a new PrimaryPicture)
        // skip re-downloading it from storage just to analyze it. Omit it and the
        // gown's current PrimaryPictureUrl is read back from storage instead.
        Task RecomputeAsync(int gownPostingId, byte[] primaryImageBytes = null);
    }
}
