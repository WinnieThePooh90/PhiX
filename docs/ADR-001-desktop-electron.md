# ADR-001: Desktop-Hülle mit Electron

## Status

Akzeptiert (2026-05-20)

## Kontext

Die Web-App soll parallel als **Desktop-Standalone** laufen (lokales Fenster, später SQLite).  
Dafür braucht es eine dünne „Shell“, die das gebündelte oder lokale Backend startet und die UI anzeigt.

## Entscheidung

Wir setzen auf **Electron** (Main-Prozess: Node.js, Renderer: Chromium).

## Begründung

| Kriterium | Electron | Tauri (Kurz) |
|-----------|----------|--------------|
| Team / Ökosystem | Groß, viele Beispiele für „lokaler Server + Web-UI“ | Kleiner, Rust-Toolchain nötig |
| Anbindung an bestehendes **Node-Backend** | Kind-Prozess `node server.js` ist trivial | möglich, aber andere Runtime |
| Windows-Build / Signing | Üblich dokumentiert | ebenfalls möglich, anderer Pfad |
| Paketgröße | Größer (Chromium) | Kleiner |

**Konsequenz:** Akzeptierte größere Installer-Größe zugunsten schnellerer Integration und eines einheitlichen JS-Stacks mit dem bestehenden Backend.

## Konsequenzen

- Desktop-Code lebt unter `desktop/` (Main-Prozess, Packaging).
- Renderer bleibt das **bestehende React-Frontend**; keine UI-Duplikation.
- Tauri bleibt für spätere Re-Evaluierung möglich (ADR superseded), ist aber **nicht** Ziel der ersten Umsetzung.

## Referenzen

- `desktop/README.md`
- `docs/BUILD_VERSIONEN.md`
