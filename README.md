<div align="center">

<img src="ui/assets/logo.svg" alt="Brise" width="96">

# Brise

**Weather wherever you are — with real, free data.**

A modern, fast weather app for the Linux desktop. No API key, no account, no tracking and no made-up features.

[🇩🇪 Deutsche Fassung](README.de.md)

![Linux](https://img.shields.io/badge/Linux-x86__64-7d7d7d?style=flat-square&logo=linux&logoColor=white)
![Wayland](https://img.shields.io/badge/Wayland-optimized-7d7d7d?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-2-24c8b8?style=flat-square)
![Rust](https://img.shields.io/badge/Rust-backend-dea584?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-4c9118?style=flat-square)

</div>

## About Brise

Brise shows observations and forecasts from the **German Weather Service (DWD)** via the open Bright Sky API, and weather for the rest of the world from the free **Open-Meteo** API. For Germany you can choose your provider yourself. The backend is written in Rust and the interface runs in WebKitGTK — light, fast and sharp on Wayland.

The place search is **worldwide**: it finds towns, municipalities and districts in every country through the free Open-Meteo geocoding API, without an API key or account. Found places are saved permanently and can be added to your favourites. The interface speaks German, English and Dutch — independently of the country you are looking at.

## Features

- **Current weather** for any place: temperature, feels like, wind, precipitation, humidity, pressure and visibility.
- **Hourly and daily forecasts** with real measurements and clear charts.
- **Sun & moon**: sun position, daylight and a graphical moon phase with illumination; stars at night.
- **Official warnings** with validity, severity and advice (DWD, Germany).
- **Rain radar** with 31 animated DWD radar images, a timeline and a 90-minute forecast (Germany with DWD).
- **Map of Germany** with city comparison, rankings and real state borders.
- **First-run setup**: pick your look, language, country and home place.
- **Search & favourites**, persistent settings, units, five colour themes (*Midnight*, *Daylight*, *Afterglow*, *Ocean*, *Northern Forest*) and six accent colours.
- **Modern interface**: more local icons, human wording and calm animations — still smooth while scrolling.
- **Graphics controls**: hardware acceleration and VSync can be switched in the settings.
- **180 Hz scrolling**: on NVIDIA/Wayland a small vblank shim and monitor-paced frame timings keep WebKit scrolling at the display's refresh rate instead of a fixed 60 fps — with the GPU still enabled. See [High-refresh scrolling](#high-refresh-scrolling-180-hz).
- **Offline fallback**: the last loaded data stays usable with a clearly marked cache status.
- **Scales with your workspace**: stays readable as a small tiled window on Hyprland.
- **Wayland optimized**: native GTK/Wayland rendering, custom window decorations and a launcher for Hyprland.

## Installation

### Quick, without sudo

The repository contains a prebuilt Linux binary in `dist/`:

```bash
git clone https://github.com/fg1211/brise.git
cd brise
./install.sh                 # installs into ~/.local
```

This installs `brise`, `brise-launch`, the vblank shim, the desktop file and the icons. Brise then appears in your application menu, or you can start it directly:

```bash
brise-launch
```

### Other install targets

```bash
./install.sh /usr/local             # system-wide (needs root)
PREFIX=/opt/brise ./install.sh      # custom prefix
```

If no prebuilt binary is present, `install.sh` builds from source automatically.

### Portable archive

```bash
mkdir brise
tar -xzf dist/brise-1.1.0-x86_64.tar.gz -C brise
cd brise && ./install.sh
```

### Arch Linux

With yay:

```bash
yay -S brise
```

The package builds Brise from the `v1.1.0` sources and installs the binary, launcher, desktop file and icons into `/usr`. The launcher opens the window tiled on the monitor under the mouse pointer; `BRISE_MONITOR=DP-4 brise-launch` forces another monitor.

Not in the AUR yet? A package recipe is available in [`aur/PKGBUILD`](aur/PKGBUILD) — `makepkg -si` builds Brise from source.

### Building from source

Requirements: Linux x86_64, Rust ≥ 1.82, GTK3 and WebKit2GTK 4.1.

```bash
./scripts/build.sh                  # release binary + portable archive
# or just the binary:
cd src-tauri && cargo build --release
```

## Usage

| Key | Action |
| --- | --- |
| `Ctrl` + `K` | Open search for places and commands |
| `Ctrl` + `,` | Open settings |
| `Ctrl` + `R` | Reload weather data |
| `1` / `2` / `3` | Weather / radar / map of Germany |
| `Esc` | Close dialog |

In the settings you choose the default region, the interface language (German, English or Dutch) and — for Germany — whether weather comes from DWD or Open-Meteo. All other countries use Open-Meteo. Radar and official warnings remain DWD-only. Search always covers the whole world.

In search you can enter any place on Earth, even places outside the built-in city list. The star next to a result saves it permanently as a favourite.

## Monitor behaviour on Hyprland

`brise-launch` registers a window rule before starting, so the window opens **tiled (`tile=true`) on the monitor under the mouse pointer**. Hyprland decides the exact position in your layout. You can also force a monitor:

```bash
BRISE_MONITOR=DP-1 brise-launch
```

On X11 the app positions itself; on other Wayland compositors the compositor decides.

## High-refresh scrolling (180 Hz)

On Wayland with NVIDIA, `DRM_IOCTL_WAIT_VBLANK` (`drmWaitVBlank`) may answer with `EOPNOTSUPP`. WebKitGTK then stops following the monitor's vblank and falls back to a fixed 60 fps timer. Brise avoids that without switching off the GPU:

- `brise-launch` reads the monitor's refresh rate from Hyprland and exports it as `BRISE_REFRESH_HZ`.
- Only when that value is known does it preload `libbrise-vblank.so`. The shim answers just that failing `drmWaitVBlank` call with a real vblank at the detected rate — it never invents a refresh rate.
- OpenGL stays enabled (`GDK_GL=always`), so WebKit keeps compositing on the GPU. Disabling GL also reaches 180 Hz, but loses hardware acceleration and feels slower and jerkier, so it is not used.
- The Rust backend stamps every drawn frame's `GdkFrameTimings` with the real refresh interval and turns off WebKit's `PreferPageRenderingUpdatesNear60FPS` fallback.

On a 1920 × 1080 @ 179.998 Hz display this measures about **5.6 ms per frame (~180 Hz)** with GPU rendering, instead of a hard-coded 60 fps. The extra animations use only `transform` and `opacity`, respect `prefers-reduced-motion` and pause while scrolling. Hardware acceleration and VSync can still be toggled in the settings.

## Project structure

```text
.
├── install.sh              # installation without sudo
├── scripts/
│   ├── build.sh            # release build + portable archive
│   └── generate_geo.py     # Germany geometry from Natural Earth
├── src-tauri/              # Rust backend, Tauri configuration, icons
└── ui/                     # HTML, CSS, JavaScript, fonts
```

## Data sources & credits

- **German Weather Service (DWD)** — open data via [Bright Sky](https://api.brightsky.dev/) (no registration required).
- **Open-Meteo** — free weather forecasts without an API key or account, for Germany (optional) and all other countries.
- **Open-Meteo Geocoding** with **GeoNames** — place lookup for any country.
- **Natural Earth** — map data for Germany (public domain).
- **Inter** and **Space Grotesk** — fonts under the SIL Open Font License.

Brise is an independent project and is **not** affiliated with the German Weather Service. License details and attributions are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Contributing

Issues and pull requests are welcome. For backend changes run `cargo check` in `src-tauri/`; for the interface just edit the files in `ui/`. A full build runs with `./scripts/build.sh`.

## License

Brise is licensed under the [MIT License](LICENSE).
