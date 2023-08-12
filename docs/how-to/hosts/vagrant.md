# Vagrant

Vagrant provisions Virtual Machines (VMs) from ISOs / Boxes on a variety of Providers, such as Paralles, AWS, GCP.

## General commands

```sh
vagrant up
vagrant destroy
```

## Find boxes for ARM64 / Parallels

https://app.vagrantup.com/boxes/search?provider=parallels&q=arm


## Build a new Vagrant MacOS Base Box

1. Create a MacOS VM (can be scripted): https://kb.parallels.com/125561/
2. Set up the new VM so it can be controlled by `vagrant` (set sudoers, install parallels tools etc.)
3. Package the new VM as a Box

You can then use `vagrant init <box>` to create a workspace that provisions a VM from it.

Docs: http://parallels.github.io/vagrant-parallels/docs/boxes/base_macos.html