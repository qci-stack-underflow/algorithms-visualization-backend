import { pathsToModuleNameMapper } from 'ts-jest';
import { createDefaultPreset } from 'ts-jest';
import tsconfig from './tsconfig.json' with {type: "json"};

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  testEnvironment: 'node',
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
};