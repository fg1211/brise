#!/usr/bin/env bash
# Brise für Linux installieren – ohne sudo im Benutzerpräfix (~/.local).
# Verwendung: ./install.sh [PREFIX]   oder   PREFIX=/pfad ./install.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
prefix="${1:-${PREFIX:-$HOME/.local}}"
bin="$prefix/bin"
apps="$prefix/share/applications"
icons="$prefix/share/icons/hicolor"

binary="$here/dist/brise"

# Frisch geklonte Repositorys enthalten noch kein Binary: dann aus Quellen bauen.
if [ ! -x "$binary" ]; then
  if command -v cargo >/dev/null 2>&1; then
    echo "Kein vorgebautes Binary gefunden – Brise wird aus dem Quellcode gebaut …"
    bash "$here/scripts/build.sh"
  else
    echo "Fehler: Kein vorgebautes Binary und kein cargo gefunden." >&2
    echo "Bitte Rust installieren oder ein Release-Archiv von GitHub verwenden." >&2
    exit 1
  fi
fi

for file in brise-launch brise.desktop libbrise-vblank.so; do
  if [ ! -f "$here/dist/$file" ]; then
    echo "Fehler: $here/dist/$file fehlt." >&2
    exit 1
  fi
done

echo "Installiere Brise nach $prefix …"
mkdir -p "$bin" "$apps" "$icons/128x128/apps" "$icons/256x256/apps" "$icons/512x512/apps" "$icons/scalable/apps"

install -m 0755 "$binary" "$bin/brise"
install -m 0755 "$here/dist/brise-launch" "$bin/brise-launch"
install -m 0755 "$here/dist/libbrise-vblank.so" "$bin/libbrise-vblank.so"
install -m 0644 "$here/dist/brise.desktop" "$apps/brise.desktop"
install -m 0644 "$here/dist/icons/128x128.png" "$icons/128x128/apps/brise.png"
install -m 0644 "$here/dist/icons/128x128@2x.png" "$icons/256x256/apps/brise.png"
install -m 0644 "$here/dist/icons/512x512.png" "$icons/512x512/apps/brise.png"
install -m 0644 "$here/dist/icons/brise.svg" "$icons/scalable/apps/brise.svg"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$apps" >/dev/null 2>&1 || true
fi

echo "Brise installiert nach $prefix"
echo "Start: $bin/brise-launch"
echo "Hinweis: Auf Hyprland startet der Launcher standardmäßig auf DP-2."
echo "         Mit BRISE_MONITOR=DP-1 lässt sich der Monitor ändern."
