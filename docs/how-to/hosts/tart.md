# Tart

Tart runs MacOS and Linux VMs (only) on Apple Silicon, using Apple's `Virtualization.Framework` for near-native performance.

Tart is an alternative to Parallels.

Tart can run images created using Packer.

It lacks quality-of-life UX features that Parallels offers, such as:
- automatic display resizing
- multi-monitor support
- copy/paste between host/guest

It's most useful for automatic builds (CI) and running tests.

## General commands

Pull image: `tart clone <repo> <image_name>`
Run image: `tart run <image_name>` (in recovery mode `---recovery`)

## Saving 'snapshots'

Tart doesn't save layered snapshots the way Parallels does.

Instead, you can:
- shut down a VM to preserve its state, then 
- clone its image with `tart clone <vm_name> <snapshot_name>`

You can then `tart run <snapshot_name>` to boot a VM at that state.

Source: https://github.com/cirruslabs/tart/discussions/485