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
