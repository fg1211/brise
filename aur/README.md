# Brise im AUR veröffentlichen und mit yay installieren

`yay` installiert Pakete aus dem **Arch User Repository (AUR)**. Das AUR wird nicht automatisch
aus diesem GitHub-Repository befüllt — ein Paket muss dort von einem eigenen Konto hochgeladen
werden. Die nötigen Dateien liegen hier fertig bereit.

## 1. Paket lokal testen

```bash
cd aur
makepkg -si
```

Danach sollte `brise-launch` starten und im Anwendungsmenü das Brise-Logo erscheinen.

## 2. AUR-Account vorbereiten

1. Konto auf <https://aur.archlinux.org/register> anlegen.
2. In den AUR-Kontoeinstellungen einen **SSH-Public-Key** hinterlegen.

## 3. Paket hochladen

```bash
git clone ssh://aur@aur.archlinux.org/brise.git
cd brise
cp /pfad/zu/brise/aur/PKGBUILD .
makepkg --printsrcinfo > .SRCINFO
git add PKGBUILD .SRCINFO
git commit -m "Brise 1.0.0"
git push
```

Das AUR erlaubt im Git-Repository nur `PKGBUILD` und `.SRCINFO` — keine Binaries und keine
weiteren Dateien. Der Build lädt den Quellcode aus einem festen GitHub-Commit und kompiliert ihn
mit `cargo build --release --locked`.

## 4. Mit yay installieren

```bash
yay -S brise
brise-launch
```

Mit `yay -Syu brise` aktualisieren. Für eine Version `1.0.1` im GitHub-Repository: Tag `v1.0.1`
setzen, `pkgver` und `sha256sums` im `PKGBUILD` anpassen, `.SRCINFO` neu erzeugen und erneut
pushen. Die neue `sha256sum` erhält man mit:

```bash
curl -sSL https://github.com/fg1211/brise/archive/refs/tags/v1.0.1.tar.gz | sha256sum
```

## Hinweis zum Launcher

`brise-launch` platziert das Fenster unter Hyprland auf `DP-2` und teilt es (`tile=true`).
Anderen Monitor wählen:

```bash
BRISE_MONITOR=DP-4 brise-launch
```
