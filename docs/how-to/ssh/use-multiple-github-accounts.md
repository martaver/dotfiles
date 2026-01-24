# Configure git to use multiple github accounts

`onepassword` stores the private keys, and `onepassword ssh-agent` provides private keys on request.

`id_*.pub` are public keys, identifying identities stored in onepassword. They don't contain the private key themselves.

`ssh -i ~/.ssh/id_*.pub` is a way to tell ssh which identity to look for in `ssh-agent`, by matching the private key to the public one.

using `ssh -i` in a local `.gitconfig` allows specifying which ssh-agent private key to use for a dir


`ssh-agent`               Use `1password` - stores and provides access to private keys


`~/.ssh/config`           Redirects everything to 1password ssh-agent. 
```bash
                          Host *
                            IdentityAgent "~/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock"
```


`ssh-add -l`              Check `ssh-agent` has access to keys in `1password` (they should be listed)
                          If they're not accessible it will say `The agent has no identities`.



`id_*.pub`                This is a Public key - identifies which identity should be used in `ssh-agent`



`ssh -i id_*.pub`         Specify to `ssh` command which identity in `ssh-agent` should be used



`~/.gitconfig`            Common `git` settings + per-directory settings:
```toml
                          [includeIf "gitdir:~/my_dir/"]
                          path = ~/my_dir/.gitconfig
```


`~/my_dir/.gitconfig`     Specifies `ssh` identity to use for that dir:
```toml
                          [core]
                            sshCommand = "ssh -i ~/.ssh/id_my_dir.pub -o IdentitiesOnly=yes"
```


You may need to ensure you:
```bash
                          export SSH_AUTH_SOCK=~/Library/Group\ Containers/2BUA8C4S2C.com.1password/t/agent.sock
```