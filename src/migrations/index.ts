import * as migration_20261005_232108_initial from './20261005_232108_initial';
import * as migration_20261006_141036_site_settings from './20261006_141036_site_settings';
import * as migration_20261006_201121_allow_unreviewed_publishing from './20261006_201121_allow_unreviewed_publishing';

export const migrations = [
  {
    up: migration_20261005_232108_initial.up,
    down: migration_20261005_232108_initial.down,
    name: '20261005_232108_initial',
  },
  {
    up: migration_20261006_141036_site_settings.up,
    down: migration_20261006_141036_site_settings.down,
    name: '20261006_141036_site_settings',
  },
  {
    up: migration_20261006_201121_allow_unreviewed_publishing.up,
    down: migration_20261006_201121_allow_unreviewed_publishing.down,
    name: '20261006_201121_allow_unreviewed_publishing'
  },
];
