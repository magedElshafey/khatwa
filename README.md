# خطوة | Khotwa Life OS

Offline-first Arabic personal dashboard. Learning, English, Business, workouts, routines, and private trackers. All tracking data is stored **locally in the browser** (IndexedDB), not in GitHub or Vercel.

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run build
npm test
```

To preview the deployable output, serve the `public` directory from localhost:

```bash
cd public
npx serve -l 8080
```

Visit `http://localhost:8080`. A service worker needs localhost or HTTPS; don't open `index.html` with `file://`.

## Deploy with GitHub + Vercel

1. Create an empty **private** GitHub repository named `khotwa-life-os` (do not initialize a README, gitignore, or license — included here).
2. Push this folder to its `main` branch.
3. In Vercel, choose **Add New → Project → Import Git Repository** and select the repository.
4. Use **Framework Preset: Other**, **Build Command: `npm run check`**, **Output Directory: `public`** (already specified in `vercel.json`).
5. Deploy. On every push to `main`, Vercel will build and publish automatically. PR branches can get preview deployments.

**This is a static site, not a React app**. It has TypeScript source in `src/app.ts`, compiled to vanilla JavaScript; it does not need a running backend.

## Changes and updates

Edit `src/app.ts` for application logic, `styles.css` for layout, `roadmap-data.js` for learning content, `sw.js` for offline caching, and `assets/` for app icons. `npm run build` compiles and prepares `public/`. Don't manually edit the generated `dist/` or `public/` files.

Online page refreshes fetch newer assets first; offline launches use cached files. Reopen/reload the app after a production deployment. An already-open tab may keep running its current JS until reloaded.

## Important privacy & data limits

- Records and personal photos are kept in **IndexedDB per browser/device**. No cross-device sync yet.
- Export/import JSON backups using the Settings page. **Backups can contain private finance, health and photos, and must never be committed to GitHub.**
- Changing code or deploying a new version should not erase IndexedDB. Clearing browser storage, changing browser or device, or uninstalling an app *may* erase local data. Always keep backups.
- GitHub repo privacy protects code visibility; the deployed Vercel site itself may be publicly accessible unless deployment protection is explicitly enabled.
- Browser/mobile offline behavior and installation still need real-device verification.

## Future sync

The records use stable IDs and updatedAt fields so a later authenticated backend could be added with conflict resolution. Sync is **not** implemented.

## Font and appearance

- Cairo is the primary UI font, loaded from Google Fonts when available, with system fallback offline.
- Dark mode is the default; toggle between dark and light in the header or Settings. Browser preference is saved in localStorage (`khotwa-theme`).
- Appearance preferences are separate from personal records stored in IndexedDB. Back up your personal records before deploying major updates.

## Spiritual habits, bedtime routine & smoking start time

- Spiritual habits now track morning and evening adhkar separately. Historical combined `adhkar` values remain stored and are never silently reassigned to both checkboxes.
- Bedtime routine has five simple starter steps, each optional, editable and saved by stable step ID for each selected date. You can add/rename/remove steps without deleting old records.
- Smoking setup records local **date and time** in `settings.smoking.quitAt`, retaining the date-only `start` field for older backups. Partial start-day logs are not used to estimate full-day savings or avoided cigarettes.
- Table Edit/Delete actions have consistent spacing. No storage migration and no automatic sharing.

## Smoking progress and sourced recovery milestones

- The 21-hour counter and health timeline read the user's locally stored `quitAt` timestamp. From `avg` cigarettes/day, the app shows *potential* avoided cigarettes and savings: `avg × elapsed hours / 24`, then multiplying by the configured per-cigarette cost. They are **theoretical, not verification of abstinence**. Daily logged actual results remain separate and missing days are never recorded as successful automatically.
- Evidence milestones are illustrative population-level ranges, not personalized health measurements. Links to NHS, CDC and WHO are shown within the interface. The timeline works offline; links to sources need Internet.
- Invalid or legacy date-only settings prompt the user to set an exact timestamp; no invented hour is used.

## Supabase personal cloud sync v1

- Supabase Auth plus append-only private table public.khatwa_events protected by Row Level Security. The browser uses a publishable public key, never a service-role key.
- Settings offers email/password signup and login. Email confirmation may require a matching allowed redirect URL in the Supabase Authentication URL configuration.
- Sync is opt-in and local IndexedDB still works offline. Initial upload requires explicit user confirmation; no personal records auto-upload before activation.
- When enabled, new saves and deletions queue in IndexedDB meta, sync online and pull cloud changes roughly every 45 seconds. Repeated edits on two devices use last cloud event wins; history is retained in the event log.
- Personal photos remain local only and are removed from cloud event payloads. No public storage bucket.
- Turn off syncing before restoring or clearing local records. Back up first. Auth refresh tokens stay on the device; use trusted browsers.
- Supabase Free may pause after inactivity; local data remains available.

