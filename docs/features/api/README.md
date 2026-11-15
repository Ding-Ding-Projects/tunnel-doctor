# HTTP API (hosted forms)

The Docker-hosted web app and the appliance image expose the shared service in
`core/service.js` over HTTP. The desktop app exposes the same operations over
IPC with the same names, so the interface code in `web/` is identical in every
form.

All routes are under `/api`, take and return JSON, and require a signed-in
session cookie except `GET /api/health`, `GET /api/auth/state`,
`POST /api/auth/setup` (only while no password exists) and `POST /api/auth/login`.

| Method | Route | Body | Returns | Service call |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | | `{ ok: true, version }` | |
| GET | `/api/auth/state` | | `{ configured, signedIn }` | |
| POST | `/api/auth/setup` | `{ password }` | `{ signedIn: true }` | |
| POST | `/api/auth/login` | `{ password }` | `{ signedIn: true }` | |
| POST | `/api/auth/logout` | | `{ signedIn: false }` | |
| GET | `/api/capabilities` | | capabilities object | `capabilities()` |
| GET | `/api/settings` | | settings | `getSettings()` |
| PATCH | `/api/settings` | partial settings | settings | `updateSettings(patch)` |
| POST | `/api/settings/reset` | `{ keys?: string[] }` | settings | `resetSettings(keys)` |
| GET | `/api/token` | | `{ saved }` | `tokenStatus()` |
| PUT | `/api/token` | `{ token }` | `{ saved, zones }` | `saveToken(token)` |
| DELETE | `/api/token` | | `{ saved: false }` | `clearToken()` |
| GET | `/api/zones` | | `[{ id, name, status }]` | `zones()` |
| POST | `/api/checks` | `{ hostname, originUrl? }` | report | `runChecks(input)` |
| GET | `/api/checks/last` | | report or `null` | `lastReport()` |
| POST | `/api/fixes/plan` | `{ fixId, params }` | plan | `planFix(fixId, params)` |
| POST | `/api/fixes/apply` | `{ fixId, params, confirmation: { acknowledged, typed } }` | history entry | `applyFix(...)` |
| POST | `/api/fixes/undo` | `{ historyId }` | history entry | `undo(historyId)` |
| GET | `/api/history` | | history list | `history()` |

Errors return `{ error: "<message>" }` with status 400 for invalid input, 401
when signed out, 403 for a missing CSRF header, and 502 when Cloudflare refuses
a call.

## Security

- The API token is never returned by any route. It is stored encrypted at rest
  under a key derived from a server secret kept outside the data volume.
- Every state-changing request needs the header `x-tunnel-doctor: 1`, which a
  cross-site form cannot send.
- Passwords are hashed with scrypt; sign-in attempts are rate limited.
- The service binds to the LAN and is not meant to be exposed to the Internet.
