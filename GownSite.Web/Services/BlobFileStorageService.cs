using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace GownSite.Web.Services
{
    public class BlobFileStorageService : IFileStorageService
    {
        private readonly string _connectionString;

        public BlobFileStorageService(string connectionString)
        {
            _connectionString = connectionString;
        }

        public async Task<string> SaveAsync(IFormFile file, string container)
        {
            var containerClient = new BlobContainerClient(_connectionString, container);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);

            var ext = Path.GetExtension(file.FileName);
            var blobName = $"{Guid.NewGuid()}{ext}";
            var blobClient = containerClient.GetBlobClient(blobName);

            await using var stream = file.OpenReadStream();
            await blobClient.UploadAsync(stream, new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = file.ContentType }
            });

            return blobClient.Uri.ToString();
        }

        // The container is created with public blob access (see SaveAsync above), so
        // an unauthenticated BlobClient constructed directly from the stored URL can
        // read it back without needing the storage connection string again.
        public async Task<byte[]> ReadAsync(string url, CancellationToken cancellationToken = default)
        {
            var blobClient = new BlobClient(new Uri(url));
            try
            {
                var response = await blobClient.DownloadContentAsync(cancellationToken);
                return response.Value.Content.ToArray();
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
        }
    }
}
