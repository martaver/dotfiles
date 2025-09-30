{
  self,
  config,
  pkgs,
  ...
}:

# All system packages
let

in
{
  # Disable nix-darwin's control of the nix installation, which is managed by Determinate.
  nix.enable = false;

  # Set Git commit hash for darwin-version.
  # system.configurationRevision = self.rev or self.dirtyRev or null;

  # Used for backwards compatibility, please read the changelog before changing.
  # $ darwin-rebuild changelog
  system.stateVersion = 6;

  # Default system configurations
  # Look up defaults settings here: https://macos-defaults.com/
  system.defaults = {

    NSGlobalDomain = {
      # Disables the accent popup that appears when holding a char down, allowing repeats
      ApplePressAndHoldEnabled = false;

      # Fast key char repeats
      InitialKeyRepeat = 15;
      KeyRepeat = 1;

      NSAutomaticCapitalizationEnabled = false;
      NSAutomaticDashSubstitutionEnabled = false;
      NSAutomaticPeriodSubstitutionEnabled = false;
      NSAutomaticQuoteSubstitutionEnabled = false;
      NSAutomaticSpellingCorrectionEnabled = false;
      NSDocumentSaveNewDocumentsToCloud = false;
      NSNavPanelExpandedStateForSaveMode = true;
      NSNavPanelExpandedStateForSaveMode2 = true;

      AppleKeyboardUIMode = 2;
      "com.apple.keyboard.fnState" = true;
    };

    hitoolbox = {
      # AppleFnUsageType = "Do Nothing";
      AppleFnUsageType = "Show Emoji & Symbols";
    };

    SoftwareUpdate = {
      AutomaticallyInstallMacOSUpdates = false;
    };

    CustomSystemPreferences = {

    };

    CustomUserPreferences = {

      # Look up SymbolicHotKeyNumbers here: https://github.com/NUIKit/CGSInternal/blob/master/CGSHotKeys.h
      # Or here: https://gist.github.com/mkhl/455002#file-ctrl-f1-c-L12
      # Or here: https://macos-defaults.com/
      "com.apple.symbolichotkeys" = {
        AppleSymbolicHotKeys = {
          # Disable '^ + Space' for selecting the previous input source
          "60" = {
            enabled = false;
          };
          # Disable '^ + Option + Space' for selecting the next input source
          "61" = {
            enabled = false;
          };
          # Disable 'Cmd + Space' for Spotlight Search
          "64" = {
            enabled = false;
          };
          # Disable 'Cmd + Alt + Space' for Finder search window
          "65" = {
            enabled = false;
          };
        };
      };
    };

    spaces = {
      # Helps Aerospace work better with multiple monitors
      # https://nikitabobko.github.io/AeroSpace/guide#a-note-on-displays-have-separate-spaces
      spans-displays = true;
    };

    dock = {
      autohide = true;
      showhidden = true;

      # Helps Aerospace work better with Mission Control
      # https://nikitabobko.github.io/AeroSpace/guide#a-note-on-mission-control
      expose-group-apps = true;
    };

    finder = {
      AppleShowAllExtensions = true;
      FXEnableExtensionChangeWarning = false;
      QuitMenuItem = true;
    };
  };

  # Environment configuration
  environment.variables = {
    LANG = "en_US.UTF-8";
    HOMEBREW_BUNDLE_FILE = "~/Brewfile";
    FOO = "BAR";
    SSH_AUTH_SOCK = "~/Library/Group\ Containers/2BUA8C4S2C.com.1password/t/agent.sock";
  };

  # System packages
  environment.systemPackages = with pkgs; [
    curl
    direnv
    git
    jq
    openssh
    wget
    yq-go
    fswatch
    zsh
    zsh-completions
    nixfmt-rfc-style
    nixd
    fnm
    fzf
    flutter
    ruby
    cocoapods
    serverless
    turbo
  ];

  # Disable the default compinit call that nix adds to each zsh env
  # We will be customising our call, to ensure it's at the end
  # of the .zshrc and only rebuilds .zcompdump when needed.
  programs.zsh.enableGlobalCompInit = false;

  # todo: use this somehow to install yabai's SA?
  # ref: https://github.com/LnL7/nix-darwin/issues/165

  # environment.etc = { }

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
  #   brews = [  ];
  #   casks = [ ];
  # };

  system.activationScripts.activateSettings.text = ''
    # https://apple.stackexchange.com/questions/127246/mavericks-how-to-add-input-source-via-plists-defaults
    defaults write com.apple.HIToolbox AppleEnabledInputSources -array "<dict><key>InputSourceKind</key><string>Keyboard Layout</string><key>KeyboardLayout ID</key><integer>-1534512</integer><key>KeyboardLayout Name</key><string>ABC (no option)</string></dict>"

    # Not all darwin settings are activated after nix-darwin configures them until restart
    # Following line should allow us to avoid a logout/login cycle
    # Inspired by: https://medium.com/@zmre/nix-darwin-quick-tip-activate-your-preferences-f69942a93236
    /System/Library/PrivateFrameworks/SystemAdministration.framework/Resources/activateSettings -u
  '';

  system.primaryUser = "sebastiannemeth";
  users.users.martaver.home = "/Users/martaver";
  users.users.sebastiannemeth.home = "/Users/sebastiannemeth";
  users.users."sebastian.nemeth".home = "/Users/sebastian.nemeth";

  # Allows Terminal to call for TouchID when authorising sudo
  security.pam.services.sudo_local.touchIdAuth = true;
}
