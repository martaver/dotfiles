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

# # Nix
# readonly nixVer='2.15.1'
# readonly nixReleaseBase='https://releases.nixos.org'

# # Brew
# readonly brewRepo='https://raw.githubusercontent.com/Homebrew/install'
# readonly brewCommitSha='e8114640740938c20cc41ffdbf07816b428afc49'
# readonly brewChecksum='98a0040bd3dc4b283780a010ad670f6441d5da9f32b2cb83d28af6ad484a2c72'

readonly LocalHostName="$(scutil --get LocalHostName)"

readonly cmPath="$HOME/.local/share/chezmoi"
readonly nixDarwinDir="$cmPath/nix-darwin"
readonly nixDarwinInstallDir="$cmPath/nix-darwin/install"

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
	local ifexists=${4:-log "Skipping..."}

	if ! ${condition} -p &>/dev/null; then
		tryInstall "${name}" "${executable}"
	else
		log "'${name}' detected. Already installed..."
		${ifexists}
	fi
}

chomp() {
	printf "%s" "${1/"$'\n'"/}"
}

# Usage: installXcode
#
# Xcode is required to install Homebrew
#
# Downloads and installs the xcode command line tools
# Source: https://github.com/Homebrew/install/blob/master/install.sh#L846
installXcodeCommandLineTools() {
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

	# Using Determinate Installer
	# ------
	log "Running (determinate) nix installer (distro: Determinate)..."
	# Use Determinate Nix Installer: https://github.com/DeterminateSystems/nix-installer	
	curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install --no-confirm	--determinate

	success "Nix installed successfully"
	# -------

	log 'Configuring nix environment...'
	set +o errexit
	set +o nounset
	set +o pipefail
	# shellcheck disable=SC1091
	# Load nix cmds into the current shell, so that we don't have to open a new one
 	. /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
	set -o errexit
	set -o nounset
	set -o pipefail
 	nix --version
 	log 'Configured nix environment successfully'
}

bootstrapNixDarwin() {
# installNixDarwin() {
	log 'Bootstrapping (flakes) nix-darwin configuration...'


  	# Initialise flake.nix inside
	# sudo mkdir -p /etc/nix-darwin
	# sudo chown $(id -nu):$(id -ng) $nixDarwinDir
 	# sudo chown $(id -nu):$(id -ng) /etc/nix-darwin
	# cd /etc/nix-darwin
	
	# To use Nixpkgs unstable:
	# nix flake init -t nix-darwin/master
	# To use Nixpkgs 24.11:
	# nix flake init -t nix-darwin/nix-darwin-24.11
	
	# sed -i '' "s/simple/$LocalHostName/" flake.nix # Replace 'simple' with LocalHostName

	# Configure Apple Silicon
	# sed -i '' 's/nixpkgs.hostPlatform = "x86_64-darwin";/nixpkgs.hostPlatform = "aarch64-darwin";/' "$nixDarwinInstallDir/flake.nix" # Replace 'x86_64-darwin' with 'aarch64-darwin'

	{
		sudo chown $(id -nu):$(id -ng) "$nixDarwinDir"

		# Backup existing /etc files, they'll get replaced during the first switch
		[ ! -f /etc/zshenv ]   || sudo mv /etc/zshenv /etc/zshenv.bak
		[ ! -f /etc/zshrc ]    || sudo mv /etc/zshrc /etc/zshrc.bak
		[ ! -f /etc/zprofile ] || sudo mv /etc/zprofile /etc/zprofile.bak

		# Set up nix-darwin simple / example / empty flake
		
		# cd "$nixDarwinInstallDir"	
		# rm -f flake.nix
		# nix flake init -t nix-darwin/master
		# sed -i '' "s/simple/$(scutil --get LocalHostName)/" flake.nix

		# To use flake.nix stored in chezmoi dotfiles repo:
		sudo nix run nix-darwin/master#darwin-rebuild -- switch --flake "$nixDarwinDir#default"
	
		# To use Nixpkgs unstable:
		# nix run nix-darwin/master#darwin-rebuild -- switch
		# To use Nixpkgs 24.11:
		# nix run nix-darwin/nix-darwin-24.11#darwin-rebuild -- switch

		log "Configuring nix-darwin environment..."
		set +o errexit
		set +o nounset
		set +o pipefail
		# shellcheck disable=SC1091
		source /etc/static/bashrc
		set -o errexit
		set -o nounset
		set -o pipefail
		log "Configured nix-darwin environment successfully"
	
	} || {
		
		error "Bootstrapping nix-darwin failed, restoring /etc/* files"
		
		[ ! -f /etc/zshenv.bak ]   || sudo mv /etc/zshenv.bak /etc/zshenv
		[ ! -f /etc/zshrc.bak ]    || sudo mv /etc/zshrc.bak /etc/zshrc
		[ ! -f /etc/zprofile.bak ] || sudo mv /etc/zprofile.bak /etc/zprofile
	}
}

