#!/usr/bin/env bash
# Build the release binary and assemble the portable Linux bundle in dist/.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="1.1.0"

echo "== Release-Build =="
cd "$root/src-tauri"
cargo build --release

echo "== Bundle zusammenstellen =="
cd "$root"
install -m 0755 src-tauri/target/release/brise dist/brise
chmod +x dist/brise-launch dist/install.sh

archive="dist/brise-${version}-x86_64.tar.gz"
tar -czf "$archive" \
  -C dist brise brise-launch brise.desktop install.sh README.md icons

echo "Fertig: $archive"
echo "Installieren: tar -xzf $archive && cd dist && ./install.sh"
