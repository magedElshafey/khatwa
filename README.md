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
