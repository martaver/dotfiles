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
        {
          # pnpm's completions for zsh out of the box don't work (as of v10)
          #
          # As a result, when typing pnpm commands, zsh-autocomplete lags trying
          # to find completion files that are apparently broken
          # See: https://github.com/pnpm/pnpm/issues/4564
          # See: https://github.com/pnpm/pnpm/issues/7986
          #
          # And on pnpm 9's completions being incompatible with pnpm 10
          # See: https://pnpm.io/completion
          #
          # This third party zsh plugin install working pnpm completions
          # and also solves the lagging issue
          name = "g-plane/pnpm-shell-completion"; 
          tags = [ hook-build:./zplug.zsh defer:2 ];
        }
      ];
    };

    oh-my-zsh = {
      enable = true;
      plugins = [
        "ssh-agent"
        # "sudo"
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

      eval "$(fnm env --use-on-cd --shell zsh)"

      # zstyle ':autocomplete:*' min-input 3
      # zstyle -e ':autocomplete:*:*' list-lines 'reply=( $(( LINES / 3 )) )'

      # export SSH_AUTH_SOCK=~/Library/Group\ Containers/2BUA8C4S2C.com.1password/t/agent.sock
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
