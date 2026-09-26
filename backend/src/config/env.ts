import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
/** Only these environments may relax security defaults (verbose errors, non-Secure cookies).
 * Anything else — including an unset/misspelled NODE_ENV on a real server — gets the strict
 * behaviour, so a missing NODE_ENV=production can't silently weaken a deployment. */
const isLocalDev = nodeEnv === "development" || nodeEnv === "test";

const cookieSameSite = (process.env.COOKIE_SAMESITE ?? "lax").toLowerCase();
if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  throw new Error("COOKIE_SAMESITE must be one of: lax, strict, none");
}

const clientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";
const localDevOrigins = ["http://localhost:3000", "http://localhost:5173"];
const corsOrigins = isLocalDev
  ? Array.from(new Set([...localDevOrigins, clientUrl]))
  : [clientUrl];

export const env = {
  nodeEnv,
  isProduction,
  isLocalDev,
  port: Number(process.env.PORT ?? 5000),

  mongodbUri: required("MONGODB_URI"),

  jwtSecret: required("JWT_SECRET"),
  /** Access tokens are short-lived; the refresh-token session keeps users signed in. */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),

  /** Refresh cookie SameSite. Use "none" (which forces Secure) only when the frontend and API
   * are on different sites, e.g. *.vercel.app + *.railway.app. */
  cookieSameSite: cookieSameSite as "lax" | "strict" | "none",
  cookieSecure: !isLocalDev || cookieSameSite === "none",

  resetTokenExpiresMinutes: Number(process.env.RESET_TOKEN_EXPIRES_MINUTES ?? 30),
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),

  /** Canonical frontend origin — used to build absolute links (e.g. password-reset emails). */
  clientUrl,
  /** Origins the API accepts cross-origin requests from. In dev this always includes both
   * common local frontend ports regardless of CLIENT_URL, so switching between a Next.js
   * (3000) and Vite (5173) frontend locally never requires touching .env. In production it's
   * exactly CLIENT_URL — no implicit localhost access. */
  corsOrigins,

  emailFrom: process.env.EMAIL_FROM || "SSR Institute <smartskillsrecruitment@gmail.com>",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },
} as const;

// Refuse to start a non-local deployment with weak or placeholder security settings.
if (!isLocalDev) {
  if (env.jwtSecret.length < 32 || env.jwtSecret.startsWith("replace-with")) {
    throw new Error("JWT_SECRET must be a random value of at least 32 characters");
  }
  if (!process.env.CLIENT_URL) {
    throw new Error("CLIENT_URL must be set explicitly outside local development");
  }
}
