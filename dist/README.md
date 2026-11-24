# Brise — Wetter für Deutschland

Eine moderne, schnelle Wetter-App für den Linux-Desktop. Brise nutzt **echte,
amtliche DWD-Daten** — ohne API-Key, ohne Werbung, ohne Fake-Funktionen.

## Funktionen

- **Aktuelles Wetter für jede deutsche Stadt** – die Ortsuche findet auch
  kleine Orte, Gemeinden und Stadtteile und speichert sie dauerhaft als
  Favoriten (Temperatur, Gefühlt wie, Wind, Niederschlag, Luftfeuchte,
  Luftdruck, Sichtweite).
- **Stunden- und Tagesvorhersage** mit echten Messwerten und Diagrammen.
- **Amtliche DWD-Warnungen** (Frost, Hitze, Sturm, Gewitter, Regen …) inklusive
  Gültigkeitszeitraum und Schweregrad.
- **Regenradar** mit 31 animierten DWD-Radarframes, Zeitsteuerung und
  Niederschlagsprognose für den nächsten Standort.
- **Deutschlandkarte** mit Städtevergleich, Ranking und Highlights – auf Basis
  echter GeoJSON-Grenzen.
- **Suche & Favoriten**, persistente Einstellungen, Einheiten und Themen
  (Mitternacht / Tageslicht).
- **Offline-Fallback**: zuletzt geladene Daten bleiben mit Cache-Status nutzbar.
- **Wayland-optimiert**: natives GTK/Wayland-Rendering, eigene Fensterdekoration
  und ein Start auf dem Zweitmonitor, damit der Hauptmonitor ungestört bleibt.

## Datenquellen & Danksagungen

- **Deutscher Wetterdienst (DWD)** — Open Data, abgerufen über
  [Bright Sky](https://api.brightsky.dev/) (keine Registrierung nötig).
- **Open-Meteo Geocoding** mit **GeoNames** — Ortsuche für alle deutschen
  Orte (nur Namensauflösung; Wetterdaten bleiben ausschließlich DWD).
- **Natural Earth** — Geodaten für die Deutschlandkarte (public domain).
- **Inter** und **Space Grotesk** — Schriften (SIL Open Font License).

Brise ist ein unabhängiges Projekt und ist nicht mit dem DWD verbunden.

## Installation

```bash
./install.sh                 # nach ~/.local
./install.sh /usr/local      # systemweit (root nötig)
```

Danach „Brise“ im Anwendungsmenü starten oder direkt:

```bash
brise-launch
```

### Monitor-Verhalten

Auf Hyprland registriert `brise-launch` vor dem Start eine Fensterregel, die das
Fenster automatisch auf **DP-2** legt. Der Hauptmonitor (DP-3) bleibt damit frei.
Über die Umgebungsvariable `BRISE_MONITOR` lässt sich ein anderer Monitor wählen:

```bash
BRISE_MONITOR=DP-1 brise-launch
```

Auf X11 übernimmt die App die Positionierung selbst; auf anderen Wayland-
Compositoren entscheidet der Compositor über die Platzierung.

## Bau aus dem Quellcode

Voraussetzungen: Rust ≥ 1.82, Tauri 2, GTK3, WebKit2GTK 4.1.

```bash
cd src-tauri
cargo build --release
```

Die ausführbare Datei liegt anschließend unter
`src-tauri/target/release/brise`.

## Lizenz

Brise steht unter der MIT-Lizenz. Die Datenquellen unterliegen ihren jeweiligen
Lizenzen (siehe oben).
