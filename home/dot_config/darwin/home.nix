{ config, pkgs, machnix, ... }:
let
  chezmoi = pkgs.callPackage ./packages/chezmoi.nix { };  
in
{
  # User-specific packages
  home.stateVersion = "23.11";
  home.packages = [
    chezmoi    
    # pkgs.any-nix-shell        
    # pkgs.gh    
    # pkgs.oh-my-zsh    
    # pkgs.pure-prompt
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

  # # zsh configuration
  programs.zsh = {
    enable = true;
  #   enableAutosuggestions = true;
  #   enableSyntaxHighlighting = true;
  #   oh-my-zsh = {
  #     enable = true;
  #     plugins = [        
  #       "gh"
  #       "git"
  #       "macos"
  #       "ssh-agent"
  #       "sudo"        
  #       "vscode"
  #     ];
  #     theme = "";
  #     extraConfig = ''
  #       zstyle :omz:plugins:ssh-agent lazy yes
  #     '';
  #   };

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
    envExtra = ''
      # Load exports
      source $HOME/.yabai/.fns
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