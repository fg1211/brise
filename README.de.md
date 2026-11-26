<div align="center">

<img src="ui/assets/logo.svg" alt="Brise" width="96">

# Brise

**Wetter, wo du bist — mit echten, kostenlosen Daten.**

Eine moderne, schnelle Wetter-App für den Linux-Desktop. Kein API-Key, kein Konto, kein Tracking und keine erfundenen Funktionen.

[🇬🇧 English version](README.md)

![Linux](https://img.shields.io/badge/Linux-x86__64-7d7d7d?style=flat-square&logo=linux&logoColor=white)
![Wayland](https://img.shields.io/badge/Wayland-optimiert-7d7d7d?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2-24c8b8?style=flat-square)
![Rust](https://img.shields.io/badge/Rust-Backend-dea584?style=flat-square)
![Lizenz](https://img.shields.io/badge/Lizenz-MIT-4c9118?style=flat-square)

</div>

## Über Brise

Brise zeigt Beobachtungen und Vorhersagen des **Deutschen Wetterdienstes** über die offene Bright-Sky-Schnittstelle – und Wetter für den Rest der Welt von der kostenlosen **Open-Meteo**-API. Für Deutschland kannst du die Quelle selbst wählen. Das Backend ist in Rust geschrieben, die Oberfläche läuft in WebKitGTK – dadurch bleibt die App leicht, schnell und auf Wayland scharf.

Die Ortsuche findet **jeden Ort im gewählten Land**, auch kleine Gemeinden und Stadtteile. Gefundene Orte werden dauerhaft gespeichert und lassen sich als Favoriten anlegen. Die Oberfläche spricht Deutsch, Englisch und Niederländisch – unabhängig vom Wetter-Land.

## Funktionen

- **Aktuelles Wetter** für jeden Ort: Temperatur, Gefühlt wie, Wind, Niederschlag, Luftfeuchte, Luftdruck und Sichtweite.
- **Stunden- und Tagesvorhersage** mit echten Messwerten und übersichtlichen Diagrammen.
- **Sonne & Mond**: Sonnenstand, Tageslicht und eine grafische Mondphase mit Beleuchtungsgrad; nachts mit Sternenhimmel.
- **Amtliche Warnungen** mit Gültigkeitszeitraum, Schweregrad und Handlungshinweisen (DWD, Deutschland).
- **Regenradar** mit 31 animierten DWD-Radarbildern, Zeitsteuerung und 90-Minuten-Prognose (Deutschland mit DWD).
- **Deutschlandkarte** mit Städtevergleich, Ranking und echten Bundesländergrenzen.
- **Einrichtung beim ersten Start**: Darstellung, Sprache, Land und eigenen Startort wählen.
- **Suche & Favoriten**, persistente Einstellungen, Einheiten, fünf Farbwelten (*Mitternacht*, *Tageslicht*, *Abendrot*, *Ozean*, *Nordwald*) und sechs Akzentfarben.
- **Überarbeitete Oberfläche**: mehr lokale Icons, menschlichere Texte und ruhige Animationen – weiterhin flüssig beim Scrollen.
- **Grafik-Schalter**: Hardwarebeschleunigung und VSync lassen sich in den Einstellungen umschalten.
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
tar -xzf dist/brise-1.1.0-x86_64.tar.gz
cd dist && ./install.sh
```

### Arch Linux

Mit yay:

```bash
yay -S brise
```

Das Paket baut Brise aus den Quellen von `v1.1.0` und installiert Binary, Launcher, Desktop-Datei und Icons nach `/usr`. Der Launcher öffnet das Fenster geteilt auf dem Monitor unter dem Mauszeiger; mit `BRISE_MONITOR=DP-4 brise-launch` lässt sich ein anderer Monitor erzwingen.

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

In den Einstellungen wählst du das Suchland, die Sprache der Oberfläche (Deutsch, Englisch oder Niederländisch) und – für Deutschland – ob das Wetter von DWD oder Open-Meteo kommt. Alle anderen Länder nutzen Open-Meteo. Radar und amtliche Warnungen bleiben DWD-only.

In der Suche lassen sich Orte im gewählten Land beliebig eingeben – auch Orte, die nicht in der mitgelieferten Städteauswahl sind. Mit dem Stern neben einem Treffer wird er dauerhaft zu den Favoriten hinzugefügt.

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
- **Open-Meteo** — kostenlose Wettervorhersagen ohne API-Key und Konto, für Deutschland (optional) und alle anderen Länder.
- **Open-Meteo Geocoding** mit **GeoNames** — Namensauflösung für Orte in allen Ländern.
- **Natural Earth** — Geodaten für die Deutschlandkarte (gemeinfrei).
- **Inter** und **Space Grotesk** — Schriften unter SIL Open Font License.

Brise ist ein unabhängiges Projekt und ist **nicht** mit dem Deutschen Wetterdienst verbunden. Details zu Lizenzen und Namensnennungen stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Mitmachen

Issues und Pull Requests sind willkommen. Für Änderungen am Backend `cargo check` in `src-tauri/` ausführen; für die Oberfläche genügt ein Bearbeiten der Dateien in `ui/`. Ein kompletter Build läuft mit `./scripts/build.sh`.

## Lizenz

Brise steht unter der [MIT-Lizenz](LICENSE).
