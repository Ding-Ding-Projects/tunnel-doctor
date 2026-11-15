# Hosted forms

Tunnel Doctor ships in three forms that share one service layer (`core/`):
the desktop app, the Docker-hosted web app, and a bootable appliance image.
This page covers the last two. The HTTP contract is in
[`../api/README.md`](../api/README.md).

## Docker (published image)

```bat
host.bat                 keyboard menu
host.bat --detached      pull, start, wait for health, print the LAN URL
host.bat --logs          status and live logs (Ctrl+C stops following, containers keep running)
host.bat --stop          stop the containers (the data volume is kept)
```

Or by hand: `docker compose up -d`. `host.bat` never removes volumes. It checks
that Docker and Compose are present, pulls the image, starts the stack, waits up
to 90 seconds for the health check, and prints the address, port and full URL,
for example `http://192.168.1.20:8080/`. Exit codes are nonzero on any failure.

The first visit asks you to set a password (at least 10 characters). Sign-in is
limited to five failures per fifteen minutes per address, and sessions last
seven days in an HttpOnly, SameSite=Strict cookie.

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `TD_PORT` | `8080` | Host port (compose) and listen port (server). |
| `TD_TAG` | `latest` | Image tag compose pulls. |
| `TD_HOST` | `0.0.0.0` | Listen address inside the container. |
| `TD_DATA_DIR` | `/data` | Where settings, history and the encrypted token live. |
| `TD_SECRET_KEY` | none | Encryption key for the stored API token. |
| `TD_SECRET_KEY_FILE` | none | Same, read from a file (Docker secret). |
| `TD_BUILD_TIME` | image build time | Shown as the "updated" time in the app. |

If neither key variable is set the server generates a key in the data volume and
logs a warning. A key outside the volume is safer, because a copy of the volume
alone then cannot decrypt the token. See the commented `secrets:` block in
`compose.yaml`.

## Appliance

See [`../../../appliance/README.md`](../../../appliance/README.md).

## Security notes

- Meant for a trusted LAN. Do not publish the port to the Internet; put it
  behind a VPN or an authenticating reverse proxy if you need remote access.
- The API token is never returned by any route, never logged, and is stored
  encrypted (AES-256-GCM). Request bodies are never logged.
- Every state-changing request requires the header `x-tunnel-doctor: 1`.
- Request bodies are limited to 64 KiB.
- The container runs as an unprivileged user.

## Checks that are off in hosted forms

Two checks read the local computer, which a container or appliance cannot see
truthfully, so they report as skipped there and the capabilities route says so:

- **Local DNS cache**: reads and flushes the operating system resolver of the
  computer running the desktop app. A server resolver says nothing about your
  PC.
- **Local process check** (is `cloudflared` running here): a container sees only
  its own processes.

Every other check (Cloudflare records and tunnel status, public DNS over HTTPS,
origin reachability, Home Assistant proxy settings) works the same in every form.
Note that origin reachability is tested from where the server runs, so use an
origin address the server can reach.
