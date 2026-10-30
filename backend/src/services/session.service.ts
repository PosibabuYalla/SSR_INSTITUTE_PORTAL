import crypto from "crypto";
import { Types } from "mongoose";
import { Session } from "../models/Session";
import { User } from "../models/User";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { hashToken } from "../utils/tokens";
import { signAccessToken } from "../utils/jwt";
import { recordAudit } from "./auditLog.service";

/** How long the token a session just rotated away from stays acceptable (concurrent tabs). */
const ROTATION_GRACE_MS = 30 * 1000;

/** Refresh cookie value: `<sessionId>.<random secret>`. Only the secret's hash is stored. */
function formatRefreshToken(sessionId: Types.ObjectId | string, secret: string): string {
  return `${String(sessionId)}.${secret}`;
}

function parseRefreshToken(token: string): { sessionId: string; secret: string } | null {
  const [sessionId, secret, extra] = token.split(".");
  if (extra !== undefined || !sessionId || !secret) return null;
  if (!/^[0-9a-f]{24}$/.test(sessionId) || !/^[0-9a-f]{64}$/.test(secret)) return null;
  return { sessionId, secret };
}

function hashesEqual(a: string, b: string | undefined): boolean {
  if (!b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
}

export async function createSession(user: { _id: Types.ObjectId; role: string; status: string }): Promise<IssuedSession> {
  const secret = crypto.randomBytes(32).toString("hex");
  const session = await Session.create({
    user: user._id,
    refreshTokenHash: hashToken(secret),
    expiresAt: new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000),
  });
  return {
    accessToken: signAccessToken({
      sub: String(user._id),
      sid: String(session._id),
      role: user.role as never,
      status: user.status,
    }),
    refreshToken: formatRefreshToken(session._id, secret),
  };
}

/**
 * Exchanges a refresh token for a new access token and rotates the refresh token. Presenting
 * a token that was already rotated away (outside the short concurrency grace window) means it
 * was copied — the whole session is revoked so neither copy keeps working.
 * Returns `refreshToken: null` when the caller's cookie jar already holds the newer token.
 */
export async function refreshSession(
  rawToken: string,
  ipAddress?: string
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const parsed = parseRefreshToken(rawToken);
  if (!parsed) throw ApiError.unauthorized("Invalid or expired refresh token");

  const session = await Session.findById(parsed.sessionId);
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw ApiError.unauthorized("Session has ended. Please log in again.");
  }

  const presented = hashToken(parsed.secret);
  const isCurrent = hashesEqual(presented, session.refreshTokenHash);
  const isRecentPrevious =
    hashesEqual(presented, session.previousRefreshTokenHash) &&
    !!session.rotatedAt &&
    Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;

  if (!isCurrent && !isRecentPrevious) {
    session.revokedAt = new Date();
    await session.save();
    await recordAudit({
      userId: session.user,
      action: "SESSION_REUSE_DETECTED",
      entity: "Session",
      entityId: session._id,
      ipAddress,
    });
    throw ApiError.unauthorized("Session has ended. Please log in again.");
  }

  const user = await User.findById(session.user).select("role status").lean();
  if (!user || user.status !== "ACTIVE") {
    session.revokedAt = new Date();
    await session.save();
    throw ApiError.unauthorized("Account is not active");
  }

  // Rotate on every accepted refresh — including the grace path. A browser presenting the
  // previous token usually means the response carrying the new cookie never arrived (e.g. a hard
  // reload aborted the in-flight refresh). Without a fresh cookie that browser would keep the
  // stale token and be logged out as a "reuse" on its next refresh after the grace window.
  // Compare-and-swap on the current hash: if a concurrent request rotated first, this one
  // returns no cookie and the browser receives the other response's token.
  const currentHash = session.refreshTokenHash;
  const secret = crypto.randomBytes(32).toString("hex");
  const rotated = await Session.findOneAndUpdate(
    { _id: session._id, refreshTokenHash: currentHash, revokedAt: { $exists: false } },
    {
      $set: {
        previousRefreshTokenHash: currentHash,
        refreshTokenHash: hashToken(secret),
        rotatedAt: new Date(),
        lastUsedAt: new Date(),
      },
    }
  );
  const refreshToken: string | null = rotated ? formatRefreshToken(session._id, secret) : null;

  return {
    accessToken: signAccessToken({
      sub: String(user._id),
      sid: String(session._id),
      role: user.role,
      status: user.status,
    }),
    refreshToken,
  };
}

/** Logout: ends only the session the presented refresh token belongs to. */
export async function revokeSessionByRefreshToken(rawToken: string | undefined, ipAddress?: string): Promise<void> {
  const parsed = rawToken ? parseRefreshToken(rawToken) : null;
  if (!parsed) return;
  const session = await Session.findById(parsed.sessionId);
  if (session && hashesEqual(hashToken(parsed.secret), session.refreshTokenHash) && !session.revokedAt) {
    session.revokedAt = new Date();
    await session.save();
    await recordAudit({ userId: session.user, action: "LOGOUT", entity: "Session", entityId: session._id, ipAddress });
  }
}

/** Password reset / block / suspend: sign the user out everywhere. */
export async function revokeAllSessions(userId: Types.ObjectId | string): Promise<void> {
  await Session.updateMany({ user: userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
}

export async function isSessionActive(sessionId: string, userId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(sessionId)) return false;
  const session = await Session.exists({
    _id: sessionId,
    user: userId,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
  return !!session;
}
