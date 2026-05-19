#!/usr/bin/env bash
# Baut release/PhiX-Windows-x64.zip auf Linux/macOS (laedt Windows-Runtimes herunter).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_VERSION="${NODE_VERSION:-22.16.0}"
PG_VERSION="${PG_VERSION:-16.14-1}"
PG_MAJOR_MINOR="${PG_VERSION%%-*}"
RELEASE_NAME="PhiX-Windows-x64"
STAGING="$ROOT/release/$RELEASE_NAME"
CACHE="$ROOT/release/_cache"
ZIP="$ROOT/release/$RELEASE_NAME.zip"

step() { echo ""; echo "==> $*"; }

rm -rf "$STAGING"
mkdir -p "$STAGING/runtime" "$CACHE" "$STAGING/app/frontend-dist"

step "Runtimes laden"
NODE_ZIP="$CACHE/node-v${NODE_VERSION}-win-x64.zip"
PG_ZIP="$CACHE/postgresql-${PG_VERSION}-windows-x64-binaries.zip"
if [[ ! -f "$NODE_ZIP" ]]; then
  curl -fsSL -o "$NODE_ZIP" "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip"
fi
if [[ ! -f "$PG_ZIP" ]]; then
  if [[ -n "${POSTGRES_ZIP_PATH:-}" ]]; then
    cp -f "$POSTGRES_ZIP_PATH" "$PG_ZIP"
  else
    PG_URL="$(python3 "$(dirname "$0")/resolve-postgres-windows-url.py" "$PG_MAJOR_MINOR")"
    echo "  Lade herunter (EDB): PostgreSQL ${PG_VERSION}"
    echo "  URL: $PG_URL"
    curl -fsSL -A "PhiX-Build/1.0" -o "$PG_ZIP" "$PG_URL"
  fi
fi

step "Runtimes entpacken"
unzip -q -o "$NODE_ZIP" -d "$STAGING/runtime/_node"
mv "$STAGING/runtime/_node"/node-v* "$STAGING/runtime/node"
rmdir "$STAGING/runtime/_node" 2>/dev/null || true

unzip -q -o "$PG_ZIP" -d "$STAGING/runtime/_pg"
if [[ -d "$STAGING/runtime/_pg/pgsql" ]]; then
  mv "$STAGING/runtime/_pg/pgsql" "$STAGING/runtime/postgresql"
else
  mv "$STAGING/runtime/_pg"/* "$STAGING/runtime/postgresql"
fi
rm -rf "$STAGING/runtime/_pg"

step "Frontend bauen"
cd "$ROOT/Notenauswertung-App"
unset NODE_ENV
if ! npm ci; then
  echo "  Lock-Datei veraltet – npm install ..."
  npm install --no-fund --no-audit
fi
if [[ ! -d node_modules/react-router-dom ]]; then
  echo "FEHLER: react-router-dom fehlt nach npm install"
  exit 1
fi
npm run build
cp -a dist/. "$STAGING/app/frontend-dist/"

step "Backend vorbereiten"
mkdir -p "$STAGING/app/backend"
rsync -a --exclude node_modules --exclude .env "$ROOT/backend/" "$STAGING/app/backend/" 2>/dev/null || {
  (cd "$ROOT/backend" && tar cf - --exclude node_modules --exclude .env .) | (cd "$STAGING/app/backend" && tar xf -)
}
export PATH="$STAGING/runtime/node:$PATH"
cd "$STAGING/app/backend"
unset NODE_ENV
if ! npm ci; then
  echo "  Lock-Datei veraltet – npm install ..."
  npm install --no-fund --no-audit
fi
if [[ ! -d node_modules/dotenv ]]; then
  echo "FEHLER: node_modules/dotenv fehlt im Release-Backend"
  exit 1
fi
./node_modules/.bin/prisma generate

step "Portable Starter"
cp "$ROOT/portable/Start-PhiX.ps1" "$ROOT/portable/Initialize-Postgres.ps1" \
   "$ROOT/portable/PhiX.cmd" "$ROOT/portable/phix-config.json" "$STAGING/"

step "ZIP"
rm -f "$ZIP"
(cd "$ROOT/release" && zip -rq "$(basename "$ZIP")" "$RELEASE_NAME")

SIZE=$(du -h "$ZIP" | cut -f1)
echo ""
echo "Fertig: $ZIP ($SIZE)"
echo "Endanwender: ZIP entpacken, PhiX.cmd starten."
