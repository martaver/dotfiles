# dotfiles

# Bootstrap

1. Disable System Integrity Protection

Follow this: https://github.com/koekeishiya/yabai/wiki/Disabling-System-Integrity-Protection

```
sh -c "$(curl -s "https://raw.githubusercontent.com/martaver/dotfiles/main/setup.sh?token=$(date +%s)")"
```


# Nix Resources

Gist with working M1 nix/nix-darwin/home-manager config:
https://gist.github.com/jmatsushita/5c50ef14b4b96cb24ae5268dab613050
- Blog article: https://discourse.nixos.org/t/simple-workable-config-for-m1-macbook-pro-monterey-12-0-1-with-nix-flakes-nix-darwin-and-home-manager/16834
- Youtube: https://www.youtube.com/watch?v=KJgN0lnA5mk

Managing dotfiles with Nix - Alex Pearce - 2021
https://alexpearce.me/2021/07/managing-dotfiles-with-nix/