#!/usr/bin/env bash
# Veröffentlicht das AUR-Paket aus aur/ mit dem eigenen AUR-Schlüssel.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUR_REPO="ssh://aur@aur.archlinux.org/brise.git"
SSH_KEY="$HOME/.ssh/aur"
PKGVER="$(sed -n 's/^pkgver=//p' "$PROJECT_DIR/aur/PKGBUILD")"

usage() {
  cat <<EOF
Aufruf: $0 [Option]

Optionen:
  --key     Öffentlichen AUR-Schlüssel anzeigen
  -h        Diese Hilfe anzeigen

Ohne Option wird das Paket geprüft und nach AUR gepusht.
BRISE_AUR_SKIP_BUILD=1 überspringt den lokalen Build-Test.
EOF
}

case "${1:-}" in
  --key) cat "$SSH_KEY.pub"; exit 0 ;;
  -h|--help) usage; exit 0 ;;
  "") ;;
  *) echo "Unbekannte Option: $1" >&2; usage >&2; exit 1 ;;
esac

if [ ! -f "$SSH_KEY" ]; then
  echo "Fehler: Kein AUR-Schlüssel unter $SSH_KEY gefunden." >&2
  exit 1
fi

for cmd in git makepkg ssh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Fehler: $cmd fehlt." >&2
    exit 1
  fi
done

work="$(mktemp -d /tmp/brise-aur.XXXXXX)"
trap 'rm -rf "$work"' EXIT

if ! git -c init.defaultBranch=master clone "$AUR_REPO" "$work/brise"; then
  echo "Hinweis: AUR-Konto anlegen, den Schlüssel aus '$0 --key' unter" >&2
  echo "https://aur.archlinux.org/account/ eintragen und es erneut versuchen." >&2
  exit 1
fi

git -C "$work/brise" checkout -B master
git -C "$work/brise" config user.name "Felix"
git -C "$work/brise" config user.email "brise@users.noreply.github.com"

for file in PKGBUILD .SRCINFO LICENSE; do
  cp "$PROJECT_DIR/aur/$file" "$work/brise/$file"
done

mkdir -p "$work/build"
for file in PKGBUILD .SRCINFO LICENSE; do
  cp "$PROJECT_DIR/aur/$file" "$work/build/$file"
done
(cd "$work/build" && makepkg --printsrcinfo > "$work/generated.SRCINFO")
if ! diff -u "$work/brise/.SRCINFO" "$work/generated.SRCINFO"; then
  echo "Fehler: .SRCINFO passt nicht zur PKGBUILD." >&2
  exit 1
fi

if [ "${BRISE_AUR_SKIP_BUILD:-0}" != "1" ]; then
  (cd "$work/build" && makepkg -f --noconfirm > "$work/build.log")
  echo "Build-Test erfolgreich: Brise $PKGVER baut aus dem AUR-Paket."
fi

git -C "$work/brise" add PKGBUILD .SRCINFO LICENSE
if git -C "$work/brise" diff --cached --quiet; then
  echo "AUR ist bereits aktuell – keine Änderung nötig."
else
  git -C "$work/brise" commit -m "Brise $PKGVER veröffentlichen"
  git -C "$work/brise" push origin master
  echo "Veröffentlicht: https://aur.archlinux.org/packages/brise"
fi