## Account-first sign-in and step habit

- `/` opens the Khatwa login screen unless a valid saved Supabase session exists. Refresh tokens persist sign-in across browser restarts. A user can sign out manually.
- The browser caches each signed-in account's records in its own IndexedDB database (`khotwa_account_<uuid>`). Legacy anonymous records stay in the original database. On first connection, importing legacy data is an explicit choice, and declining the import does not delete that legacy database.
- On a fresh device with no anonymous records, authentication automatically starts cloud synchronization and restores the account's records. On subsequent visits, the saved session restores access; local cached records work offline after prior login. Records saved offline are queued for later upload.
- The habits page includes a manual `8,000 steps` daily tracker with progress and editing for a selected date. It does not access Apple Health or claim automatic step counting.
- Email signup still requires correct Supabase Auth Site URL and Redirect URLs configured for the deployed hostname. Email verification can be completed before signing in with the form.

## Global toast notifications

The previous single `.alert` element was replaced with a tiny, dependency-free `window.KhatwaToast` module (`toasts.js`) shared by all Khatwa screens. Use `KhatwaToast.success(message)`, `.error(message)`, `.warning(message)`, `.info(message)` or `.show(message,{type})`. User-facing messages are rendered as plain text, not HTML. Toasts have bounded stacking, sensible auto-dismiss durations, pause on hover/keyboard focus, accessible status/alert roles, close controls, touch swipe dismiss, RTL-aware position, dark/light theme, responsive placement above the mobile nav, and reduced-motion support. Destructive confirmations remain confirmation dialogs, not transient toasts.

## Quitting companion — live time and supportive logging

- Quitting duration is shown as **days, hours and minutes** calculated from `settings.smoking.quitAt` using the device clock, updated automatically every 10 seconds while the page is visible. No daily check-in is needed for the timer; check-ins remain **optional** documentation. Time elapsed is not proof of abstinence.
- Users can save up to 12 personal motivations, which are displayed at the top of the smoking page and again in the craving support dialog. These settings sync across devices through the existing account settings record.
- The optional craving support dialog suggests small, nonjudgmental coping strategies and makes clear cravings are not lapses. Only a user-confirmed event (cigarette actually smoked) is logged as `smoking-relapse` and restarts the clock at the confirmed new quit timestamp. The previous quit timestamp and relapse count are preserved in the record history; nothing is recorded when the user just feels an urge.
- Relapse events and account settings are stored in IndexedDB and sync via the existing Supabase event log, with no new credentials, APIs or backend migration.

### Motivations UI (v2)
- Previously saved reasons in \`settings.quitReasons\` remain untouched; there is **no data migration**.
- The first reason is a compact, sticky, two-line reminder at the top of the smoking module (avoids scrolling a tall nested list on mobile).
- Additional reasons appear as a responsive card collection. A one-line composer adds one reason at a time, with duplicate and length validation.
- "إدارة الأسباب" lets users edit each reason inline, reorder with accessible up/down buttons (the first reason becomes the featured reminder) and delete with a visible two-step confirmation. All individual edits sync through the existing settings service.
- The urge support dialog continues to show **all** reasons, not just the featured reason.

## Nutrition v3 — broader food discovery and honest product information

- Expanded local generic food examples, including familiar Egyptian ingredients and normalized Arabic spelling/search synonyms. **Reference values are only approximate** and vary with preparation, sauce, edible portion and brand.
- Users can save a **custom food** by copying the nutrition label per 100 grams or another explicitly entered serving weight. Values are normalized per 100 grams and saved to the existing per-user offline IndexedDB / Supabase record sync as `food-custom`; never upload a photo or private information to a third party. Missing macros remain unknown, not zero.
- **Recent foods** make previously logged products easy to select again.
- **Barcode lookup** uses the public Open Food Facts v2 product endpoint and the number typed by the user. It may return a partially documented product (missing nutrients remain `null`), or no product if absent in the community database.
- Barcode photo upload tries browser-native `BarcodeDetector` when supported. The image is scanned **on-device only**, and only a decoded barcode number is sent to Open Food Facts; if unavailable, there is an honest manual-entry fallback. iOS Safari support varies. **It does not estimate the calories of plated meals from a photo**, which would require secure server-side image recognition and user review.
- For photos of complete meals, never present an unverified visual calorie estimate as fact: food ingredients, hidden oils, preparation and serving weight cannot be determined reliably from appearance alone.
