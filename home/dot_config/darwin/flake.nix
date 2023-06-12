{
  description = "Architeuthis";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    darwin.url = "github:lnl7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    nix-index-database.url = "github:Mic92/nix-index-database";
    nix-index-database.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, darwin, home-manager, nix-index-database }:  
  let
    # sys = "aarch64-darwin";  # Apple Silicon
    sys = "x86_64-darwin"; # Intel
    pkgs = nixpkgs.legacyPackages.${sys};
  in {
    darwinConfigurations."Architeuthis" = darwin.lib.darwinSystem {              
      system = sys;
      modules = [
        ./configuration.nix                                
        home-manager.darwinModules.home-manager
        {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
          home-manager.users.sebastiannemeth = import ./home.nix;
        }
      ];
    };
    homeConfigurations.sebastiannemeth = home-manager.lib.homeManagerConfiguration {
      inherit pkgs;

      modules = [
        nix-index-database.hmModules.nix-index
        # optional to also wrap and install comma
        # { programs.nix-index-database.comma.enable = true; }
      ];
    };
  };  
}
