{
  config,
  pkgs,
  machnix,
  ...
}:
let
in
# chezmoi = pkgs.callPackage ./packages/chezmoi.nix { };
{
  # User-specific packages
  home.stateVersion = "23.11";
  home.packages = [
    pkgs.chezmoi
    pkgs.starship

    # pkgs.any-nix-shell
    pkgs.gh
    # pkgs.thefuck
    # pkgs.tldr
  ];

  # # Enable direnv with nix support
  # programs.direnv = {
  #   enable = true;
  #   nix-direnv = {
  #     enable = true;
  #   };
  # };

  programs.starship = {
    enable = true;

    # Configuration reference: https://starship.rs/config/#prompt

    settings = {

      format = ''$all'';
      add_newline = true;
    };
  };

  # # zsh configuration
  programs.zsh = {
    enable = true;
    autosuggestion.enable = true;
    enableCompletion = false;
    syntaxHighlighting.enable = true;
    zplug = {
      enable = true;
      plugins = [
        {
          name = "marlonrichert/zsh-autocomplete";
        }
      ];
    };
    oh-my-zsh = {
      enable = true;
      plugins = [
        "gh"
        "git"
        "macos"
        "ssh-agent"
        "sudo"
      ];
      theme = "";
      extraConfig = ''
        zstyle :omz:plugins:ssh-agent lazy agent-forwarding yes
      '';
    };

    shellAliases = {
      ".." = "cd ..";
      "..." = "cd ../..";
      cm = "chezmoi";
      foo = "echo bar";
    };

    # plugins = [
    #   {
    #     name = "you-should-use";
    #     src = pkgs.fetchFromGitHub {
    #       owner = "MichaelAquilina";
    #       repo = "zsh-you-should-use";
    #       rev = "1.7.3";
    #       sha256 = "/uVFyplnlg9mETMi7myIndO6IG7Wr9M7xDFfY1pG5Lc=";
    #     };
    #   }
    # ];

    # Extra environment variables
    # envExtra = ''
    #   # Load exports
    #   source $HOME/.yabai/.fns
    # '';

    initExtra = ''
      # A fix for problems with marlonrichert/zsh-autocomplete in nix:
      # as per https://nixos.wiki/wiki/Zsh
      # 
      # bindkey "''${key[Up]}" up-line-or-search

      export SSH_AUTH_SOCK=~/Library/Group\ Containers/2BUA8C4S2C.com.1password/t/agent.sock
    '';

    # # Extra content for .envrc
    # initExtra = ''

    #   # Setup pure
    #   fpath+=${pkgs.pure-prompt}/share/zsh/site-functions
    #   autoload -U promptinit; promptinit
    #   prompt pure
    #   zstyle :prompt:pure:path color green

    #   # Configure thefuck
    #   eval $(thefuck --alias)

    #   # Configure any-nix-shell
    #   any-nix-shell zsh --info-right | source /dev/stdin
    # '';

    # # Extra content for .envrc loaded before compinit()
    # initExtraBeforeCompInit = ''
    #   # Add completions
    #   fpath+=${pkgs.chezmoi}/share/zsh/site-functions
    #   fpath+=${pkgs.google-cloud-sdk}/share/zsh/site-functions
    # '';
  };
}
