namespace GownSite.Web.Services
{
    // The <input type="file" accept="image/*"> on every posting form is a client-side
    // hint only — nothing stops a user from picking a non-image file anyway (drag-and-drop,
    // "All Files" in the OS picker, etc.). Every IFormFile that ends up as an ad or gown
    // image needs this checked server-side before it reaches storage, or it gets served
    // back inside an <img> tag that can't render it (e.g. a PDF saved with a .pdf
    // extension shows as a broken image everywhere it's displayed).
    public static class ImageUploadValidator
    {
        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/png", "image/webp", "image/gif"
        };

        public const string ErrorMessage = "Please upload a valid image file (JPEG, PNG, WEBP, or GIF).";

        public static bool IsValidImage(IFormFile file) =>
            file != null && file.Length > 0 && AllowedContentTypes.Contains(file.ContentType);
    }
}
