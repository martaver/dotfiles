#!/usr/bin/env zsh

ROOT=$(cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd)

DEV="$ROOT/~"

function copyOver() {
    file=$1
    # If this ZSHRC is different to the one in ~/Projects/env, then copy it to that file as a backup.
    SHA_HOME=$(sha1sum ~/$file | head -c 40)
    SHA_DEV=$(sha1sum $DEV/$file | head -c 40)

    if [ $SHA_HOME != $SHA_DEV ] ; then
        echo "Changes detected, saving to ~/$file"
        cat "$DEV"/$file > ~/$file
    else
        echo "No changes detected in $file"
    fi
}

copyOver ".zshrc"

# Syncthing home dir config XML
# ~/Library/Application\ Support/Syncthing/config.xml

# So what is ~/Sync with ~/Sync/.stfolder?
