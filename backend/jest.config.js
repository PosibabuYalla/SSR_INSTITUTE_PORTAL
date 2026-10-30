/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: { "ts-jest": { tsconfig: "tsconfig.test.json" } },
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/setupEnv.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setupDb.ts"],
  // Each test file starts its own in-memory MongoDB instance; serialize runs so a first-time
  // binary download isn't attempted concurrently by multiple workers.
  maxWorkers: 1,
  testTimeout: 60000,
  clearMocks: true,
};
