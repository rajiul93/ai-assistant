/**
 * socket.io server for instant chat and notification pushes (docs/collaboration-plan.md §12).
 *
 * It holds no data and never touches the database: the Next app saves everything in Postgres and
 * then calls POST /emit (with REALTIME_SECRET) to say which users should hear about it. Browsers
 * connect with a short-lived token from the Next app (/api/realtime/token) and join their own
 * "user:<id>" room. If this server is down, browsers fall back to polling — nothing is lost.
 *
 *   pnpm realtime            (reads .env; PORT defaults to 4000)
 *
 * Env: REALTIME_SECRET (same as the Next app), PORT, REALTIME_ALLOWED_ORIGINS (comma-separated,
 * e.g. "http://localhost:3000,https://your-app.vercel.app").
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Server } from "socket.io";
import { verifyRealtimeToken } from "../src/lib/realtime-token.ts";

const secret = process.env.REALTIME_SECRET;
if (!secret || secret.length < 16) {
  console.error("REALTIME_SECRET is missing or shorter than 16 characters.");
  process.exit(1);
}
const port = Number(process.env.PORT ?? 4000);
const origins = (process.env.REALTIME_ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean);
const MAX_BODY = 64 * 1024;

function authorized(request: IncomingMessage) {
  const given = Buffer.from(request.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage) {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

const http = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return send(response, 200, { ok: true, connections: io.engine.clientsCount });
  if (request.method === "POST" && request.url === "/emit") {
    if (!authorized(request)) return send(response, 401, { error: "unauthorized" });
    try {
      const body = (await readJson(request)) as { userIds?: unknown; event?: unknown };
      const userIds = Array.isArray(body.userIds) ? body.userIds.filter((id): id is string => typeof id === "string" && id.length <= 64).slice(0, 500) : [];
      if (!userIds.length || typeof body.event !== "object" || body.event === null) return send(response, 400, { error: "bad_request" });
      io.to(userIds.map((id) => `user:${id}`)).emit("event", body.event);
      return send(response, 200, { ok: true });
    } catch {
      return send(response, 400, { error: "bad_request" });
    }
  }
  // Everything else is socket.io's (its own path) or not found.
  if (!request.url?.startsWith("/socket.io")) send(response, 404, { error: "not_found" });
});

const io = new Server(http, { cors: { origin: origins }, serveClient: false });

// A browser may join only its own room, proven by the token the Next app signed.
io.use((socket, next) => {
  const userId = verifyRealtimeToken(socket.handshake.auth?.token, secret);
  if (!userId) return next(new Error("unauthorized"));
  socket.data.userId = userId;
  next();
});

io.on("connection", (socket) => {
  void socket.join(`user:${socket.data.userId as string}`);
});

http.listen(port, () => console.log(`realtime: listening on :${port} (origins: ${origins.join(", ")})`));
