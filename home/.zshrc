_ENV="$(chezmoi source-path)"

#
# IMPORTANT: Create a backup of ~/.zshrc so that if I fuck it up, I can restore from last usage
#

# If this ZSHRC is different to the one in ~/Projects/env, then copy it to that file as a backup.
# Note, we use .zshrc.backup because if we `cat ~/.zshrc` while `~/.zshrc` is executing, it returns empty.
# Also, we get an extra backup for free.
cp ~/.zshrc ~/.zshrc.backup
SHA_HOME=$(get_sha1 ~/.zshrc.backup)
SHA_DEV=$(get_sha1 $_ENV/~/.zshrc)
if [ $SHA_HOME != $SHA_DEV ] ; then
    echo "Backing up .zshrc to $_ENV/~/.zshrc"
    cat ~/.zshrc.backup > "$_ENV/~/.zshrc"
fi



# Disable annoying beep in shell
unsetopt BEEP

export LANG=en_US.UTF-8


#
# Yarn
#

export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"



#
# Google Cloud
#

# The next line updates PATH for the Google Cloud SDK.
if [ -f '/Users/martaver/Projects/tools/google-cloud-sdk/path.zsh.inc' ]; then . '/Users/martaver/Projects/tools/google-cloud-sdk/path.zsh.inc'; fi

# The next line enables shell command completion for gcloud.
if [ -f '/Users/martaver/Projects/tools/google-cloud-sdk/completion.zsh.inc' ]; then . '/Users/martaver/Projects/tools/google-cloud-sdk/completion.zsh.inc'; fi



#
# Postgres
#

# Set Postgresql's data directory
export PGDATA=/usr/local/var/postgres



#
# Flutter
#
export PATH="$PATH:/Users/martaver/flutter/bin"



#
# Java
#
export JAVA_HOME=$(/usr/libexec/java_home)



#
# NVM
#
export NVM_DIR="$HOME/.nvm"
[ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"  # This loads nvm
[ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] && . "/usr/local/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

export NVM_SYMLINK_CURRENT=true


#
# git-subrepo
#
[[ -f ~/git/git-subrepo/.rc ]] ||
    git clone --depth 1 -- \
        https://github.com/ingydotnet/git-subrepo ~/git/git-subrepo

source ~/git/git-subrepo/.rc




#
# Zim
#

ZIM_HOME=~/.zim

# Download zimfw plugin manager if missing.
if [[ ! -e ${ZIM_HOME}/zimfw.zsh ]]; then
  curl -fsSL --create-dirs -o ${ZIM_HOME}/zimfw.zsh \
      https://github.com/zimfw/zimfw/releases/latest/download/zimfw.zsh
fi

# Install missing modules, and update ${ZIM_HOME}/init.zsh if missing or outdated.
if [[ ! ${ZIM_HOME}/init.zsh -nt ${ZDOTDIR:-${HOME}}/.zimrc ]]; then
  source ${ZIM_HOME}/zimfw.zsh init -q
fi

# Initialize modules.
source ${ZIM_HOME}/init.zsh