import { pathsToModuleNameMapper } from 'ts-jest';
import { createDefaultPreset } from 'ts-jest';
import tsconfig from '../tsconfig.json' with { type: 'json' };

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
};
