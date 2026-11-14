// Run once:  node tools/patch-package.cjs
// Prepares package.json so each system bundles only its own FFmpeg (Windows keeps working as before).
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
const b = (pkg.build = pkg.build || {});
const ffmpeg = (dir) => [{ from: dir, to: 'ffmpeg', filter: ['**/*'] }];

delete b.extraResources; // was shared by every system
b.win = { ...(b.win || {}), extraResources: ffmpeg('resources/ffmpeg') };
b.mac = {
  ...(b.mac || {}),
  target: [{ target: 'dmg', arch: ['arm64'] }],
  icon: 'public/logo.png',
  category: 'public.app-category.utilities',
  identity: '-',
  hardenedRuntime: false,
  gatekeeperAssess: false,
  artifactName: 'ConvertFlow-mac-${arch}.${ext}',
  extraResources: ffmpeg('resources/ffmpeg-mac'),
};
b.linux = {
  ...(b.linux || {}),
  target: [{ target: 'AppImage', arch: ['x64'] }],
  icon: 'public/logo.png',
  category: 'Utility',
  artifactName: 'ConvertFlow-linux-${arch}.${ext}',
  extraResources: ffmpeg('resources/ffmpeg-linux'),
};

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json updated for Windows, macOS and Linux builds.');
