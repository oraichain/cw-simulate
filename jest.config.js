module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': 'esbuild-runner/jest'
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/']
};
