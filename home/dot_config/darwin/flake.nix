{
  description = "Architeuthis";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    darwin.url = "github:lnl7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    home-manager.nix-index-database.url = "github:Mic92/nix-index-database";
    home-manager.nix-index-database.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, darwin, home-manager }: {
    darwinConfigurations."Architeuthis" = darwin.lib.darwinSystem {      
      # system = "aarch64-darwin";  # Apple Silicon
      system = "x86_64-darwin"; # Intel
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
    
    homeConfigurations.jdoe = home-manager.lib.homeManagerConfiguration {
      system = "x86_64-darwin";
      nixpkgs.legacyPackages.${system};

      modules = [
        nix-index-database.hmModules.nix-index
        # optional to also wrap and install comma
        # { programs.nix-index-database.comma.enable = true; }
      ];
    };
  };
}
