import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "items" ADD COLUMN "archival_creator" varchar;
  ALTER TABLE "items" ADD COLUMN "archival_digital_collection" varchar;
  ALTER TABLE "items" ADD COLUMN "archival_type" varchar;
  ALTER TABLE "items" ADD COLUMN "archival_theme" varchar;
  ALTER TABLE "items" ADD COLUMN "archival_extent" varchar;
  ALTER TABLE "items" ADD COLUMN "archival_dimensions" varchar;
  ALTER TABLE "items" ADD COLUMN "archival_shelf" varchar;
  ALTER TABLE "items" ADD COLUMN "review_title_checked" boolean;
  ALTER TABLE "items" ADD COLUMN "review_description_checked" boolean;
  ALTER TABLE "items" ADD COLUMN "review_transcript_checked" boolean;
  ALTER TABLE "items" ADD COLUMN "review_links_checked" boolean;
  ALTER TABLE "items" ADD COLUMN "ai_original_title" varchar;
  ALTER TABLE "items" ADD COLUMN "ai_original_date" varchar;
  ALTER TABLE "items" ADD COLUMN "ai_original_description" varchar;
  ALTER TABLE "items" ADD COLUMN "public_text" varchar;
  ALTER TABLE "items" ADD COLUMN "public_date_sort" timestamp(3) with time zone;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_creator" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_digital_collection" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_type" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_theme" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_extent" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_dimensions" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_shelf" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_review_title_checked" boolean;
  ALTER TABLE "_items_v" ADD COLUMN "version_review_description_checked" boolean;
  ALTER TABLE "_items_v" ADD COLUMN "version_review_transcript_checked" boolean;
  ALTER TABLE "_items_v" ADD COLUMN "version_review_links_checked" boolean;
  ALTER TABLE "_items_v" ADD COLUMN "version_ai_original_title" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_ai_original_date" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_ai_original_description" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_public_text" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_public_date_sort" timestamp(3) with time zone;
  CREATE INDEX "items_public_date_sort_idx" ON "items" USING btree ("public_date_sort");
  CREATE INDEX "_items_v_version_version_public_date_sort_idx" ON "_items_v" USING btree ("version_public_date_sort");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "items_public_date_sort_idx";
  DROP INDEX "_items_v_version_version_public_date_sort_idx";
  ALTER TABLE "items" DROP COLUMN "archival_creator";
  ALTER TABLE "items" DROP COLUMN "archival_digital_collection";
  ALTER TABLE "items" DROP COLUMN "archival_type";
  ALTER TABLE "items" DROP COLUMN "archival_theme";
  ALTER TABLE "items" DROP COLUMN "archival_extent";
  ALTER TABLE "items" DROP COLUMN "archival_dimensions";
  ALTER TABLE "items" DROP COLUMN "archival_shelf";
  ALTER TABLE "items" DROP COLUMN "review_title_checked";
  ALTER TABLE "items" DROP COLUMN "review_description_checked";
  ALTER TABLE "items" DROP COLUMN "review_transcript_checked";
  ALTER TABLE "items" DROP COLUMN "review_links_checked";
  ALTER TABLE "items" DROP COLUMN "ai_original_title";
  ALTER TABLE "items" DROP COLUMN "ai_original_date";
  ALTER TABLE "items" DROP COLUMN "ai_original_description";
  ALTER TABLE "items" DROP COLUMN "public_text";
  ALTER TABLE "items" DROP COLUMN "public_date_sort";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_creator";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_digital_collection";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_type";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_theme";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_extent";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_dimensions";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_shelf";
  ALTER TABLE "_items_v" DROP COLUMN "version_review_title_checked";
  ALTER TABLE "_items_v" DROP COLUMN "version_review_description_checked";
  ALTER TABLE "_items_v" DROP COLUMN "version_review_transcript_checked";
  ALTER TABLE "_items_v" DROP COLUMN "version_review_links_checked";
  ALTER TABLE "_items_v" DROP COLUMN "version_ai_original_title";
  ALTER TABLE "_items_v" DROP COLUMN "version_ai_original_date";
  ALTER TABLE "_items_v" DROP COLUMN "version_ai_original_description";
  ALTER TABLE "_items_v" DROP COLUMN "version_public_text";
  ALTER TABLE "_items_v" DROP COLUMN "version_public_date_sort";`)
}
