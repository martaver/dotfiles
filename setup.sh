#! /usr/bin/env bash
# 
# Author: Sebastian Nemeth <sebastian@cleric.sh>
# Original Author: Joshua Gilman <joshuagilman@gmail.com>
#
#/ Usage: setup.sh
#/
#/ A simple installation script for configuring my personal development
#/ environment on an M1 based Apple MacBook.
#/
# shellcheck disable=SC2155

if [ "$1" = "--skip-bootstrap" ]; then
	echo "Skipping bootstrap, only checking installed dependencies..."
	
	skipSetup=true
else
	if [ "$1" != "" ]; then
		echo "WARNING: Argument '$1' was not recognised"
		exit 1
	fi

	skipSetup=false
fi

set -o errexit  # abort on nonzero exitstatus
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

readonly yellow='\e[0;33m'
readonly green='\e[0;32m'
readonly red='\e[0;31m'
readonly reset='\e[0m'

readonly dotfiles='https://github.com/martaver/dotfiles'

# Nix
readonly nixVer='2.15.1'
readonly nixReleaseBase='https://releases.nixos.org'

# Brew
readonly brewRepo='https://raw.githubusercontent.com/Homebrew/install'
readonly brewCommitSha='e8114640740938c20cc41ffdbf07816b428afc49'
readonly brewChecksum='98a0040bd3dc4b283780a010ad670f6441d5da9f32b2cb83d28af6ad484a2c72'

readonly LocalHostName="$(scutil --get LocalHostName)"

# Usage: log MESSAGE
#
# Prints all arguments on the standard output stream
log() {
	printf "${yellow}>> %s${reset}\n" "${*}"
}

# Usage: success MESSAGE
#
# Prints all arguments on the standard output stream
success() {
	printf "${green} %s${reset}\n" "${*}"
}

# Usage: error MESSAGE
#
# Prints all arguments on the standard error stream
error() {
	printf "${red}!!! %s${reset}\n" "${*}" 1>&2
}

# Usage: die MESSAGE
# Prints the specified error message and exits with an error status
die() {
	error "${*}"
	exit 1
}

# # Usage: yesno MESSAGE
# #
# # Asks the user to confirm via y/n syntax. Exits if answer is no.
# yesno() {
# 	read -p "${*} [y/n] " -n 2 -r
# 	printf "\n"
# 	if [[ ! $REPLY =~ ^[Yy]$ ]]; then
# 		exit 1
# 	fi
# }

# Usage: tryInstall NAME EXECUTABLE
#
# Asks the user permission to install NAME and then runs EXECUTABLE
tryInstall() {
	local name=${1}
	local executable=${2}
	
	# yesno "Would you like to install it?"

	log "'${name}' not detected. Installing..."
	${executable}
	success "'${name}' successfully installed!"
}

# Usage: checkDep NAME CONDITION EXECUTABE
#
# Checks CONDITION, if not true asks user to run EXECUTABLE
checkDep() {
	local name=${1}
	local condition=${2}
	local executable=${3}

	if ! ${condition} -p &>/dev/null; then
		tryInstall "${name}" "${executable}"
	else
		log "'${name}' detected. Already installed, skipping..."
	fi
}

chomp() {
	printf "%s" "${1/"$'\n'"/}"
}

# Usage: installXcode
#
# Downloads and installs the xcode command line tools
# Source: https://github.com/Homebrew/install/blob/master/install.sh#L846
installXcode() {
	log "Searching online for the Command Line Tools"

	# This temporary file prompts the 'softwareupdate' utility to list the Command Line Tools
	clt_placeholder="/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress"
	/usr/bin/sudo /usr/bin/touch "${clt_placeholder}"

	clt_label_command="/usr/sbin/softwareupdate -l |
                        grep -B 1 -E 'Command Line Tools' |
                        awk -F'*' '/^ *\\*/ {print \$2}' |
                        sed -e 's/^ *Label: //' -e 's/^ *//' |
                        sort -V |
                        tail -n1"
	clt_label="$(chomp "$(/bin/bash -c "${clt_label_command}")")"

	if [[ -n "${clt_label}" ]]; then
		log "Installing ${clt_label}"
		/usr/bin/sudo "/usr/sbin/softwareupdate" "-i" "${clt_label}"
		/usr/bin/sudo "/usr/bin/xcode-select" "--switch" "/Library/Developer/CommandLineTools"
	fi

	/usr/bin/sudo "/bin/rm" "-f" "${clt_placeholder}"
}

