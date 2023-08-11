#!/usr/bin/env bash

echo "Creating /tmp workspace..."
TMP="/tmp/install-parallels"
rm -rf "$TMP"
mkdir -p "$TMP"

echo "Downloading Parallels Desktop Installer..."
OUTFILE="$TMP/Install-Parallels-Desktop.dmg"
curl -L https://www.parallels.com/directdownload/pd/?mode=trial --output "$OUTFILE"

echo "Mounting Parallels Desktop Installer..."
hdiutil mount "$OUTFILE"

MOUNTPATH="/Volumes/Install Parallels Desktop"

echo "Running Parallels Desktop Installer..."

open -n -W "$MOUNTPATH/Install Parallels Desktop.app"

echo "Installed!"

echo "Cleaning up..."
hdiutil unmount "$MOUNTPATH"
sudo rm -rf "/Applications/Install Parallels Desktop.app"
sudo rm -rf "$TMP"

echo "Done!"