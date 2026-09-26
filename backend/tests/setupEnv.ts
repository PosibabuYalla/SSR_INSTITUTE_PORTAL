// Self-contained placeholder values so src/config/env.ts's required() checks pass at import
// time — the actual DB connection is a separate, dynamic in-memory instance set up in
// setupDb.ts, not this URI. Deliberately decoupled from the real backend/.env.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/unused-placeholder";
process.env.JWT_SECRET = "test-jwt-secret-do-not-use-in-prod";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-do-not-use-in-prod";
process.env.CLIENT_URL = "http://localhost:3000";
// Never send real email from tests, even if the developer's backend/.env configures SMTP
// (dotenv doesn't override variables that are already set).
process.env.SMTP_HOST = "";

// Pin the in-memory mongod binary version — mongodb-memory-server's default/latest pairing has
// a known handshake incompatibility ("Missing required sub-document 'driver'") with its own
// bundled driver; 7.0.x is a known-good combination that still supports transactions.
process.env.MONGOMS_VERSION ??= "7.0.14";
