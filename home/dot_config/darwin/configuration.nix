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
  system.defaults.NSGlobalDomain.InitialKeyRepeat = 10;
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
  programs.nix-index.enable = true;
  programs.zsh.enable = true;

  # Environment configuration
  environment.variables.LANG = "en_US.UTF-8";

  # System packages
  environment.systemPackages = syspkgs;

  # Auto upgrade nix package and the daemon service.
  services.nix-daemon.enable = true;

  system.stateVersion = 4;
  nix.extraOptions = ''
    extra-platforms = aarch64-darwin x86_64-darwin
    experimental-features = nix-command flakes
    trusted-users = root martaver
    allow-import-from-derivation = true
  '';
}