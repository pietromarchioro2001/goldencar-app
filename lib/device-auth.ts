import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Defense-in-depth for sensitive API handlers. Middleware also validates this
 * cookie, but each data/cost-bearing handler verifies it independently.
 */
export async function isDeviceRequestAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.GOLDENCAR_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)goldencar_device=([^;]*)/);
  let token = "";
  try {
    token = match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch {
    return false;
  }
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const supplied = token.slice(separator + 1);
  if (!/^\d{10}$/.test(payload) || !supplied) return false;

  const expiresAt = Number(payload);
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now || expiresAt > now + 30 * 86400 + 60) return false;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}
