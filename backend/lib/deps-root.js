const fs = require('fs');
const path = require('path');

/**
 * Abhängigkeitsordner im gepackten Desktop-Backend: electron-builder kopiert
 * kein Verzeichnis namens "node_modules" in extraResources → "phix_deps".
 * Prisma/ESM erwarten zur Laufzeit einen Ordner "node_modules" → Junction/Symlink.
 */
function resolveDepsRoot(backendRoot) {
  const nodeModules = path.join(backendRoot, 'node_modules');
  if (fs.existsSync(nodeModules)) {
    return nodeModules;
  }
  const phixDeps = path.join(backendRoot, 'phix_deps');
  if (fs.existsSync(phixDeps)) {
    return phixDeps;
  }
  return nodeModules;
}

function resolvePrismaCli(backendRoot) {
  return path.join(resolveDepsRoot(backendRoot), 'prisma', 'build', 'index.js');
}

function isLinkToPhixDeps(backendRoot, nodeModules, phixDeps) {
  try {
    const st = fs.lstatSync(nodeModules);
    if (!st.isSymbolicLink()) return false;
    const target = fs.readlinkSync(nodeModules);
    return path.resolve(backendRoot, target) === path.resolve(phixDeps);
  } catch {
    return false;
  }
}

/**
 * @param {string} backendRoot
 * @returns {{ ok: boolean, error?: Error }}
 */
function ensureBackendModuleLink(backendRoot) {
  const phixDeps = path.join(backendRoot, 'phix_deps');
  const nodeModules = path.join(backendRoot, 'node_modules');

  if (!fs.existsSync(phixDeps)) {
    return { ok: true };
  }

  if (fs.existsSync(nodeModules)) {
    if (isLinkToPhixDeps(backendRoot, nodeModules, phixDeps)) {
      return { ok: true };
    }
    try {
      const st = fs.lstatSync(nodeModules);
      if (!st.isSymbolicLink() && fs.existsSync(path.join(nodeModules, 'prisma', 'build', 'index.js'))) {
        return { ok: true };
      }
    } catch {
      /* weiter mit Junction */
    }
  } else {
    try {
      const linkType = process.platform === 'win32' ? 'junction' : 'dir';
      fs.symlinkSync(phixDeps, nodeModules, linkType);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  try {
    fs.rmSync(nodeModules, { recursive: true, force: true });
  } catch (err) {
    return { ok: false, error: err };
  }

  try {
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(phixDeps, nodeModules, linkType);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err };
  }
}

module.exports = { resolveDepsRoot, resolvePrismaCli, ensureBackendModuleLink };
