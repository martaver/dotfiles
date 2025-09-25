#! /usr/bin/env bash

# shellcheck disable=SC2155

set -o errexit  # abort on nonzero exitstatus
set -o nounset  # abort on unbound variable
set -o pipefail # don't hide errors within pipes

readonly yellow='\e[0;33m'
readonly green='\e[0;32m'
readonly red='\e[0;31m'
readonly reset='\e[0m'

readonly dotfiles='https://github.com/martaver/dotfiles'

readonly LocalHostName="$(scutil --get LocalHostName)"

readonly cmPath="$HOME/.local/share/chezmoi"
readonly nixDarwinDir="$cmPath/nix-darwin"

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


tryInstall() {
	local name=${1}
	local executable=${2}

	log "'${name}' not detected. Installing..."
	${executable}
	success "'${name}' successfully installed!"
}

# Usage: checkDep NAME CONDITION IFNOTEXISTS IFEXISTS?
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

installNix() {
		
	log "Running (determinate) nix installer (distro: Determinate)..."
	# Use Determinate Nix Installer: https://github.com/DeterminateSystems/nix-installer	
	curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install --no-confirm	--determinate
	success "Nix installed successfully"	

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
	log "Bootstrapping nix-darwin with 'default' configuration..."
	{
		sudo chown $(id -nu):$(id -ng) "$nixDarwinDir"

		# Backup existing /etc files, they'll get replaced during the first switch
		log "Backing up /etc/* files..."
		[ ! -f /etc/zshenv ]   || sudo mv /etc/zshenv /etc/zshenv.bak
		[ ! -f /etc/zshrc ]    || sudo mv /etc/zshrc /etc/zshrc.bak
		[ ! -f /etc/zprofile ] || sudo mv /etc/zprofile /etc/zprofile.bak

		# To use flake.nix and default configuration stored in chezmoi dotfiles repo:
		log "Running darwin-rebuild switch..."
		sudo nix run nix-darwin/master#darwin-rebuild -- switch --flake "$nixDarwinDir#default"

		log "Configuring nix-darwin environment..."
		set +o errexit
		set +o nounset
		set +o pipefail
		# shellcheck disable=SC1091
		source /etc/static/bashrc
		set -o errexit
		set -o nounset
		set -o pipefail
		success "Bootstrapped nix-darwin successfully"
	
	} || {
		
		error "Bootstrapping nix-darwin failed, restoring /etc/* files"
		
		[ ! -f /etc/zshenv.bak ]   || sudo mv /etc/zshenv.bak /etc/zshenv
		[ ! -f /etc/zshrc.bak ]    || sudo mv /etc/zshrc.bak /etc/zshrc
		[ ! -f /etc/zprofile.bak ] || sudo mv /etc/zprofile.bak /etc/zprofile
	}
}

applyNixDarwin() {	
	log "Applying (flake) nix-darwin configuration..."
	sudo darwin-rebuild switch --flake "$nixDarwinDir#default"
}

installBrew() {

	log "Configuring shell profiles for brew..."	
	# shellcheck disable=SC2016
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"${HOME}/.bash_profile"
	# shellcheck disable=SC2016
	echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >>"${HOME}/.zprofile"
	eval "$(/opt/homebrew/bin/brew shellenv)"
	
	log "Downloading install script and running non-interactively..."
	/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"	
	
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

# check Touch ID is configured

# configure sudo with Touch ID
setupSudoTouchID() {
	if [ ! -f /etc/pam.d/sudo_local ]; 
	then
		sed "s/^#auth/auth/" /etc/pam.d/sudo_local.template | sudo tee /etc/pam.d/sudo_local
	fi
}

# install 1password

# install 1password-cli

# check to ensure 1password ssh-agent is set up
# ssh-agent -l
# check $SSH_AUTH_SOCK

# xcode is needed for building most software from source
checkDep 'xcode-cli-tools' '/usr/bin/xcode-select' 'installXcodeCommandLineTools'

# rosetta is needed for running x86_64 applications
checkDep 'rosetta' '/usr/bin/pgrep oahd' 'sudo softwareupdate --install-rosetta --agree-to-license'

# brew is needed for installing GUI applications (casks)
checkDep 'brew' 'command -v brew' 'installBrew'

# install docker
# ./install-docker.sh

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

# nix-darwin is what actually does the configuration
checkDep 'nix-darwin' 'command -v darwin-rebuild' 'bootstrapNixDarwin' 'applyNixDarwin'

log "Applying dotfiles..."
nix shell nixpkgs#chezmoi -c chezmoi update

success 'Done!'
