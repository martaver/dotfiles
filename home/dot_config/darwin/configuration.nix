{ config, pkgs, ... }:

# All system packages
let  
  syspkgs = [    
    pkgs.curl
    pkgs.direnv    
    pkgs.git    
    pkgs.jq    
    pkgs.nodejs
    pkgs.openssh    
    pkgs.wget    
    pkgs.yq-go
    pkgs.zsh
  ];

in
{
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

  programs.bash.enableCompletion = true;    
  programs.zsh.enable = true;

  # Environment configuration
  environment.variables.LANG = "en_US.UTF-8";

  # System packages
  environment.systemPackages = syspkgs;

  # `environment.extraInit`
  environment.extraInit = "echo Running extraInit; EXTRA_INIT_RAN=true;";
  
  # `environment.interactiveShellInit`
  environment.interactiveShellInit = "echo Running interactiveShellInit; INTERACTIVE_SHELL_INIT_RAN=true;";
  
  # `environment.loginShellInit`
  environment.loginShellInit = "echo Running loginShellInit; LOGIN_SHELL_INIT_RAN=true;";

  # `environment.shellInit`
  environment.shellInit = "echo Running shellInit; SHELL_INIT_RAN=true;";

  # Auto upgrade nix package and the daemon service.
  services.nix-daemon.enable = true;

  # Disable nix-index until we figure out a good (and working) way to load nix-index-database
  # and prevent having to build the whole index every time we build
  programs.nix-index.enable = false;

  # system.stateVersion = 4;
  nix.extraOptions = ''
    extra-platforms = aarch64-darwin x86_64-darwin
    experimental-features = nix-command flakes
    trusted-users = root martaver sebastiannemeth
    allow-import-from-derivation = true
  '';

  system.activationScripts.postUserActivation.text = ''
    # Not all darwin settings are activated after nix-darwin configures them until restart
    # Following line should allow us to avoid a logout/login cycle
    # Inspired by: https://medium.com/@zmre/nix-darwin-quick-tip-activate-your-preferences-f69942a93236
    /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u
  '';

  users.users.sebastiannemeth.home = "/Users/sebastiannemeth";
}