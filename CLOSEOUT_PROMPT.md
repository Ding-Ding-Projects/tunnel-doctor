# Closeout prompt

```text
Project: Ding-Ding-Projects/tunnel-doctor (public). Branch: main.
Goal: a Windows desktop app, a Docker-hosted web app and an appliance OS image,
all sharing core/ and web/, that diagnose and fix Cloudflare Tunnel, DNS and
Home Assistant reverse-proxy problems, with the maintainer's full required
feature inventory (see ROADMAP.md Phase 3).

Done and verified: 20 unit tests pass; checks run end to end against a real
tunnel; build.bat and build-installer.bat succeed on Windows; CI publishes
normal releases with the Squirrel installer; the ghcr image starts healthy via
compose.yaml and answers on the LAN; the project site is live and set as the
repository homepage.

Open: appliance CI build failing (last change: docker pull + linuxkit build
--docker); installed desktop window not launched or captured; host.bat --logs
not driven; Docker-hosted setup wizard missing; most of ROADMAP Phase 3.

Next: make appliance.yml green and boot it in QEMU; install and capture the
desktop release; build the setup wizard; continue Phase 3. Keep every new
fix behind preview plus two-key confirmation, and keep tokens out of logs.
```
