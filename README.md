<div align="center">

<img src="ui/assets/logo.svg" alt="Brise" width="96">

# Brise

**Wetter für Deutschland — mit echten DWD-Daten.**

Eine moderne, schnelle Wetter-App für den Linux-Desktop. Kein API-Key, kein Konto, kein Tracking und keine erfundenen Funktionen.

![Linux](https://img.shields.io/badge/Linux-x86__64-7d7d7d?style=flat-square&logo=linux&logoColor=white)
![Wayland](https://img.shields.io/badge/Wayland-optimiert-7d7d7d?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2-24c8b8?style=flat-square)
![Rust](https://img.shields.io/badge/Rust-Backend-dea584?style=flat-square)
![Lizenz](https://img.shields.io/badge/Lizenz-MIT-4c9118?style=flat-square)

</div>

## Über Brise

Brise zeigt amtliche Beobachtungen und Vorhersagen des **Deutschen Wetterdienstes**, aufbereitet über die offene Bright-Sky-Schnittstelle. Das Backend ist in Rust geschrieben, die Oberfläche läuft in WebKitGTK — dadurch bleibt die App leicht, schnell und auf Wayland scharf.

Die Ortsuche findet **jeden Ort in Deutschland**, auch kleine Gemeinden und Stadtteile. Gefundene Orte werden dauerhaft gespeichert und lassen sich als Favoriten anlegen.

## Funktionen

- **Aktuelles Wetter** für jeden deutschen Ort: Temperatur, Gefühlt wie, Wind, Niederschlag, Luftfeuchte, Luftdruck und Sichtweite.
- **Stunden- und Tagesvorhersage** mit echten Messwerten und übersichtlichen Diagrammen.
- **Sonne & Mond**: Sonnenstand, Tageslicht und eine grafische Mondphase mit Beleuchtungsgrad; nachts mit Sternenhimmel.
- **Amtliche Warnungen** mit Gültigkeitszeitraum, Schweregrad und Handlungshinweisen.
- **Regenradar** mit 31 animierten DWD-Radarbildern, Zeitsteuerung und 90-Minuten-Prognose.
- **Deutschlandkarte** mit Städtevergleich, Ranking und echten Bundesländergrenzen.
- **Einrichtung beim ersten Start**: Darstellung wählen und den eigenen Startort aus ganz Deutschland suchen.
- **Suche & Favoriten**, persistente Einstellungen, Einheiten und zwei Farbschemata (*Mitternacht* / *Tageslicht*).
- **Offline-Fallback**: zuletzt geladene Daten bleiben mit klar gekennzeichnetem Cache-Status nutzbar.
- **Skaliert mit der Arbeitsfläche**: auch als kleines, geteiltes Fenster auf Hyprland bleibt die Oberfläche übersichtlich.
- **Wayland-optimiert**: native GTK/Wayland-Darstellung, eigene Fensterdekoration und ein Launcher für Hyprland.

## Installation

### Schnell und ohne sudo

Das Repository enthält ein vorgebautes Linux-Binary in `dist/`:

```bash
git clone https://github.com/fg1211/brise.git
cd brise
./install.sh                 # nach ~/.local
```

Das installiert `brise`, `brise-launch`, die Desktop-Datei und die Icons. Danach ist Brise im Anwendungsmenü verfügbar oder direkt startbar:

```bash
brise-launch
```

### Weitere Installationsziele

```bash
./install.sh /usr/local             # systemweit (root nötig)
PREFIX=/opt/brise ./install.sh      # eigener Pfad
```

Falls kein vorgebautes Binary vorhanden ist, baut `install.sh` automatisch aus dem Quellcode.

### Portable Variante

```bash
tar -xzf dist/brise-1.0.4-x86_64.tar.gz
cd dist && ./install.sh
```

### Arch Linux

Mit yay:

```bash
yay -S brise
```

Das Paket baut Brise aus den Quellen von `v1.0.4` und installiert Binary, Launcher, Desktop-Datei und Icons nach `/usr`. Der Launcher öffnet das Fenster geteilt auf dem Monitor unter dem Mauszeiger; mit `BRISE_MONITOR=DP-4 brise-launch` lässt sich ein anderer Monitor erzwingen.

Noch nicht im AUR? Unter [`aur/PKGBUILD`](aur/PKGBUILD) liegt ein Paketrezept – damit baut `makepkg -si` Brise selbst.

### Aus dem Quellcode bauen

Voraussetzungen: Linux x86_64, Rust ≥ 1.82, GTK3 und WebKit2GTK 4.1.

```bash
./scripts/build.sh                  # Release-Binary + portables Archiv
# oder nur das Binary:
cd src-tauri && cargo build --release
```

## Bedienung

| Taste | Aktion |
| --- | --- |
| `Strg` + `K` | Suche nach Orten und Befehlen öffnen |
| `Strg` + `,` | Einstellungen öffnen |
| `Strg` + `R` | Wetterdaten neu laden |
| `1` / `2` / `3` | Wetter / Radar / Deutschlandkarte |
| `Esc` | Dialog schließen |

In der Suche lassen sich deutsche Orte beliebig eingeben — auch Orte, die nicht in der mitgelieferten Städteauswahl sind. Mit dem Stern neben einem Treffer wird er dauerhaft zu den Favoriten hinzugefügt.

## Monitor-Verhalten auf Hyprland

`brise-launch` registriert vor dem Start eine Fensterregel, die das Fenster **geteilt (`tile=true`) auf dem Monitor unter dem Mauszeiger** öffnet. Die genaue Position innerhalb des Layouts bestimmt Hyprland. Ein Monitor kann auch ausdrücklich vorgegeben werden:

```bash
BRISE_MONITOR=DP-1 brise-launch
```

Unter X11 positioniert die App sich selbst; auf anderen Wayland-Compositoren entscheidet der Compositor.

## Projektstruktur

```text
.
├── install.sh              # Installation ohne sudo
├── scripts/
│   ├── build.sh            # Release-Build + portables Archiv
│   └── generate_geo.py     # Deutschland-Geometrie aus Natural Earth
├── src-tauri/              # Rust-Backend, Tauri-Konfiguration, Icons
└── ui/                     # HTML, CSS, JavaScript, Schriften
```

## Datenquellen & Danksagungen

- **Deutscher Wetterdienst (DWD)** — Open Data, vermittelt über [Bright Sky](https://api.brightsky.dev/) (keine Registrierung nötig).
- **Open-Meteo Geocoding** mit **GeoNames** — Namensauflösung für die Ortsuche; Wetter, Warnungen und Radar bleiben ausschließlich DWD-Daten.
- **Natural Earth** — Geodaten für die Deutschlandkarte (gemeinfrei).
- **Inter** und **Space Grotesk** — Schriften unter SIL Open Font License.

Brise ist ein unabhängiges Projekt und ist **nicht** mit dem Deutschen Wetterdienst verbunden. Details zu Lizenzen und Namensnennungen stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Mitmachen

Issues und Pull Requests sind willkommen. Für Änderungen am Backend `cargo check` in `src-tauri/` ausführen; für die Oberfläche genügt ein Bearbeiten der Dateien in `ui/`. Ein kompletter Build läuft mit `./scripts/build.sh`.

## Lizenz

Brise steht unter der [MIT-Lizenz](LICENSE).
