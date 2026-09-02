# Regowned (GownSite)

Live gown rental/sale marketplace at regowned.com. ASP.NET Core 9 Web API (`GownSite.Web`) + EF Core/Azure SQL (`GownSite.Data`) + React 19/Vite (`GownSite.Web/ClientApp`). Stripe.net for payments, Azure Communication Services for email, Azure App Service hosting. GitHub Actions auto-deploys on push to `master`. No staging environment — `master` is production.

## Deploy workflow (always do both, in this order)

1. If the change includes an EF migration, apply it to **production** before pushing (GitHub Actions deploys the new code immediately on push, and it will 500 on missing columns otherwise):
   - Write the prod connection string to `GownSite.Web/appsettings.local.json` (gitignored) — ask the user for it if you don't already have it in context.
   - `dotnet ef database update --startup-project ../GownSite.Web` from `GownSite.Data/`.
   - Verify with `dotnet ef migrations list`.
   - Delete `appsettings.local.json` immediately after.
2. `git push origin master` — only after explicit user confirmation.

For a **high-risk change** (payment/pricing logic, auth/permissions, a data migration, or a large multi-file change) — before pushing, ask the user whether they'd like a fresh-Opus-subagent code review first (`/code-review`), rather than always running one automatically. Routine changes don't need to be offered this.

Local dev DB is SQL Express (`.\sqlexpress`, `GownSite` catalog, integrated security) — connection string lives in `GownSite.Web/appsettings.json`.

## Local dev server

`.claude/launch.json`'s `gownsite` config runs `dotnet run` from `GownSite.Web`, but the actual UI is served by a **separate Vite dev server** — `npm run dev` inside `GownSite.Web/ClientApp` (port 3000, proxies `/api` and `/uploads` to the dotnet backend on port 5200). **Both processes must be running** — `dotnet run` alone serves the API only and 404s on `/`. If you started `dotnet run` in the background for testing (e.g. to apply a migration), stop it again before running `dotnet build`/`dotnet ef` — the locked DLL will fail the build otherwise.

If this repo isn't your session's working directory, the Browser pane's `preview_start({name: "gownsite"})` will silently read the *wrong* `.claude/launch.json` (whichever directory the session actually started in) and launch the wrong project. Use `preview_start({url: "http://localhost:3000"})` instead to sidestep this entirely.

## Verification gotchas

- **Stripe's hosted Checkout page actively resists browser automation** (shows literal "I am an AI agent..." text and won't respond to scripted clicks on payment fields). Don't attempt to drive real Stripe checkout via the Browser pane — verify the backend logic instead (direct `fetch()` calls, or a test-only DB update simulating "billing complete"), and say so explicitly rather than claiming full verification.
- **MUI `Autocomplete` multi-select fields (Color/Size everywhere) resist both click+type and ref-based `form_input`.** For testing NEW backend endpoints that a form like this submits to, it's a legitimate substitute to call the endpoint directly via `fetch()` in the browser's JS console context (authenticated, same-origin, cookies included) rather than fighting the widget. Only worth fighting through the real UI when the UI itself is what's new and unproven.
- After promoting an owner to admin (or changing `IsAdmin`/other claims) directly via SQL, **the existing session cookie won't reflect it** — ASP.NET Core bakes claims into the cookie at login time. Log out and back in (or hit `/api/owner/login` again) after any direct DB claims change.
- The Browser pane's screenshot/ref coordinates can go stale if a floating ad card loads asynchronously and shifts layout after the ref was captured — clicks land on the wrong spot with no visible error. If a click silently does nothing, re-fetch `read_page` fresh, or just click via `javascript_tool` (`element.click()`) targeting the element by text content, which sidesteps layout drift entirely.

## Established conventions (from recent feature work)

- Every repo class (`GownRepository`, `OwnerRepository`, etc.) opens its own `GownDataContext` per call — no shared/injected DbContext.
- `BatchId` (`Guid?` on `GownPosting`) is a pure grouping tag with no backing entity — used for bulk posting batches, and now also for concierge/on-site-visit drafts. **Any new "batch of gowns" feature should always set `BatchId`, even for a batch of 1** — `AdminController.ApproveGown`'s `isSoloDefaultPricing` check keys off `!BatchId.HasValue`, so leaving it null on a gown that's getting a custom one-time fee elsewhere will double-charge the standard setup fee on top.
- New `ModerationStatus`/`AdCategory`/`DiscountType` enum values are always **appended after the last existing value**, never inserted — preserves existing stored int values in the DB.
- One-time Stripe charges ride on the `InvoiceItemService().CreateAsync(...)` call already used in `AdminController.ApproveGown` for the listing setup fee — there is no combined one-time+recurring Checkout Session anywhere in this codebase, and no precedent for one. Don't build one; add another `InvoiceItemService` call at approval time instead.
- Admin-side "someone else's data" endpoints (`AdminController.EditGown`, `PostGownForPatron`) reuse the exact same DTO/repo methods as the owner-facing versions, just without the ownership check — role-gating happens at the controller level (`[Authorize(Roles = "Admin")]`), not per-action.
- New customer-facing "contact us"-shaped features (short message to admin) should reuse `ContactMessage`/`ContactAdminDialog`/the Inbox tab rather than building a new entity — differentiate by the `topic` string.

## Current feature state (as of 2026-08-18)

- **Concierge posting service** just shipped (commit `d4b5c06`): customers can pay a one-time $7/gown fee to have admin draft their listing for them (`/concierge/form`), or a Lakewood, NJ business can request an on-site visit billed at $50/hour (routes through the existing Contact/Inbox flow). Admin processes remote requests via the new "Concierge Requests" tab; on-site visits go through the extended "Post for Patron" dialog. Full design rationale is in the commit message and code comments.
- **Business accounts** (flat monthly fee for high-volume posters) and **overage handling for them are a known gap, deliberately deferred** — the owner decided it's not worth building automatic overage notices/charges until there's an actual business account that goes over its allowance (soft-cap only today: admin sees the live count, nothing charges automatically). A full design for this already exists at `C:\Users\Sari\.claude\plans\gentle-purring-scott.md` if it's ever revisited — ask the owner before resurrecting it, since the earlier call was explicitly "wait and see."
- Stripe is in **test-key mode** — switching to live keys is a known pending step, not yet done.
