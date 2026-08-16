#!/usr/bin/env bash
# Entfernt Build-Artefakte (gleichwertig zu clean-build.bat).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "Entferne node_modules, dist, dist-pack, generierte Prisma-Clients …"
echo

rm_remove() {
  if [[ -e "$1" ]]; then
    rm -rf "$1"
  fi
}

rm_remove "backend/node_modules"
rm_remove "backend/generated"
rm_remove "backend/.prisma-generate-dummy.sqlite"
rm_remove "backend/ci-smoke.sqlite"

rm_remove "Notenauswertung-App/node_modules"
rm_remove "Notenauswertung-App/dist"
rm_remove "Notenauswertung-App/.vite"

rm_remove "desktop/node_modules"
rm_remove "desktop/dist-pack"

echo
echo "Fertig. Projektordner enthält nur Quellcode und Lockfiles."
echo "Vor neuem Build: backend + Notenauswertung-App + desktop jeweils npm install, dann desktop npm run dist (bzw. npm run dist:dir unter Linux/macOS)."
