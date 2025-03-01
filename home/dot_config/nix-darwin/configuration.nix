{ self, config, pkgs, ... }:

# All system packages
let

in
{
  # Disable nix-darwin's control of the nix installation, which is managed by Determinate.
  nix.enable = false;

  # Set Git commit hash for darwin-version.
  system.configurationRevision = self.rev or self.dirtyRev or null;

  # Used for backwards compatibility, please read the changelog before changing.
  # $ darwin-rebuild changelog
  system.stateVersion = 6;

  # Default system configurations
  system.defaults.NSGlobalDomain.ApplePressAndHoldEnabled = false;
  system.defaults.NSGlobalDomain.InitialKeyRepeat = 15;
  system.defaults.NSGlobalDomain.KeyRepeat = 1;
  system.defaults.NSGlobalDomain.NSAutomaticCapitalizationEnabled = false;
  system.defaults.NSGlobalDomain.NSAutomaticDashSubstitutionEnabled = false;
  system.defaults.NSGlobalDomain.NSAutomaticPeriodSubstitutionEnabled = false;
  system.defaults.NSGlobalDomain.NSAutomaticQuoteSubstitutionEnabled = false;
  system.defaults.NSGlobalDomain.NSAutomaticSpellingCorrectionEnabled = false;
  system.defaults.NSGlobalDomain.NSDocumentSaveNewDocumentsToCloud = false;
  system.defaults.NSGlobalDomain.NSNavPanelExpandedStateForSaveMode = true;
  system.defaults.NSGlobalDomain.NSNavPanelExpandedStateForSaveMode2 = true;
  system.defaults.SoftwareUpdate.AutomaticallyInstallMacOSUpdates = false;

  system.defaults.dock.autohide = true;
  system.defaults.dock.showhidden = true;

  system.defaults.finder.AppleShowAllExtensions = true;
  system.defaults.finder.FXEnableExtensionChangeWarning = false;
  system.defaults.finder.QuitMenuItem = true;

  # Program configuration

  programs.bash.completion.enable = true;
  programs.zsh.enable = true;

  # Environment configuration
  environment.variables = {
    LANG = "en_US.UTF-8";
    HOMEBREW_BUNDLE_FILE = "~/Brewfile";
    FOO = "BAR";
  };

  # System packages
  environment.systemPackages = [
    pkgs.curl
    pkgs.direnv
    pkgs.git
    pkgs.jq
    pkgs.openssh
    pkgs.wget
    pkgs.yq-go
    pkgs.zsh
    pkgs.nixpkgs-fmt
    pkgs.nixd
    pkgs.iterm2
  ];

  # environment.systemPath = [
  #   "/Users/martaver/.yabai/bin"
  # ];

  # todo: use this somehow to install yabai's SA?
  # ref: https://github.com/LnL7/nix-darwin/issues/165

  # environment.etc = {
  # "sudoers.d/yabai".text = let
  #   commands = [
  #     "/run/current-system/sw/bin/darwin-rebuild"
  #     "/run/current-system/sw/bin/nix*"
  #     "/run/current-system/sw/bin/ln"
  #     "/nix/store/*/activate"
  #     "/bin/launchctl"
  #   ];
  #   commandsString = builtins.concatStringsSep ", " commands;
  # in ''
  #   %admin ALL=(ALL:ALL) NOPASSWD: ${commandsString}
  # '';

  # `environment.extraInit`
  # environment.extraInit = "echo Running extraInit; export EXTRA_INIT_RAN=true;";

  # `environment.interactiveShellInit`
  # environment.interactiveShellInit = "echo Running interactiveShellInit; export INTERACTIVE_SHELL_INIT_RAN=true;";

  # `environment.loginShellInit`
  # environment.loginShellInit = "echo Running loginShellInit; export LOGIN_SHELL_INIT_RAN=true;";

  # `environment.shellInit`
  # environment.shellInit = "echo Running shellInit; export SHELL_INIT_RAN=true;";

  # `launchd.envVariables`
  # launchd.envVariables = {
  #   LAUNCHD_VAR = "true";
  # };

  # homebrew = {
  #   enable = true;
  #   onActivation.autoUpdate = true;
  #   onActivation.upgrade = true;
  #   # updates homebrew packages on activation,
  #   # can make darwin-rebuild much slower (otherwise i'd forget to do it ever though)

  #   brews = [
  #     # {
  #     #   name = "koekeishiya/formulae/skhd";
  #     #   restart_service = "changed";
  #     # }     
  #     # {
  #     #   name = "koekeishiya/formulae/yabai";
  #     #   restart_service = "changed";
  #     # }    
  #   ];

  #   casks = [
  #     "visual-studio-code"      
  #   ];
  # };

  services.karabiner-elements = {
    enable = true;
  };

  services.skhd = {
    enable = true;
  };

  services.yabai = {
    enable = true;
    enableScriptingAddition = false;
  };

  # Auto upgrade nix package and the daemon service.
  # services.nix-daemon.enable = true;
  # nix.useDaemon = true;

  # Disable nix-index until we figure out a good (and working) way to load nix-index-database
  # and prevent having to build the whole index every time we build
  # programs.nix-index.enable = false;

  # # system.stateVersion = 4;
  # nix.extraOptions = ''
  #   extra-platforms = aarch64-darwin x86_64-darwin
  #   experimental-features = nix-command flakes
  #   trusted-users = root martaver sebastiannemeth
  #   allow-import-from-derivation = true
  # '';

  system.activationScripts.postUserActivation.text = ''
    # Not all darwin settings are activated after nix-darwin configures them until restart
    # Following line should allow us to avoid a logout/login cycle
    # Inspired by: https://medium.com/@zmre/nix-darwin-quick-tip-activate-your-preferences-f69942a93236
    /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u
  '';

  users.users.martaver.home = "/Users/martaver";
  users.users.sebastiannemeth.home = "/Users/sebastiannemeth";
  users.users."sebastian.nemeth".home = "/Users/sebastian.nemeth";
}