# Usage: installNix
#
# Downloads and executes the nix installer script
installNix() {
	
	# Using Standard Installer
	# ------
	# local nixURL="${nixReleaseBase}/nix/nix-${nixVer}/install"
	# local checksumURL="${nixReleaseBase}/nix/nix-${nixVer}/install.sha256"
	# local sha="$(curl "${checksumURL}")"

	# log "Downloading install script from ${nixURL}..."
	# curl "${nixURL}" -o "${tmpDir}/nix.sh" &>/dev/null

	# log "Validating checksum..."
	# if ! echo "${sha}  ${tmpDir}/nix.sh" | shasum -a 256 -c; then
	# 	die "Checksum validation failed; cannot continue"
	# fi

	# log "Running nix installer..."	
	# bash "${tmpDir}/nix.sh"
	# success "Nix installed successfully"

	# # nix shell requires nix-command which is experimental
	# # we also need to add flakes so we can run our development flakes
	# log 'Adding experimental features: nix-command flakes'
	# mkdir -p ~/.config/nix
	# echo 'experimental-features = nix-command flakes' >>~/.config/nix/nix.conf
	# -------


	# Using Determinate Installer
	# ------
	log "Running (determinate) nix installer..."
	# Use Determinate Nix Installer: https://github.com/DeterminateSystems/nix-installer
	curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install --no-confirm	

	success "Nix installed successfully"
	# -------

	log 'Configuring environment...'
	set +o errexit
	set +o nounset
	set +o pipefail
	# shellcheck disable=SC1091
	source /etc/zshrc # Load nix cmds into the current shell
	set -o errexit
	set -o nounset
	set -o pipefail
}

installNixDarwin() {
	log 'Building (flakes) nix-darwin installer...'

  # Initialise flake.nix inside
	mkdir -p ~/.config/nix-darwin
	cd ~/.config/nix-darwin
	nix flake init -t nix-darwin
	sed -i '' "s/simple/$LocalHostName/" flake.nix # Replace 'simple' with LocalHostName

	# Configure Apple Silicon
	sed -i '' 's/nixpkgs.hostPlatform = "x86_64-darwin";/nixpkgs.hostPlatform = "aarch64-darwin";/' flake.nix # Replace 'x86_64-darwin' with 'aarch64-darwin'

	# Backup existing /etc files
	sudo mv /etc/nix.conf /etc/nix.conf.backup 
	sudo mv /etc/zshenv /etc/zshenv.backup 

	# Install nix-darwin
	nix run nix-darwin -- switch --flake ~/.config/nix-darwin

	log "Configuring environment..."
	set +o errexit
	set +o nounset
	set +o pipefail
	# shellcheck disable=SC1091
	source /etc/static/zshrc
	set -o errexit
	set -o nounset
	set -o pipefail
}

# Usage: installNixDarwin
#
# Builds the nix-darwin installer and then executes it
installNixDarwinOld() {		

	log 'Building nix-darwin installer...'
	cd "${tmpDir}" && nix-build https://github.com/LnL7/nix-darwin/archive/master.tar.gz -A installer

	# nix-darwin complains if this file exists, so we back it up first
	/usr/bin/sudo mv /etc/nix/nix.conf /etc/nix/nix.conf.backup

	log 'Running nix-darwin installer...'
	cd "${tmpDir}" && ./result/bin/darwin-installer

	# nix-darwin manages nix itself, so we can remove the global version now
	log "Removing redundant nix version..."
	/usr/bin/sudo -i nix-env -e nix

	log "Configuring environment..."
	set +o errexit
	set +o nounset
	set +o pipefail
	# shellcheck disable=SC1091
	source /etc/static/bashrc
	set -o errexit
	set -o nounset
	set -o pipefail
}

