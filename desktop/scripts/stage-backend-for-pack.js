/**
 * Backend für electron-builder außerhalb von Dropbox/Sync stagen:
 * Quellcode kopieren, dort npm ci, Prisma CLI verifizieren.
 * Marker: desktop/.pack-backend-from.json → Pfad für extraResources.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const desktopRoot = path.join(__dirname, '..');
const repoBackend = path.join(desktopRoot, '..', 'backend');
const isWin = process.platform === 'win32';
const local = process.env.LOCALAPPDATA;
const stagingRoot =
  process.env.PHIX_PACK_BACKEND_DIR ||
  (isWin && local
    ? path.join(local, 'PhiX', 'pack-backend')
    : path.join(os.homedir(), '.cache', 'phix', 'pack-backend'));
const markerFile = path.join(desktopRoot, '.pack-backend-from.json');

const SKIP_TOP = new Set(['node_modules', '.env', 'phix.db', '.git']);

function shouldSkip(rel) {
  if (!rel || rel === '.') return false;
  const top = rel.split(path.sep)[0];
  if (SKIP_TOP.has(top)) return true;
  if (rel.includes(`${path.sep}node_modules${path.sep}`) || rel.startsWith(`node_modules${path.sep}`)) {
    return true;
  }
  if (rel.endsWith('.env') || rel === '.env') return true;
  return false;
}

function copyBackendTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const rel = name;
    if (shouldSkip(rel)) continue;
    const destPath = path.join(dest, name);
    const st = fs.statSync(srcPath);
    if (st.isDirectory()) {
      copyBackendTree(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function run(cmd, cwd) {
  console.log(`[stage-backend] ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env, shell: isWin });
}

if (!fs.existsSync(path.join(repoBackend, 'package.json'))) {
  console.error('[stage-backend] Backend fehlt:', repoBackend);
  process.exit(1);
}

console.log('[stage-backend] Staging-Ziel:', stagingRoot);
if (fs.existsSync(stagingRoot)) {
  fs.rmSync(stagingRoot, { recursive: true, force: true });
}
fs.mkdirSync(stagingRoot, { recursive: true });

copyBackendTree(repoBackend, stagingRoot);

const npmCmd = isWin ? 'npm.cmd' : 'npm';
console.log('[stage-backend] npm ci im Staging (frisches node_modules) …');
run(`${npmCmd} ci`, stagingRoot);

const nodeModules = path.join(stagingRoot, 'node_modules');
const phixDeps = path.join(stagingRoot, 'phix_deps');

if (!fs.existsSync(nodeModules)) {
  console.error('[stage-backend] node_modules fehlt nach npm ci:', nodeModules);
  process.exit(1);
}

console.log('[stage-backend] node_modules → phix_deps (electron-builder kopiert kein "node_modules") …');
if (fs.existsSync(phixDeps)) {
  fs.rmSync(phixDeps, { recursive: true, force: true });
}
fs.renameSync(nodeModules, phixDeps);

const prismaCli = path.join(phixDeps, 'prisma', 'build', 'index.js');
const sqliteClient = path.join(stagingRoot, 'generated', 'prisma-sqlite', 'index.js');

if (!fs.existsSync(prismaCli)) {
  console.error('[stage-backend] Prisma CLI fehlt nach npm ci:', prismaCli);
  process.exit(1);
}
if (!fs.existsSync(sqliteClient)) {
  console.error(
    '[stage-backend] SQLite-Prisma-Client fehlt. Im Projekt-Backend ausführen:\n' +
      '  cd backend && npm run prisma:generate-all\n' +
      '  danach erneut npm run dist',
  );
  process.exit(1);
}

const prismaSize = fs.statSync(prismaCli).size;
if (prismaSize < 1000) {
  console.error('[stage-backend] Prisma CLI-Datei verdächtig klein (' + prismaSize + ' Bytes):', prismaCli);
  process.exit(1);
}

fs.writeFileSync(
  markerFile,
  JSON.stringify({ path: stagingRoot, createdAt: new Date().toISOString() }, null, 2),
  'utf8',
);

console.log('[stage-backend] OK — Prisma CLI:', prismaCli, '(' + prismaSize + ' Bytes)');
console.log('[stage-backend] Marker:', markerFile);
