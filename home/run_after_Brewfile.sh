#! /usr/bin/env bash

echo 'Installing homebrew deps'

brew bundle install --cleanup

# Configures 'yabai --load-sa' to always be run as root as per instructions in
# 'Configure scripting addition' at:
# https://github.com/koekeishiya/yabai/wiki/Installing-yabai-(latest-release)#configure-scripting-addition

# if [ ! -f /private/etc/sudoers.d/yabai ]; then
#   echo 'Installing yabai scripting addition...'
#   USERNAME="$(id -un)"
#   YABAI_PATH="$(which yabai)"
#   SHASUM="$(shasum -a 256 "$YABAI_PATH")"
#   sudo sh -c "echo \"$USERNAME ALL=(root) NOPASSWD: sha256:$SHASUM $YABAI_PATH --load-sa\" > /private/etc/sudoers.d/yabai"
#   sudo yabai --load-sa
# fi

# if [ ! -f ~/Library/LaunchAgents/com.koekeishiya.yabai.plist ]; then
#   echo 'Starting/installing yabai...'
#   yabai --install-service
#   yabai --start-service
# fi

# if [ ! -f ~/Library/LaunchAgents/com.koekeishiya.skhd.plist ]; then
#   echo 'Starting/installing skhd...'
#   skhd --install-service
#   skhd --start-service
# fi

if ! [[ "$(vagrant plugin list | grep vagrant-parallels)" =~ "vagrant-parallels" ]]; then
  echo "Installing 'vagrant-parallels' provider..."
  VAGRANT_DISABLE_STRICT_DEPENDENCY_ENFORCEMENT=1 vagrant plugin install vagrant-parallels
fi