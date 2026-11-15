# Tunnel Doctor appliance image

A small LinuxKit operating system that boots straight into Tunnel Doctor. It
runs the published container image `ghcr.io/ding-ding-projects/tunnel-doctor`
as its only application, gets its address by DHCP, and serves
`http://<lan-ip>:8080/`. The console prints the address once the network is up.
There is no login shell.

## Build

Install [LinuxKit](https://github.com/linuxkit/linuxkit) (CI pins v1.8.2), then:

```sh
linuxkit build --format iso-efi --dir build tunnel-doctor.yml   # bootable ISO
linuxkit build --format raw-efi --dir build tunnel-doctor.yml   # raw disk image
```

CI builds both and uploads them as workflow artifacts (see
`.github/workflows/appliance.yml`).

## Import

- **Hyper-V**: new Generation 2 VM, 1024 MB or more, attach the ISO (turn off
  Secure Boot, or use the "Microsoft UEFI Certificate Authority" template),
  external switch so it gets a LAN address.
- **Proxmox**: upload the ISO, create a UEFI (OVMF) VM with a VirtIO network
  device on a bridged network, boot from the ISO.
- **VirtualBox**: new Linux 64-bit VM with "Enable EFI" ticked, bridged adapter,
  attach the ISO.

For settings to survive reboots, add a second blank virtual disk. The appliance
formats the first blank disk it finds and mounts it as the data volume. Without
a data disk the appliance still works, but the password and token are lost on
every restart.

Browse to the address shown on the console, then set your password.

## What is and is not verified

- The image tags in `tunnel-doctor.yml` are copied from the LinuxKit v1.8.2
  `docker.yml` example; the LinuxKit binary checksum in CI was computed from
  the real release download.
- **Not yet verified**: that the build succeeds, that the ISO boots, that the
  image runs as the unprivileged user with the data disk, and that the console
  address service prints to the console. The CI workflow performs a headless
  QEMU boot and a health request, and its first green run is the first proof.
- The appliance pulls the published image at build time, so the container image
  workflow must have published a `latest` tag first.
- Keep the encryption key out of the data disk in real deployments: the
  appliance generates one inside the data disk, which protects the token against
  casual reading but not against someone who copies the whole disk.
