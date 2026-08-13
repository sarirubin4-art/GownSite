namespace GownSite.Web.Services
{
    // Shared HTML shell + styled button for every outgoing email, so the brand (logo,
    // colors, type) is consistent everywhere instead of each template being a bare
    // paragraph of text. Styles are all inline, since email clients ignore <style> blocks.
    public static class EmailLayout
    {
        private const string Rose = "#C6717A";
        private const string RoseDark = "#9C4E58";
        private const string TextPrimary = "#4A3439";
        private const string TextSecondary = "#8A6D72";
        private const string Background = "#FFF6F3";
        private const string Divider = "#F1E3E5";

        public static string Wrap(string bodyHtml, string frontendBaseUrl)
        {
            var logoUrl = $"{frontendBaseUrl}/logo.png";
            return $@"<!doctype html>
<html>
<body style=""margin:0;padding:0;background-color:{Background};"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:{Background};padding:32px 16px;"">
    <tr><td align=""center"">
      <table role=""presentation"" width=""100%"" style=""max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;"" cellpadding=""0"" cellspacing=""0"">
        <tr><td style=""background-color:#ffffff;padding:28px 24px 20px;text-align:center;border-bottom:2px solid {Divider};"">
          <img src=""{logoUrl}"" alt=""Regowned"" height=""38"" style=""display:inline-block;"" />
        </td></tr>
        <tr><td style=""padding:32px 28px;font-family:'Segoe UI',Arial,sans-serif;color:{TextPrimary};font-size:15px;line-height:1.6;"">
          {bodyHtml}
        </td></tr>
        <tr><td style=""padding:18px 28px;text-align:center;border-top:1px solid {Divider};"">
          <p style=""margin:0;font-size:12px;color:{TextSecondary};font-family:'Segoe UI',Arial,sans-serif;"">Regowned &middot; Buy, sell, and rent gowns for every simcha.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>";
        }

        public static string Button(string text, string url) =>
            $@"<div style=""text-align:center;margin:28px 0;"">
        <a href=""{url}"" style=""display:inline-block;background-color:{Rose};color:#ffffff;text-decoration:none;font-weight:600;padding:13px 30px;border-radius:999px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;"">{text}</a>
      </div>";

        public static string Heading(string text) =>
            $@"<h1 style=""margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:24px;color:{RoseDark};"">{text}</h1>";
    }
}
