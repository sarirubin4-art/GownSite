namespace GownSite.Web.Services
{
    public interface IFileStorageService
    {
        Task<string> SaveAsync(IFormFile file, string container);

        // Returns null if the file no longer exists. Callers that only need a
        // best-effort read (e.g. GownColorScoreService) should pass a short-lived
        // cancellationToken so a slow/unresponsive backend can't stall them.
        Task<byte[]> ReadAsync(string url, CancellationToken cancellationToken = default);
    }
}