# Usage installBrew
#
# Downloads and executes the brew installer script
installBrew() {

	log "Configuring shell profiles for brew..."
	# Note: switched from /opt/homebrew/bin/brew to use the bin below
	# - it might be that on M1 mac or Ventura, brew is installed there.
	# shellcheck disable=SC2016
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"${HOME}/.bash_profile"
	# shellcheck disable=SC2016
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"${HOME}/.zprofile"
	eval "$(/opt/homebrew/bin/brew shellenv)"
 
	# NONINTERACTIVE=1
	# local brewURL="${brewRepo}/${brewCommitSha}/install.sh"
	
	# log "Downloading install script from ${brewURL}..."
	# curl "${brewURL}" -o "${tmpDir}/brew.sh" &>/dev/null
	
	log "Downloading install script and running non-interactively..."
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	# log "Validating checksum..."
	# if ! echo "${brewChecksum}  ${tmpDir}/brew.sh" | shasum -a 256 -c; then
	# 	die "Checksum validation failed; cannot continue"
	# fi
	
	# log "Running brew installer..."
	# bash "NONINTERACTIVE=1 ${tmpDir}/brew.sh"
	
	log "Configuring brew environment..."
	set +o errexit
	set +o nounset
	set +o pipefail
	# shellcheck disable=SC1091
	source "${HOME}/.bash_profile"
	set -o errexit
	set -o nounset
	set -o pipefail
	
	brew --version
	
	log "Configured brew environment successfully"
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
checkDep 'xcode-cli-tools' '/usr/bin/xcode-select' 'installXcodeCommandLineTools'

# rosetta is needed for running x86_64 applications
checkDep 'rosetta' '/usr/bin/pgrep oahd' 'sudo softwareupdate --install-rosetta --agree-to-license'

# brew is needed for installing GUI applications (casks)
checkDep 'brew' 'command -v brew' 'installBrew'

# nix is needed to configure the entire system
checkDep 'nix' 'command -v nix' 'installNix'

# init chezmoi from dotfiles repo, to load nix, nix-darwin and home-manager configuration
if [[ ! -d "$cmPath" ]]; then
	log "Initialising dotfiles..."
	nix shell nixpkgs#chezmoi -c chezmoi init "${dotfiles}"
else
	log "Fetching dotfiles..."
	nix shell nixpkgs#chezmoi -c chezmoi git -- reset --hard
	nix shell nixpkgs#chezmoi -c chezmoi git pull "${dotfiles}"
fi

applyNixDarwin() {
	log "Applying (flake) nix-darwin configuration..."
	sudo darwin-rebuild switch --flake "$nixDarwinDir#default"
}

# nix-darwin is what actually does the configuration
checkDep 'nix-darwin' 'command -v darwin-rebuild' 'bootstrapNixDarwin' 'applyNixDarwin'

# bitwarden-cli is needed to pull down secrets with chezmoi
# checkDep 'bitwarden-cli' 'command -v bw' 'nix-env -i bitwarden-cli'

# needs to be unlocked before calling chezmoi
# log "Logging into bitwarden..."
# bwUnlock



# log "Bootstrapping nix-darwin flake..."
# cd "${tmpDir}" && nix build "$nixDarwinDir#darwinConfigurations.$LocalHostName.system"
# cd "${tmpDir}" && ./result/sw/bin/darwin-rebuild switch --flake "$nixDarwinDir#$LocalHostName"


# implicitely calls `nix-darwin rebuild`` and `brew bundle install``
log "Applying dotfiles..."
nix shell nixpkgs#chezmoi -c chezmoi update

# creates the dotfile structure the first time it's run
# if [[ ! -d "$HOME/.gnupg" ]]; then
# 	log "Initializing GPG..."
# 	gpg-agent --daemon
# fi

success 'Done!'
