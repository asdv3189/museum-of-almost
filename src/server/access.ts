import { timingSafeEqual } from "node:crypto";
import { MuseumError } from "../domain/model";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function authorizeWorkbench(request: Request): void {
  const url = new URL(request.url);
  const rawHost = request.headers.get("host");
  let authority: URL;
  try {
    authority = new URL(`${url.protocol}//${rawHost}`);
    if (
      !rawHost ||
      !/^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::[0-9]{1,5})?$/i.test(rawHost) ||
      authority.username ||
      authority.password
    )
      throw new Error();
  } catch {
    throw new MuseumError(
      "HOST_REJECTED",
      "A valid museum host is required.",
      403,
    );
  }
  const origin = request.headers.get("origin");
  // NextRequest normalizes loopback URL hosts to localhost. Host retains the
  // browser's actual authority, so use it without equating different origins.
  if (request.method !== "GET" && (!origin || origin !== authority.origin)) {
    throw new MuseumError(
      "ORIGIN_REJECTED",
      "This action must come from the museum on the same origin.",
      403,
    );
  }
  if ((process.env.MUSEUM_STORAGE ?? "local") === "local") {
    if (!LOOPBACK.has(url.hostname) || !LOOPBACK.has(authority.hostname)) {
      throw new MuseumError(
        "LOCAL_ONLY",
        "The local curator room is available on loopback only.",
        403,
      );
    }
    return;
  }
  const expected = process.env.MUSEUM_CURATOR_KEY;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expectedBytes = Buffer.from(expected ?? "");
  const providedBytes = Buffer.from(provided);
  if (
    !expected ||
    expected.length < 32 ||
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    throw new MuseumError(
      "CURATOR_AUTH_REQUIRED",
      "Enter the curator access key to open the connected workspace.",
      401,
    );
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof MuseumError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  // Provider errors can contain request details; never forward or log their bodies.
  return Response.json(
    {
      error:
        "The museum could not complete that request. Your last confirmed save is preserved.",
      code: "SERVICE_UNAVAILABLE",
    },
    { status: 503 },
  );
}
