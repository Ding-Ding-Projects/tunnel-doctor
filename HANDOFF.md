# Handoff

## State on 2026-11-15

Tunnel Doctor diagnoses why a Cloudflare Tunnel hostname is unreachable and
applies fixes after a two-key confirmation. One shared core (`core/`) and one
shared interface (`web/`) feed three delivery forms.

### Works and verified

- `npm test`: 20 tests pass (core checks and fixes against a fake network,
  service layer, hosted server security, interface text coverage).
- Checks run end to end against a real tunnel hostname and a real
  Home Assistant origin through the hosted server.
- `build.bat` and `build-installer.bat` run to success on Windows 11 with
  Node 26 installed (packaging and the Electron download run on Node 22).
- CI publishes a normal GitHub release with `TunnelDoctorSetup.exe`, `RELEASES`
  and the full `.nupkg` on every push to `main` (verified on build 2).
- The container image is published to
  `ghcr.io/ding-ding-projects/tunnel-doctor`, labelled with its commit, and
  starts healthy through `compose.yaml`; the LAN URL was fetched from a second
  machine on the network.
- The project site is live at https://ding-ding-projects.github.io/tunnel-doctor/
  and the repository homepage points at it.

### Not done or not verified

- The appliance image build fails in CI; it has never booted. The latest
  change pulls the image into Docker first and builds with `linuxkit build --docker`.
- The installed desktop app has not been launched or captured; only the web
  interface has been captured.
- `host.bat --logs` and its menu were not driven.
- The portable setup wizard for the Docker-hosted form does not exist yet.
- Most of the required feature inventory in `ROADMAP.md` Phase 3 is open.

### Gotchas found while building

- Some Windows machines set `NoDefaultCurrentDirectoryInExePath`, so `cmd`
  will not run `build.bat` from the current folder by bare name. The scripts
  call each other through `%~dp0`; run them as `.\build.bat`.
- Under Node 23 and newer, Electron's zip extraction (both `npm install` of
  `electron` and Forge packaging) stops part-way and still exits with success.
- Home Assistant answers 400 to `X-Forwarded-For` from any untrusted address,
  so that check compares against the public path before calling it a failure.
- LinuxKit resolved the `ghcr.io` image reference against Docker Hub.

## Next steps

1. Get the appliance workflow green and boot the ISO in QEMU.
2. Install the release on Windows, drive it, and capture the desktop window.
3. Build the portable setup wizard for the Docker-hosted form.
4. Work through `ROADMAP.md` Phase 3.
