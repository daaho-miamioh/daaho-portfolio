import * as migration_20261005_232108_initial from './20261005_232108_initial';
import * as migration_20261006_141036_site_settings from './20261006_141036_site_settings';
import * as migration_20261006_201121_allow_unreviewed_publishing from './20261006_201121_allow_unreviewed_publishing';
import * as migration_20261007_002925_harmful_language_statement from './20261007_002925_harmful_language_statement';
import * as migration_20261013_212136_annotations from './20261013_212136_annotations';
import * as migration_20261014_163232_landing_content from './20261014_163232_landing_content';
import * as migration_20261015_033615_item_translation from './20261015_033615_item_translation';
import * as migration_20261019_155844_user_invitations from './20261019_155844_user_invitations';
import * as migration_20261023_131909_item_public_view from './20261023_131909_item_public_view';

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
    name: '20261006_201121_allow_unreviewed_publishing',
  },
  {
    up: migration_20261007_002925_harmful_language_statement.up,
    down: migration_20261007_002925_harmful_language_statement.down,
    name: '20261007_002925_harmful_language_statement',
  },
  {
    up: migration_20261013_212136_annotations.up,
    down: migration_20261013_212136_annotations.down,
    name: '20261013_212136_annotations',
  },
  {
    up: migration_20261014_163232_landing_content.up,
    down: migration_20261014_163232_landing_content.down,
    name: '20261014_163232_landing_content',
  },
  {
    up: migration_20261015_033615_item_translation.up,
    down: migration_20261015_033615_item_translation.down,
    name: '20261015_033615_item_translation',
  },
  {
    up: migration_20261019_155844_user_invitations.up,
    down: migration_20261019_155844_user_invitations.down,
    name: '20261019_155844_user_invitations',
  },
  {
    up: migration_20261023_131909_item_public_view.up,
    down: migration_20261023_131909_item_public_view.down,
    name: '20261023_131909_item_public_view'
  },
];
