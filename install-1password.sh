#!/usr/bin/env bash

echo "Creating /tmp workspace..."
TMP="/tmp/install-1password"
rm -rf "$TMP"
mkdir -p "$TMP"

echo "Downloading 1Password Installer..."
OUTFILE="$TMP/Install-1Password.zip"
curl -L https://downloads.1password.com/mac/1Password.zip --output "$OUTFILE"

echo "Unzipping 1Password Installer..."
unzip "$TMP"/Install-1Password.zip -d "$TMP"

echo "Running 1Password Installer..."

open -n -W "$TMP/1Password Installer.app"

echo "Installed!"

echo "Cleaning up..."
rm -rf "/Applications÷/Install Parallels Desktop.app"
rm -rf "$TMP"

echo "Done!"

# 1Password Command Line Args

# [7217:0811/212829.837390:ERROR:node_bindings.cc(298)] NODE_OPTIONS have been disabled in this app
# Usage: 1password [options] [url]
# Accepts an optional onepassword:// URL (e.g. for adding an account).

# 1Password - 8.10.9
# The 1Password desktop experience.

# Options:
#   --disable-gpu   disable GPU hardware acceleration
#   --lock          lock 1Password if it is unlocked
#   --log <level>   output logs (choices: "error", "warn", "info", "debug", "trace", "off")
#   --quick-access  open 1Password's quick access
#   --silent        open to the system tray without showing the main window
#   --toggle        show or hide the main window
#   --version       show version information
#   -h, --help      show this message

# Check out 'op', the 1Password CLI: https://support.1password.com/command-line.
# Documentation and support: https://support.1password.com/.
# Built with ♥ by the 1Password team in Canada and around the world.

# See 1Password command line args here:
# /Applications/1Password.app/Contents/MacOS/1Password --help 