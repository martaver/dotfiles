#!/usr/bin/env bash

echo "Creating /tmp workspace..."
TMP="/tmp/install-1password"
rm -rf "$TMP"
mkdir -p "$TMP"

echo "Downloading Docker Installer..."
OUTFILE="$TMP/Docker.dmg"
curl -L https://desktop.docker.com/mac/main/arm64/Docker.dmg --output "$OUTFILE"

echo "Mounting Docker Installer..."
sudo hdiutil attach $OUTFILE

echo "Running Docker Installer..."
sudo /Volumes/Docker/Docker.app/Contents/MacOS/install --accept-license --user=sebastiannemeth

echo "Unmounting Docker Installer..."
sudo hdiutil detach /Volumes/Docker

echo "Done!"