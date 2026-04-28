/**
 * Dedicated jest config for the fastify build-conformance suite. Runs only
 * the test files under test/fastify-conformance/ — the regular `npm test`
 * excludes this directory because each test does a real `npm install` and
 * tsc compile (slow, network-dependent).
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/test/fastify-conformance/**/*.test.ts'],
  // Each test runs a real `npm install` per fixture; default 5s is way too low.
  testTimeout: 10 * 60 * 1000,
  moduleNameMapper: {
    '^@dna-codes/core$': '<rootDir>/../../../node_modules/@dna-codes/core/dist/index.js',
  },
}
