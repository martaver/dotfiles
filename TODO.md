# TODO

Search github for repos called `dotfiles` for examples of setups.

Search /r/UnixPorn for pro setups.

[*] Split keymaps project out
[*] Rename repo to dotfiles, or ~ to dotfiles or something.

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
nvchad
nv kickstart.nvim

# Problems

- [ ] `skhd` commands for `yabai` commands for swapping / changing focus of windows are broken
- [ ] `starship` prompt is slow and sometimes errors when opening prompt (possibly because of `nvm` - drop `nvm` and use `nix-env`?)
- [ ] sometimes hover breaks... not specific to any particular app, but it can happen in any app... and it can happen to some apps and not others at any point in time

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

- [*] Allow passing a flag to `setup.sh` that installs all system deps, but skips bootstrapping `nix-darwin` and `chezmoi`.
  This'll allow us to setup a base VM snapshot more easily without having to comment out the bootstrapping every time.
- [ ] Split installers from `setup.sh` into scripts under `installers/`

## nix

- [*] Revert to using Determinate's nix installer when following is fixed
  - Cannot do nix-darwin install without rebooting first: https://github.com/DeterminateSystems/nix-installer/issues/275
  - Determinate nix installer leaves ~/.nix-channels owned by root: https://github.com/DeterminateSystems/nix-installer/issues/287

## nix-darwin
- [*] Install `nix-darwin` with flake instead of downloaded installer.
- [*] Use `nix-darwin` to manage homebrew: https://daiderd.com/nix-darwin/manual/index.html#opt-homebrew.enable
- [*] Solve `environment.variables` not being applied. Variables set here are not available in Terminal after `darwin-rebuild switch`
- [*] Install `nixpkgs-fmt` via `nix-darwin` in system configuration
- [ ] Install `nil` for nix LSP support.
  - [ ] Check out `nixd` once it seems to have settled down a bit into its `nixd-next` releases.
- [ ] Use vagrant to configure test VM for building / applying system changes
- [ ] Structure nix-darwin for hosts/ users/
- [ ] Check out: https://github.com/srid/nixos-flake?tab=readme-ov-file for a way to work with nixos/nix-darwin/home-manager consistently

## Hammerspoon

- [*] Install hammerspoon & configure scripting environment
- [*] Auto reload hammerspoon config
- [ ] Use hammerspoon to control yabai instead of skhd via hs-socket: https://github.com/Hammerspoon/hammerspoon/discussions/3254

## Parallels

- [*] Install parallels from script
- [ ] Apply parallels license from ./install-parallels.sh using `prlsrvctl`

## 1Password

- [ ] Install 1Password from script
- [ ] Install 1Password CLI (use hammerspoon to automate)
- [ ] Configure git from home dir

## Environment

- [ ] Scroll Reverser
- [ ] AltTab
- [ ] Karabiner

## Dev

- [ ] VSCode
- [ ] GitKraken
- [ ] Neovim
  - [ ] Neovim Kickstarter
  - [ ] TJ's Neovim tutorial
  - [ ] Prime's Neovim course
  - [ ] T Pope's plugins

users/
martaver/

platforms/
darwin/
linux/

hosts/
test/ - x86 - darwin - martaver
architeuthis/ - arm64 - darwin - martaver
