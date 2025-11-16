module.exports = {
  testEnvironment: "node",
  testTimeout: 15000,
  setupFilesAfterEnv: ["<rootDir>/test/setup.js"],
  testMatch: [
    "**/__tests__/**/*.test.js",
    "**/?(*.)+(test).js"
  ],
  collectCoverageFrom: [
    "**/*.{js,jsx}",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/test/**"
  ],
  coverageDirectory: "coverage",
  coverageReporters: [
    "text",
    "lcov",
    "html"
  ]
};