import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "items" ADD COLUMN "recording_id" integer;
  ALTER TABLE "_items_v" ADD COLUMN "version_recording_id" integer;
  ALTER TABLE "items" ADD CONSTRAINT "items_recording_id_media_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v" ADD CONSTRAINT "_items_v_version_recording_id_media_id_fk" FOREIGN KEY ("version_recording_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "items_recording_idx" ON "items" USING btree ("recording_id");
  CREATE INDEX "_items_v_version_version_recording_idx" ON "_items_v" USING btree ("version_recording_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "items" DROP CONSTRAINT "items_recording_id_media_id_fk";
  
  ALTER TABLE "_items_v" DROP CONSTRAINT "_items_v_version_recording_id_media_id_fk";
  
  DROP INDEX "items_recording_idx";
  DROP INDEX "_items_v_version_version_recording_idx";
  ALTER TABLE "items" DROP COLUMN "recording_id";
  ALTER TABLE "_items_v" DROP COLUMN "version_recording_id";`)
}
