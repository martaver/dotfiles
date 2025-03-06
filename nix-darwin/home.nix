{
  config,
  pkgs,
  machnix,
  ...
}:
let
in
{
  # User-specific packages
  home.stateVersion = "23.11";
  home.packages = with pkgs; [
    chezmoi
    starship
    gh

    # pkgs.any-nix-shell
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
      format = "$all";
      add_newline = true;
    };
  };

  programs.zsh = {
    enable = true;

    # Uncomment this to run the shell profile
    # to identify what's slowing down shell initialisation
    # zprof.enable = true;

    # Extra environment variables
    envExtra = ''
      # Load exports
      # source $HOME/.yabai/.fns

      # This directs oh-my-zsh to look for custom plugins in the dir
      # where we clone plugins that aren't included in their own plugin
      # repository.
      ZSH_CUSTOM="$HOME/.oh-my-zsh/custom"
    '';

    # Required to be disabled when using 'marlonrichert/zsh-autocomplete'
    # See: https://github.com/marlonrichert/zsh-autocomplete?tab=readme-ov-file#installation--setup
    enableCompletion = false;

    oh-my-zsh = {
      enable = true;
      plugins = [
        # This plugin ensures ssh-agent is enabled when entering a shell.
        # Ref: https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/ssh-agent
        #
        # This is what makes ~/.ssh/config take effect and use
        # 1Password ssh-agent for identities and biometrics for auth
        "ssh-agent"

        # Adds an interactive chooser for 'cd'.
        # Ref: https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/zsh-interactive-cd
        #
        # Type 'cd ' + TAB to display it
        # - use Up/Down Tab/Shift-Tab to scroll
        # - use ENTER to select
        # - press TAB again to continue choosing from the next dir
        "zsh-interactive-cd"

        #
        # Custom Plugins
        #
        # We install these through omz rather than by enabling them
        # in home-manager's zsh options, so that omz can manage their
        # initialisation. This prevents plugins from conflicting
        # with others installed by other plugin manages, e.g. with
        # zsh-autocomplete, which has no native omz package.
        # They are clones into ~/.oh-my-zsh/custom/plugins by chezmoi.

        # Adds completions for pnpm.
        # Ref: https://github.com/g-plane/pnpm-shell-completion
        #
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
        "pnpm-shell-completion"

        # Adds inline historical command suggestions as you type.
        # Ref: https://github.com/zsh-users/zsh-autosuggestions.git
        "zsh-autosuggestions"

        # Adds basic syntax highlighting when viewing scripts in zsh.
        # Ref: https://github.com/zsh-users/zsh-syntax-highlighting.git
        "zsh-syntax-highlighting"

        # Adds real-time lookahead command and history autocompletion.
        # Ref: https://github.com/marlonrichert/zsh-autocomplete
        "zsh-autocomplete"
      ];
      # theme = "";
      extraConfig = ''
        # Configures ssh-agent
        #   lazy: evaluates identities when requested
        #   agent-forwarding yes: enable agent-forwarding by default 
        zstyle :omz:plugins:ssh-agent lazy agent-forwarding yes
      '';
    };

    shellAliases = {
      ".." = "cd ..";
      "..." = "cd ../..";
      cm = "chezmoi";
      foo = "echo bar";
    };

    initExtra = ''
      # Configures the active shell to use fnm
      # If you get the following error, it's because this wasn't called:
      # error: `fnm env` was not applied in this context.
      # Can't find fnm's environment variables
      eval "$(fnm env --use-on-cd --shell zsh)"
    '';
  };
}
