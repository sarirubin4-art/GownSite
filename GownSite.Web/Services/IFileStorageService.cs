namespace GownSite.Web.Services
{
    public interface IFileStorageService
    {
        Task<string> SaveAsync(IFormFile file, string container);
    }
}
