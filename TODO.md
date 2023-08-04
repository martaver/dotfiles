# TODO

Search github for repos called `dotfiles` for examples of setups.

Search /r/UnixPorn for pro setups.

[*] Split keymaps project out
[*] Rename repo to dotfiles, or ~ to dotfiles or something.

[ ] helix editor?
[ ] neovim + vscode?
[ ] tree-sitter
[ ] neorg
[ ] tmux
[*] chezmoi - https://fedoramagazine.org/take-back-your-dotfiles-with-chezmoi/

MacOS:
[*] try kitty for terminal (suposed to be faster than iterm)
[*] yabai
[*] skhdc
[ ] direnv and asdf - https://blog.mikecordell.com/2021/12/18/better-project-environment-management-with-direnv-and-asdf/
[ ] hammerspoon for automation of MacOS (lua is also used to script neovim)

# Neovim
Check out:
tpope's neovim stuff
telescope
harpoon

# Terminal

## Debugging slow Terminal startup

Use `zprof` - instructions in `.zshrc`.

## Editing /etc/... from chezmoi

https://github.com/twpayne/chezmoi/discussions/1510

Why: to get scripts/aliases available globally to all applications/shells, e.g. in `yabai` for reactions to events.

- Check out Raycast: https://www.raycast.com/
- Check out ScriptKit: https://www.scriptkit.com/
- Run ScriptKit commands from Raycast: https://www.raycast.com/pomdtr/script-kit

## Bootstrap
- [ ] Allow passing a flag to `setup.sh` that installs all system deps, but skips bootstrapping `nix-darwin` and `chezmoi`.
  This'll allow us to setup a base VM snapshot more easily without having to comment out the bootstrapping every time.

## Nix
- [ ] Revert to using Determinate's nix installer when following is fixed
  - Cannot do nix-darwin install without rebooting first: https://github.com/DeterminateSystems/nix-installer/issues/275
  - Determinate nix installer leaves ~/.nix-channels owned by root: https://github.com/DeterminateSystems/nix-installer/issues/287
- [ ] Use `nix-darwin` to manage homebrew: https://daiderd.com/nix-darwin/manual/index.html#opt-homebrew.enable


## Environment
- [ ] Scroll Reverser
- [ ] AltTab
- [ ] Karabiner

## Dev
- [ ] VSCode
- [ ] GitKraken