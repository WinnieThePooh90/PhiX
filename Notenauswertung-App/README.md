# PhiX — Frontend (React + Vite)

React-Oberfläche der Notenauswertung PhiX. Wird im **Docker-Stack** (nginx) und in der **Electron-Desktop-App** eingebunden — kein eigenständiger Web-App-Release.

## Lizenz

Apache License 2.0 — siehe [LICENSE](../LICENSE) im Repository-Root.

## Skripte

- `npm run dev` — Vite-Entwicklungsserver (für Electron-Desktop-Entwicklung)
- `npm run build` — Produktions-Build (intern für Docker-Image und Desktop-Packaging)
- `npm run sync-version` — Build-Nummer aus `docs/APP_VERSION.md`
- `npm run sync-license` — Lizenztext in die App einbinden (Quelle: `LICENSE` im Repo-Root, gespiegelt nach `./LICENSE` für Docker)
- `npm run extract-dependency-licenses` — Drittanbieter-Lizenztexte aus `node_modules`
