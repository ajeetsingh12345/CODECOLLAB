export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["dotenv/config"],
  testTimeout: 30000
};
