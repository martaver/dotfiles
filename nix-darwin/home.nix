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

    #
    # Performance
    # Ref: https://github.com/romkatv/zsh-bench?tab=readme-ov-file
    #
    # This script by romanktv, creator of PowerLevel10k,  has a script
    # that pre-paints your prompt while your shell is loading, giving
    # the impression that it's already loaded.
    # See: https://gist.github.com/romkatv/8b318a610dc302bdbe1487bb1847ad99
    #
    # Currently, the majority of time slowing down the shell init is
    # spent in compdump, compinit, compdef and compaudit.
    # Man for compinit here talks about how to speed up compinit.
    # The -C option skips checks for new completions
    # See: https://zsh.sourceforge.io/Doc/Release/Completion-System.html
    #
    # In our shell, compinit is called by marlonrichert/zsh-autocomplete.
    # zsh-autocomplete can accept arguments to compinit:
    # https://github.com/marlonrichert/zsh-autocomplete?tab=readme-ov-file#pass-arguments-to-compinit
    #
    # This script shows a technique that passes the -C arg to compinit unless
    # a .zcompdump file is detected that's less than 24 hours old.
    # See: https://gist.github.com/ctechols/ca1035271ad134841284#gistcomment-2308206
    #
    # We could create a script that conditionally sets zstyle to pass compinit
    # args for zsh-autocomplete with the same logic.
    #
    # A more comprehensive solution, though, is to find out why compinit is dumping
    # completions every time we init shell, even though .zcompdump has already been created.
    #
    # Does the -C argument even result in a speedup?
    #
    # zsh-bench can be used to measure shell responsiveness times.
    # See: https://github.com/romkatv/zsh-bench
    #
    # ==> benchmarking login shell of user sebastiannemeth ...
    # creates_tty=0
    # has_compsys=1
    # has_syntax_highlighting=1
    # has_autosuggestions=1
    # has_git_prompt=1
    # first_prompt_lag_ms=1068.029
    # first_command_lag_ms=1083.249
    # command_lag_ms=57.665
    # input_lag_ms=19.864
    # exit_time_ms=921.738
    #
    # Which is about 10x higher than the minimum perceivable prompt init time.
    #
    # We should take a look with zprof, to figure out whether duplicate calls to compinit
    # are being made, and why the .zcompdump cache is being busted every time.
    #
    # It looks like 1 call to compinit with 976 calls to compdef, so we're not duping calls.
    #
    # The list of known completions is stored in the associative array _comps.
    # From: https://stackoverflow.com/questions/40010848/how-to-list-all-zsh-autocompletions
    # The following script can list all completions: ./list-completions.sh
    #
    # zsh's built-in list of completions can be found here...
    # See: https://github.com/zsh-users/zsh/tree/master/Completion/Unix/Command
    #
    # Additional completions can be found here...
    # See: https://github.com/zsh-users/zsh-completions
    #
    # As per: https://mikebian.co/git-completions-tooling-on-the-command-line/
    # - You can see the full completion mapping in ~/.zcompdump
    # - You can uninstall completions within a shell session by removing them from the _comp variable, or by removing the completion file in $fpath
    # - You can find a completion’s location using fd '_git$' $fpath
    # This link has a lot of good tips.
    #
    # In this StackExchange article complaining of slow zsh startups, the author loads 800+
    # completions from compdef in a 10th of the speed.
    #
    # This suggests something's wrong with compinit, for it to be taking so long.
    #
    # More speed suggestions here: https://scottspence.com/posts/speeding-up-my-zsh-shell
    #
    # I did get one super fast compinit after playing with the extra compinit -C below
    #
    # It's possible zsh-autocomplete isn't calling compinit. Disabling it to see if something else is calling it.
    # It's not zsh-autocomplete that's doing it.
    #
    # It's likely nix or oh-my-zsh, and it's doing it before completion plugins are loaded.
    # Also good advice here: https://dev.to/djmoch/zsh-compinit--rtfm-47kg
    #
    # It's oh-my-zsh that's running compinit, but without zsh-autocomplete it's instant.
    # Also, disabling omz removes the call to compinit.
    #
    # It's zsh-autocomplete that's slowing down the compinit call.
    #
    # Must be that's just the way it is, because it does a lot of work.
    # Probably, a better alternative to home-manager is to symlink dotfiles,
    # and use 'znap' again to set up starship / oh-my-zsh etc as per this example:
    # https://github.com/marlonrichert/zsh-snap/blob/main/.zshrc
    #
    # znap loads shell plugins asynchronously and compile / evals them to speed up shell init.
    # Let's try to get a set up working with znap, and load the ssh-agent omz plugins.
    #
    # Uncomment this to run the shell profile
    # to identify what's slowing down shell initialisation
    zprof.enable = false;

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

        # Adds real-time lookahead command and history autocompletion.
        # Ref: https://github.com/marlonrichert/zsh-autocomplete
        "zsh-autocomplete"

        # Adds basic syntax highlighting when viewing scripts in zsh.
        # Ref: https://github.com/zsh-users/zsh-syntax-highlighting.git
        # (Must be last according to docs)
        "zsh-syntax-highlighting"
      ];
      # theme = "";
      extraConfig = ''
        # Configures ssh-agent
        #   lazy: evaluates identities when requested
        #   agent-forwarding yes: enable agent-forwarding by default 
        zstyle :omz:plugins:ssh-agent lazy agent-forwarding yes

        # -C sets compinit to skip checking / rebuilding the .zcompdump
        # file if it already exists.
        # other available args: -w -D -i -u 
        zstyle '*:compinit' arguments -C -u
      '';
    };

    shellAliases = {
      ".." = "cd ..";
      "..." = "cd ../..";
      cm = "chezmoi";
      foo = "echo bar";
      zsh-bench = "~/zsh-bench/zsh-bench";
    };

    initExtra = ''
      # Configures the active shell to use fnm
      # If you get the following error, it's because this wasn't called:
      # error: `fnm env` was not applied in this context.
      # Can't find fnm's environment variables
      eval "$(fnm env --use-on-cd --shell zsh)"

      # Install docker completions
      mkdir -p ~/.oh-my-zsh/completions
      docker completion zsh > ~/.oh-my-zsh/completions/_docker

      # WARN: This next compinit doubles up what zsh-autocomplete inits, it's just for debugging performance.
      # When uncommented, zprof will show two calls to compinit
      # autoload -Uz compinit && compinit -C -u # no cache, no security check
      # autoload -Uz compinit && compinit

      # This snippet pre-compiles the .zcompdump file for slightly faster loads.
      # https://news.ycombinator.com/item?id=40128826
      {
        # Compile the completion dump to increase startup speed. Run in background.
        zcompdump="''${"ZDOTDIR:-$HOME"}/.zcompdump"
        if [[ -s "$zcompdump" && (! -s "''${zcompdump}.zwc" || "$zcompdump" -nt "''${zcompdump}.zwc") ]]; then
          # if zcompdump file exists, and we don't have a compiled version or the
          # dump file is newer than the compiled file
          zcompile "$zcompdump"
        fi
      } &!

      export SSH_AUTH_SOCK=~/Library/Group\ Containers/2BUA8C4S2C.com.1password/t/agent.sock
    '';
  };
}
