# Realtime (socket.io) server

Pushes chat messages and "something changed" signals to open browsers instantly. It stores
nothing: the Next app saves everything in Postgres, then calls this server's `POST /emit`. If this
server is down or not deployed, the app still works — browsers poll `/api/live` every 20 seconds and
an open chat every 3 seconds. Design: [docs/collaboration-plan.md](../docs/collaboration-plan.md) §12.

```
browser ──(socket.io, token from /api/realtime/token)──► realtime server
Next app ──(POST /emit, Bearer REALTIME_SECRET)────────► realtime server ──► user:<id> rooms
```

## Environment

| Variable | Where | Meaning |
|---|---|---|
| `REALTIME_SECRET` | Next app **and** this server | the same long random string (≥ 16 chars), e.g. `openssl rand -base64 32` |
| `REALTIME_URL` | Next app (server side) | how the Next server reaches this server, e.g. `http://localhost:4000` or `https://rt.example.com` |
| `NEXT_PUBLIC_REALTIME_URL` | Next app (browser) | how browsers reach it — usually the same public URL |
| `REALTIME_ALLOWED_ORIGINS` | this server | comma-separated app origins, e.g. `http://localhost:3000,https://your-app.vercel.app` |
| `PORT` | this server | default `4000` |

Leave `REALTIME_SECRET` / `NEXT_PUBLIC_REALTIME_URL` unset in the Next app to run without sockets
(polling only).

## Run locally

Add to `.env`:

```
REALTIME_SECRET=<random string>
REALTIME_URL=http://localhost:4000
NEXT_PUBLIC_REALTIME_URL=http://localhost:4000
REALTIME_ALLOWED_ORIGINS=http://localhost:3000
```

Then, next to `pnpm dev`: `pnpm realtime` (Node 22.6+; it runs the TypeScript directly).
Check: `curl http://localhost:4000/health` → `{"ok":true,"connections":N}`.

## Deploy on a VPS (later)

1. Node 22+ on the server; clone the repo, `pnpm install --prod=false`.
2. Put the variables above in the server's `.env` (or the service's environment).
3. Keep it running, e.g. with systemd:

   ```ini
   # /etc/systemd/system/prep-realtime.service
   [Service]
   WorkingDirectory=/srv/prep
   ExecStart=/usr/bin/node --experimental-strip-types --env-file-if-exists=.env realtime/server.mts
   Restart=always
   Environment=NODE_ENV=production
   [Install]
   WantedBy=multi-user.target
   ```

   or `pm2 start "pnpm realtime" --name prep-realtime`.
4. Put it behind HTTPS (browsers on the https app can't use plain `ws://`). nginx needs the
   websocket upgrade headers:

   ```nginx
   location / {
     proxy_pass http://127.0.0.1:4000;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header Host $host;
   }
   ```
5. In Vercel, set `REALTIME_SECRET`, `REALTIME_URL` and `NEXT_PUBLIC_REALTIME_URL` (the public
   https URL), then redeploy (the `NEXT_PUBLIC_` value is built into the browser bundle).

One instance is enough for this app. Several instances would need the socket.io Redis adapter so
an `/emit` reaches users connected to any of them.
