#!/usr/bin/env zsh

# Cut-paste this into zsh terminal.
# It doesn't produce any output when run from a script.
for command in ${(kv)_comps:#-*(-|-,*)}; do
    printf "%-32s %s\n" $command $completions
done | sort