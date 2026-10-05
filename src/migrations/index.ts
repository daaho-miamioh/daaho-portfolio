import * as migration_20261005_232108_initial from './20261005_232108_initial';

export const migrations = [
  {
    up: migration_20261005_232108_initial.up,
    down: migration_20261005_232108_initial.down,
    name: '20261005_232108_initial'
  },
];
