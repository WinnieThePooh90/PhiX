# PhiX – Build-Stand

Von der Projektregel `.cursor/rules/version-per-prompt.mdc` gepflegt (Agent-Modus).

| Feld | Wert |
|------|------|
| **Build** | `212` |
| **Letzte Änderung** | `2026-06-07` |

Maschinenlesbar (eine Zeile pro Schlüssel):

```
PHIX_BUILD=212
PHIX_LETZTE_AENDERUNG=2026-06-07
```

**Build-Nummer:** eine einzige Zahl (**`PHIX_BUILD`**, ohne Punkt/Komma in dieser Datei).

**npm / electron-builder:** in allen drei `package.json` steht **`"<PHIX_BUILD>.0.0"`** (z. B. Build `6` → `"6.0.0"`), weil **electron-builder** kein reines `"6"` akzeptiert. Die sichtbare Versionszahl ist weiterhin die **erste** Komponente.
