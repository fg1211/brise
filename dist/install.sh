#!/usr/bin/env bash
# Install Brise into a user prefix (default: ~/.local).
# Usage: ./install.sh [PREFIX]
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
prefix="${1:-$HOME/.local}"
bin="$prefix/bin"
apps="$prefix/share/applications"
icons="$prefix/share/icons/hicolor"

mkdir -p "$bin" "$apps" "$icons/256x256/apps" "$icons/512x512/apps"

install -m 0755 "$here/brise" "$bin/brise"
install -m 0755 "$here/brise-launch" "$bin/brise-launch"
install -m 0644 "$here/brise.desktop" "$apps/brise.desktop"
install -m 0644 "$here/icons/128x128.png" "$icons/256x256/apps/brise.png" 2>/dev/null || true
install -m 0644 "$here/icons/512x512.png" "$icons/512x512/apps/brise.png" 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$apps" >/dev/null 2>&1 || true
fi

echo "Brise installiert nach $prefix"
echo "Start: $bin/brise-launch"
