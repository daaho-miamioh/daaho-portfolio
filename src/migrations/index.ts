import * as migration_20261005_232108_initial from './20261005_232108_initial';
import * as migration_20261006_141036_site_settings from './20261006_141036_site_settings';
import * as migration_20261006_201121_allow_unreviewed_publishing from './20261006_201121_allow_unreviewed_publishing';
import * as migration_20261007_002925_harmful_language_statement from './20261007_002925_harmful_language_statement';
import * as migration_20261013_212136_annotations from './20261013_212136_annotations';
import * as migration_20261014_163232_landing_content from './20261014_163232_landing_content';
import * as migration_20261015_033615_item_translation from './20261015_033615_item_translation';
import * as migration_20261019_155844_user_invitations from './20261019_155844_user_invitations';
import * as migration_20261023_131909_item_public_view from './20261023_131909_item_public_view';
import * as migration_20261023_145012_stories from './20261023_145012_stories';
import * as migration_20261029_202456_team_former_group from './20261029_202456_team_former_group';
import * as migration_20261030_035928_items_written_by_people from './20261030_035928_items_written_by_people';
import * as migration_20261030_164022_items_format_and_original_online from './20261030_164022_items_format_and_original_online';
import * as migration_20261030_195630_collections_within_the_collection from './20261030_195630_collections_within_the_collection';
import * as migration_20261031_051949_activity_log from './20261031_051949_activity_log';

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
    name: '20261023_131909_item_public_view',
  },
  {
    up: migration_20261023_145012_stories.up,
    down: migration_20261023_145012_stories.down,
    name: '20261023_145012_stories',
  },
  {
    up: migration_20261029_202456_team_former_group.up,
    down: migration_20261029_202456_team_former_group.down,
    name: '20261029_202456_team_former_group',
  },
  {
    up: migration_20261030_035928_items_written_by_people.up,
    down: migration_20261030_035928_items_written_by_people.down,
    name: '20261030_035928_items_written_by_people',
  },
  {
    up: migration_20261030_164022_items_format_and_original_online.up,
    down: migration_20261030_164022_items_format_and_original_online.down,
    name: '20261030_164022_items_format_and_original_online',
  },
  {
    up: migration_20261030_195630_collections_within_the_collection.up,
    down: migration_20261030_195630_collections_within_the_collection.down,
    name: '20261030_195630_collections_within_the_collection',
  },
  {
    up: migration_20261031_051949_activity_log.up,
    down: migration_20261031_051949_activity_log.down,
    name: '20261031_051949_activity_log',
  },
];
