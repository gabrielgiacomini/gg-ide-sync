/**
 * @fileoverview Jest configuration for the portable IDE sync skill scripts.
 *
 * @testing CLI: NODE_OPTIONS='--experimental-vm-modules' npx jest --config canonical-skills/gg-ide-sync/jest.config.ts
 * @see scripts/__tests__/ - Unit tests for agent, guidance, rule, and workflow sync helpers.
 */
import type { Config } from "jest";

const config = {
  rootDir: ".",
  roots: ["<rootDir>/scripts"],
  testEnvironment: "node",
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  testMatch: ["**/scripts/**/*.unit.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/\\.*/"],
  modulePathIgnorePatterns: ["/\\.*/"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  silent: true,
} satisfies Config;

export default config;
