import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import compression from "compression";
import path from "path";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { apiLimiter } from "./middleware/rateLimiters";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { mongoSanitize } from "./middleware/sanitize";
import apiV1Routes from "./routes";

export function createApp(): Application {
  const app = express();

  app.set("trust proxy", 1);
  // This is a JSON API, not a static-asset server — Express's default weak ETag on every
  // response just causes conditional-GET 304s that muddy the Network tab and add server-side
  // hashing work for no benefit (the client never relies on HTTP caching; React Query already
  // owns client-side caching).
  app.set("etag", false);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());
  app.use(mongoSanitize);

  app.use(
    morgan(env.isProduction ? "combined" : "dev", {
      stream: { write: (message: string) => logger.http(message.trim()) },
    })
  );

  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

  app.get("/health", (_req, res) => {
    res.status(200).json({ success: true, message: "SSR Portal API is running" });
  });

  app.use("/api/v1", apiLimiter, apiV1Routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
