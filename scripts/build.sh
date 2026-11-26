#!/usr/bin/env bash
# Build the release binary and assemble the portable Linux bundle in dist/.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="1.1.0"

echo "== Release-Build =="
cd "$root/src-tauri"
cargo build --release

echo "== Vblank-Shim bauen =="
cd "$root"
drm_cflags="$(pkg-config --cflags libdrm 2>/dev/null || printf '%s' '-I/usr/include/libdrm')"
${CC:-cc} -shared -fPIC -O2 $drm_cflags \
  src-tauri/vblank_shim.c -o dist/libbrise-vblank.so -ldl

echo "== Bundle zusammenstellen =="
install -m 0755 src-tauri/target/release/brise dist/brise
chmod +x dist/brise-launch dist/install.sh

archive="dist/brise-${version}-x86_64.tar.gz"
tar -czf "$archive" \
  -C dist brise brise-launch brise.desktop install.sh README.md icons libbrise-vblank.so \
  -C "$root" README.de.md LICENSE THIRD_PARTY_NOTICES.md

echo "Fertig: $archive"
echo "Installieren: mkdir brise && tar -xzf $archive -C brise && (cd brise && ./install.sh)"
