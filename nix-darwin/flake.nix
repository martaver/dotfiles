{
  description = "Hosts";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    darwin.url = "github:lnl7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      darwin,
      home-manager,
    }:
    {

      # "Sebastians-MBP" (default for unnamed MBP install)
      darwinConfigurations."default" = darwin.lib.darwinSystem {
        system = "aarch64-darwin"; # Apple Silicon
        # system = "x86_64-darwin"; # Intel
        modules = [
          ./system.nix
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users.sebastiannemeth = import ./home.nix;
          }
        ];
      };
    };
}
