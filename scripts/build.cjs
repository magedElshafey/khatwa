const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'public');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const file of ['index.html', 'styles.css', 'roadmap-data.js', 'toasts.js', 'experience.js', 'nutrition.js', 'smoking-insights.js', 'cloud-sync.js', 'sw.js', 'manifest.webmanifest']) {
  fs.copyFileSync(path.join(root, file), path.join(target, file));
}
fs.copyFileSync(path.join(root, 'dist', 'app.js'), path.join(target, 'app.js'));
fs.cpSync(path.join(root, 'assets'), path.join(target, 'assets'), { recursive: true });
console.log('Static PWA output prepared in public/');
