{
  description = "Architeuthis";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    darwin.url = "github:lnl7/nix-darwin";
    darwin.inputs.nixpkgs.follows = "nixpkgs";
    # home-manager.url = "github:nix-community/home-manager";
    # home-manager.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, darwin, home-manager }: {
    darwinConfigurations."Architeuthis" = darwin.lib.darwinSystem {      
      # system = "aarch64-darwin";  # Apple Silicon
      system = "x86_64-darwin"; # Intel
      modules = [
        ./configuration.nix                                
        # home-manager.darwinModules.home-manager
        # {
        #   home-manager.useGlobalPkgs = true;
        #   home-manager.useUserPackages = true;
        #   # home-manager.users.martaver = import ./home.nix;
        # }
      ];
    };
  };
}
