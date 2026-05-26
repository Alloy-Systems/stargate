# gateway

Minimal Express 5 + TypeScript starter using `express`, `express-validation`, and `winston`.

## Requirements

- Node.js 22 or newer
- npm

## Install

```bash
npm install
```

## Develop

```bash
npm run dev
```

Starts the server on `http://localhost:4300` with hot-reload via `tsx watch`.

## Build & run

```bash
npm run build
npm start
```

## Type-check only

```bash
npm run typecheck
```

## Run with Docker Compose

The repo ships a [`Dockerfile`](Dockerfile) (multi-stage, runs as non-root) and a [`docker-compose.yml`](docker-compose.yml) that builds the image, loads `.env`, exposes the configured port, and bind-mounts `./logs` for persistent log files.

```bash
docker compose up -d --build    # build image and start in the background
docker compose logs -f          # tail container logs
docker compose down             # stop and remove the container
```

### How environment variables are wired

The compose service uses two mechanisms together:

- `env_file: .env` — every variable from your local `.env` is passed to the container.
- `environment:` block in `docker-compose.yml` — container-specific overrides that take precedence over `.env`. Use this to point the container at services running on the host or to swap secrets without touching `.env`.

The default `environment:` block ships overrides for:

- `LOGS_PATH=/app/logs` — matches the bind-mount target inside the container.
- `ALLOY_API_URL` / `INTERNAL_SYSTEM_URL` — set to `host.docker.internal` so the container can reach services running on the host. On Linux you may need to add `extra_hosts: ["host.docker.internal:host-gateway"]` to the service.

To override anything ad-hoc at run time, use `-e` with `docker compose run` or add entries under `environment:`. Shell exports also work — compose substitutes `${VAR}` in the file at parse time, which is why `ports: "${PORT:-4300}:${PORT:-4300}"` follows your `.env` automatically.

### Logs

If `LOGS_PATH` is set (it is by default in compose), per-level log files (`error.log`, `warn.log`, `info.log`) appear under `./logs` on the host thanks to the bind-mount. They survive `docker compose down` (bind-mounts are not removed by `down -v`; only named volumes are).

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. `dotenv` loads `.env` from the working directory at startup. Values already set in the process environment (e.g. via `docker run -e VAR=value` or a shell export) take precedence over `.env`.

### Runtime

| Var | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `4300` | HTTP port the gateway listens on |
| `NODE_ENV` | no | `development` | When `production`, winston switches console output from human-readable to JSON |
| `LOG_LEVEL` | no | `info` | winston level: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly` |
| `LOGS_PATH` | no | — | If set, winston also writes per-level files (`error.log`, `warn.log`, `info.log`) into this directory with size-based rotation (10 MB × 10 files per level). Directory is created if missing. |

### Upstream proxy (Alloy)

Used by the `/api/*` proxy route and the stargate task-pull daemon.

| Var | Required | Purpose |
|---|---|---|
| `ALLOY_API_URL` | yes | Base URL of the Alloy upstream. `/api/*` requests are forwarded to `${ALLOY_API_URL}/api/${path}` and the stargate daemon polls `${ALLOY_API_URL}/api/private/stargate/`. |
| `ALLOY_API_KEY` | yes | Sent as `api-key` header on every upstream request (proxy and stargate poll/report). |

### Stargate daemon / TaskProcessor

The background daemon long-polls Alloy for tasks targeted at this system, runs them against the internal service, and reports the result back.

| Var | Required | Purpose |
|---|---|---|
| `INTERNAL_SYSTEM` | yes | Identifier used as the `system` query param when polling stargate. The daemon only receives tasks routed to this system. |
| `INTERNAL_SYSTEM_URL` | yes | Base URL of the internal service. Each task is executed as `${task.method} ${INTERNAL_SYSTEM_URL}${task.uri}` with `task.body` as JSON body. |
| `INTERNAL_AUTHORIZATION_HEADER_NAME` | no | Header name to attach to internal-service requests. Defaults to `Authorization`. |
| `INTERNAL_AUTHORIZATION_HEADER_VALUE` | no | Header value. If either name or value is empty, no auth header is added. Typical value: `Bearer <token>`. |

If any of the three required stargate vars are missing, the daemon logs `stargate_disabled` and stays idle (server still serves HTTP requests).

## Process behavior

- `SIGINT` / `SIGTERM` → graceful shutdown (closes the HTTP server, then exits).
- `uncaughtException` / `unhandledRejection` → logged via winston; the process is NOT terminated. Convenient for a dev starter; reconsider for production — the app may be in an undefined state after these fire.
