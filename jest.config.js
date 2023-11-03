module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': 'esbuild-runner/jest',
  },
};
