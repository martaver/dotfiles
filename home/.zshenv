#!/usr/bin/env bash

GITHUB_USERNAME=martaver
EDITOR=code

echo envfoo

get_sha1() {
    sha1sum "$1" | head -c 40
}

get_test() {
    yq 'keys[]' < ~/test.yaml
}

yb_focus()      { yabai -m window --focus $1 }
yb_move()       { yabai -m window --swap $1 || $(yabai -m window --display $1; yabai -m display --focus $1) }
yb_insert()     { yabai -m window --insert $1 }

local sz=100

yb_grow() {
    case $1 in
        top)        yabai -m window --resize top:0:-$sz ;;
        bottom)     yabai -m window --resize bottom:0:$sz ;;
        left)       yabai -m window --resize left:-$sz:0 ;;
        right)      yabai -m window --resize right:$sz:0 ;;
    esac
}

yb_shrink() {
    case $1 in
        top)        yabai -m window --resize top:0:$sz ;;
        bottom)     yabai -m window --resize bottom:0:-$sz ;;
        left)       yabai -m window --resize left:$sz:0 ;;
        right)      yabai -m window --resize right:-$sz:0 ;;
    esac
}

# change focus : alt - shift
#    - hjkl
#    - between screens
#    - between workspaces

# move window : 
#    - hjkl
#    - between screens
#    - between workspaces

# resize window

get_window() {
    yabai -m query --windows | title="$1" yq 'map(select(.title == env(title))).0'
}

yb_focus_last() {
    yabai -m query --windows --window &> /dev/null || yabai -m window --focus recent || yabai -m window --focus first
}

kitty_quake() {

    title="$1"    
    
    window=$(get_window $title)            

    if [ $window = "null" ]; then
        yabai -m rule --add app='kitty' title="$title" manage=off sticky=on grid=1:4:0:0:1:1
        kitty --instance-group "$title" --single-instance --title "$title" -d ~ --session ~/.config/kitty/$title.session
        window=$(get_window $title)
    else

        hasFocus=$(echo $window | yq '.has-focus')

        if [ $hasFocus = "true" ]; then
            yabai -m window --minimize
            yb_focus_last
        else
            id="$(echo $window | yq '.id')"
            yabai -m window --focus $id
        fi
    fi
}
