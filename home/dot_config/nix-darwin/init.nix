# Empty system configuration, used for initialising nix-darwin for the first time
# This way, other configuration options won't impact the installation

{ config, pkgs, ... }:

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

  # System packages
  environment.systemPackages = [
    
  ];

}
