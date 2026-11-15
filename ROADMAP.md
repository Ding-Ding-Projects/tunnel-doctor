# Roadmap

A box is ticked only when the item is implemented, verified, and, for anything
visible, captured from the real built app. Unticked items say what state they
are in. Nothing is deleted to make the list look shorter; dropped items move to
"Deliberately not doing" with the reason.

## Phase 1: Diagnosis core

- [x] Public DNS check over DNS-over-HTTPS against two resolvers, including the
      unproxied tunnel record that hands out a private address
- [x] Zone record check: missing record, wildcard-only coverage, unproxied
      tunnel CNAME
- [x] Tunnel connector health and connection count
- [x] Tunnel public hostname route (remote-managed configuration)
- [x] Public edge probe with error 1033, 502/530 and 400 classification
- [x] Origin reachability with refused / unreachable / timeout / DNS / TLS told apart
- [x] Home Assistant forwarded-header (`trusted_proxies`) check
- [x] Zone SSL mode check
- [x] Local resolver cache check (desktop app only)
- [x] Tunnel token visible in a process command line (desktop app only)
- [x] Fixes with preview, two-key confirmation and undo: turn on proxy, create
      record, add tunnel route, flush local DNS cache
- [x] Unit tests replaying a real outage with a fake network (`npm test`)

## Phase 2: Three delivery forms from one core

- [ ] Desktop app (Windows): written, not yet built or launched
- [ ] Docker-hosted web app with login, `compose.yaml`, published image,
      `host.bat --detached` / `--logs`, portable setup wizard and verified LAN URL:
      not started
- [ ] Appliance OS image that boots straight into the Docker-hosted web app:
      not started
- Features that only work in the desktop app, and why:
  - Local resolver cache check and flush: they read and clear the DNS cache of
    the computer the app runs on. In the hosted forms that computer is the
    server, not the visitor's, so the result would be misleading. Shown
    disabled with this reason.
  - Token exposure scan: it reads the local process list. Same reason.

## Phase 3: Required feature inventory

Every item below applies to the desktop app, both hosted forms and the project
site unless the line says otherwise.

### Language, voice and personalization
- [ ] Language modes: English, Cantonese, both side by side
- [ ] Two independent funny-level sliders (1 to 5, default 5) and the emoji switch
- [ ] Local personal-wording JSON upload in Settings
- [ ] Drop a personal-wording JSON anywhere on the window
- [ ] School mode
- [ ] Spoken narrator (off by default) and voice pickers
- [ ] Action sound effects with a Settings switch
- [ ] Scheduled and external settings sources
- [ ] Renaming the app
- [ ] Focus (ADHD) modes
- [ ] Dim sum surprise
- [ ] Public dim sum photo source
- [ ] Default job-related product wording (not applicable: the app has no job-history documents; recorded here so it is not a silent gap)

### Material Design 3, appearance and layout
- [ ] Material Design 3 conformance
- [ ] Workflow navigation and window chrome
- [ ] Motion with a complete reduced-motion path
- [ ] Live charts
- [ ] Per-element appearance editor
- [ ] Infinite colour picker and translator
- [ ] App logo customization
- [ ] Overlays and panels
- [ ] Collapsible filters and statistics
- [ ] Accessibility, sizing and layout without clipping
- [ ] Functional UI and truthful empty states

### Navigation, search and commands
- [ ] Practical in-app onboarding wizard
- [ ] Extension support
- [ ] Browser-style tabs (one workspace tab per hostname profile, explicit New tab catalog)
- [ ] Full regex builder beside every search
- [ ] `Ctrl+Shift+F` command palette
- [ ] Context menu on every element
- [ ] Context menus show working shortcuts
- [ ] Rich controls wherever a value is shown
- [ ] Guided forms
- [ ] Per-control info buttons
- [ ] Settings that explain themselves
- [ ] Presets for blank-slate editors

### Safety, locks and authentication
- [x] Two-key super confirmation (core enforces it for every fix; interface pending)
- [ ] Toy element locks
- [ ] Support Tickets recovery desk
- [ ] Unlock ladder
- [ ] Built-in authenticator
- [ ] QR pairing for authenticator setup
- [ ] Honest monetization (free, no nagging)

### Records, history and messages
- [ ] Local version history (fix history with undo)
- [ ] Export everything in every format
- [ ] Bulk actions
- [ ] Changelog viewer
- [ ] Offline documentation browser
- [ ] Provider-authored text rendered
- [ ] Non-blocking notifications and notification centre

### Built-in tools and hand-off
- [ ] Universal local file converter
- [ ] Base64 toolkit
- [ ] Windows virtual disk manager
- [ ] Minecraft server creator and manager
- [ ] Minecraft world generator
- [ ] Local Ollama suite manager
- [ ] External editor and VS Code hand-off
- [ ] Browser-extension download hand-off (not applicable: no browser extension)
- [ ] Publishing to a forge
- [ ] Progress where it started, recovery where it broke
- [ ] Drawing and annotation

### Completeness and evidence
- [ ] Per-surface completeness inventory and parity
- [ ] Front-screen version and updated-at from build provenance
- [ ] Real screenshots wherever a surface is described
- [ ] Committed screen recording
- [ ] Design-reference parity
- [x] Design surfaces live in the repository (`design/tunnel-doctor-canvas/`)
- [ ] Clipping matrix for every built surface
- [ ] Public screenshot gallery

### Project site
- [ ] Material Design 3 project site carrying every feature
- [ ] Mobile-friendly site
- [ ] Verified installer download on Home
- [ ] One detailed article per feature
- [ ] Vendored fonts
- [ ] Link preview picture
- [ ] Repository About homepage points at the site
- [ ] Personal wording unlock only after authentication (hosted forms)
- [ ] Site also shipped as a portable desktop companion

### Status and hand-off surfaces
- [ ] Status Hub registration
- [ ] Discord status bridge
- [ ] Verified panic dispatch
- [ ] Tidbyt status frames (suspended by the maintainer; not required while suspended)

### Build, packaging and release
- [ ] Root `build.bat` and `build-installer.bat`
- [ ] One fresh-Windows build-and-run command
- [ ] One-click dependency fetcher
- [ ] Bundled dependencies
- [ ] Genuine Squirrel.Windows installer
- [ ] Self-signing only where a format requires it (none currently)
- [ ] Automatic updates
- [ ] Original logo and packaged icon
- [ ] A real release on every push
- [ ] Workflow timing in release notes
- [ ] Line counts in release notes
- [ ] Dim sum photo reference in releases
- [ ] Dim sum release code names
- [ ] CI dependency bootstrap
- [ ] Live runner selection
- [ ] Encrypted public builder (not applicable: the repository is public)
- [ ] Dedicated build GUI companion

### Repository records
- [ ] Tabbed README
- [ ] Human time estimate
- [ ] Sanitized instruction mirror
- [x] Vocabulary-discipline block in `AGENTS.md`
- [ ] Vocabulary hash lock
- [x] `ROADMAP.md` checklist
- [ ] One Markdown file per feature
- [ ] Postman collections for the hosted HTTP API
- [ ] Wiki and site kept current
- [ ] `HANDOFF.md` and the issue handoff section
- [ ] Committed `CLOSEOUT_PROMPT.md`
- [ ] Discussions as the running record
- [ ] Linked GitHub Project
- [ ] Repository operational skill
- [ ] README prompt banner (not applicable: that banner belongs to the private instruction repository)
- [ ] Single-file instruction editions (not applicable: same reason)
- [ ] Project memory folder

## Deliberately not doing

- Roblox model catalogue and Roblox visual realism: this is not a Roblox game.
