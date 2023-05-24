#!/usr/bin/env sh

# NixOS
# sh <(curl -L https://nixos.org/nix/install)

ensure_install() {
    
    CMD=$1
    VERSION=$2
    GET_VERSION=${3:-"$CMD --version"}
    GET_VERSION_REGEX=${4:-"($SEMVER_REGEX)"}
    INSTALL=$5
    UNINSTALL=$6
    UPGRADE=$7
    
    INSTALLED_PATH="$(which $CMD)"

    if [[ "$INSTALLED_PATH" =~ "$CMD not found" ]]; then
        $INSTALL
        exit 0
    fi
    
    if [[ "$($GET_VERSION)" =~ $GET_VERSION_REGEX ]]; then
        INSTALLED_VERSION="${BASH_REMATCH[1]}"
    else
        echo "Problem determing installed version of '$CMD', exiting..."
        exit 1
    fi    
    
    if semver_gt $VERSION $INSTALLED_VERSION; then
        echo "Updating '$CMD' from '$INSTALLED_VERSION' to '$VERSION'..."
        eval "$UPGRADE"
    else
        echo "'$CMD' already up-to-date, skipping..."
        exit 0
    fi
}

ensure_install_brew() {
    
    CMD=$1
    VERSION=$2
    GET_VERSION=${3:-"$CMD --version"}
    GET_VERSION_REGEX=${4:-"($SEMVER_REGEX)"}
    INSTALL=${5:-"brew install $CMD@$VERSION"}
    UNINSTALL=${6:-"brew uninstall $CMD"}
    UPGRADE=${7:-"brew install $CMD@$VERSION"}
    
    ensure_install \
        $CMD \
        $VERSION \
        $GET_VERSION \
        $GET_VERSION_REGEX \
        $INSTALL \
        $UNINSTALL \
        $UPGRADE
}

# ensure_install \
#     nix \
#     2.11.1 \
#     "" \
#     "" \
#     "sh <(curl -L https://releases.nixos.org/?prefix=nix/nix-\$VERSION/) --daemon" \
#     "" \
#     "sudo -i sh -c 'nix-channel --update && nix-env -iA nixpkgs.nix && launchctl remove org.nixos.nix-daemon && launchctl load /Library/LaunchDaemons/org.nixos.nix-daemon.plist'"

curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix/tag/v0.9.0 | sh -s -- install --no-confirm