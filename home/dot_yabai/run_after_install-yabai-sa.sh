#! /usr/bin/env bash

brew bundle install

# Configures 'yabai --load-sa' to always be run as root as per instructions in
# 'Configure scripting addition' at:
# https://github.com/koekeishiya/yabai/wiki/Installing-yabai-(latest-release)#configure-scripting-addition

USERNAME="$(id -un)"
YABAI_PATH="$(which yabai)"
SHASUM="$(shasum -a 256 "$YABAI_PATH")"
sudo sh -c "echo \"$USERNAME ALL=(root) NOPASSWD: sha256:$SHASUM $YABAI_PATH --load-sa\" > /private/etc/sudoers.d/yabai"