# Usage installBrew
#
# Downloads and executes the brew installer script
installBrew() {
	local brewURL="${brewRepo}/${brewCommitSha}/install.sh"

	log "Downloading install script from ${brewURL}..."
	curl "${brewURL}" -o "${tmpDir}/brew.sh" &>/dev/null

	log "Validating checksum..."
	if ! echo "${brewChecksum}  ${tmpDir}/brew.sh" | shasum -a 256 -c; then
		die "Checksum validation failed; cannot continue"
	fi

	log "Running brew installer..."
	bash "${tmpDir}/brew.sh"

	log "Configuring environment..."
	# Note: switched from /opt/homebrew/bin/brew to use the bin below
	# - it might be that on M1 mac or Ventura, brew is installed there.
	# shellcheck disable=SC2016
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"${HOME}/.bash_profile"
	# shellcheck disable=SC2016
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"${HOME}/.zprofile"
	eval "$(/opt/homebrew/bin/brew shellenv)"

	log "Configuring environment..."
	set +o errexit
	set +o nounset
	set +o pipefail
	# shellcheck disable=SC1091
	source "${HOME}/.bash_profile"
	set -o errexit
	set -o nounset
	set -o pipefail
}

# Usage bwUnlock
#
# Attempts to login or unlock Bitwarden using the CLI
# bwUnlock() {
# 	# Unlock -> login -> check if already unlocked -> die because unreachable
# 	if bw status | grep "locked" &>/dev/null; then
# 		export BW_SESSION="$(bw unlock --raw)"
# 	elif bw status | grep "unauthenticated" &>/dev/null; then
# 		export BW_SESSION="$(bw login --raw)"
# 	elif [[ -z "${BW_SESSION}" ]]; then
# 		die "Unknown bitwarden status"
# 	fi
# }

# need a scratch space for downloading files
tmpDir="$(mktemp -d -t dev-setup-XXXXXXXXXX)"
if [[ ! -d "${tmpDir}" ]]; then
	die "Failed creating a temporary directory; cannot continue"
fi

# xcode is needed for building most software from source
checkDep 'xcode' '/usr/bin/xcode-select' 'installXcode'

# rosetta is needed for running x86_64 applications
checkDep 'rosetta' '/usr/bin/pgrep oahd' 'softwareupdate --install-rosetta'

# nix is needed to configure the entire system
checkDep 'nix' 'command -v nix' 'installNix'

# nix-darwin is what actually does the configuration
checkDep 'nix-darwin' 'command -v darwin-rebuild' 'installNixDarwin'

# bitwarden-cli is needed to pull down secrets with chezmoi
# checkDep 'bitwarden-cli' 'command -v bw' 'nix-env -i bitwarden-cli'

# brew is needed for installing GUI applications (casks)
checkDep 'brew' 'command -v brew' 'installBrew'

# needs to be unlocked before calling chezmoi
# log "Logging into bitwarden..."
# bwUnlock

if [[ ! -d "$HOME/.local/share/chezmoi" ]]; then
	log "Fetching dotfiles..."
	nix shell nixpkgs#chezmoi -c chezmoi init "${dotfiles}"

	nix shell nixpkgs#chezmoi -c chezmoi apply "${HOME}/.config/darwin"

	log "Bootstrapping nix-darwin flake..."
	cd "${tmpDir}" && nix build "${HOME}/.config/darwin#darwinConfigurations.$LocalHostName.system"
	cd "${tmpDir}" && ./result/sw/bin/darwin-rebuild switch --flake "${HOME}/.config/darwin#$LocalHostName"
fi

# implicitely calls `nix-darwin rebuild`` and `brew bundle install``
log "Applying dotfiles..."
nix shell nixpkgs#chezmoi -c chezmoi update

# creates the dotfile structure the first time it's run
# if [[ ! -d "$HOME/.gnupg" ]]; then
# 	log "Initializing GPG..."
# 	gpg-agent --daemon
# fi

success 'Done!'