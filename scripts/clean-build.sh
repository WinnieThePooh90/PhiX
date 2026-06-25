#!/usr/bin/env bash
# Entfernt Build-Artefakte und node_modules im PhiX-Repo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Entferne Build-Artefakte unter $ROOT …"

rm -rf \
  backend/node_modules \
  backend/generated \
  backend/.prisma-generate-dummy.sqlite \
  backend/ci-smoke.sqlite \
  Notenauswertung-App/node_modules \
  Notenauswertung-App/dist \
  Notenauswertung-App/.vite \
  desktop/node_modules \
  desktop/dist-pack

echo "Fertig."
