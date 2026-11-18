import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_annotations_source" AS ENUM('staff', 'public');
  CREATE TYPE "public"."enum__annotations_v_version_source" AS ENUM('staff', 'public');
  ALTER TABLE "annotations" ADD COLUMN "source" "enum_annotations_source" DEFAULT 'staff';
  ALTER TABLE "annotations" ADD COLUMN "submitter_name" varchar;
  ALTER TABLE "annotations" ADD COLUMN "submitter_email" varchar;
  ALTER TABLE "annotations" ADD COLUMN "submitter_hash" varchar;
  ALTER TABLE "_annotations_v" ADD COLUMN "version_source" "enum__annotations_v_version_source" DEFAULT 'staff';
  ALTER TABLE "_annotations_v" ADD COLUMN "version_submitter_name" varchar;
  ALTER TABLE "_annotations_v" ADD COLUMN "version_submitter_email" varchar;
  ALTER TABLE "_annotations_v" ADD COLUMN "version_submitter_hash" varchar;
  CREATE INDEX "annotations_submitter_hash_idx" ON "annotations" USING btree ("submitter_hash");
  CREATE INDEX "_annotations_v_version_version_submitter_hash_idx" ON "_annotations_v" USING btree ("version_submitter_hash");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "annotations_submitter_hash_idx";
  DROP INDEX "_annotations_v_version_version_submitter_hash_idx";
  ALTER TABLE "annotations" DROP COLUMN "source";
  ALTER TABLE "annotations" DROP COLUMN "submitter_name";
  ALTER TABLE "annotations" DROP COLUMN "submitter_email";
  ALTER TABLE "annotations" DROP COLUMN "submitter_hash";
  ALTER TABLE "_annotations_v" DROP COLUMN "version_source";
  ALTER TABLE "_annotations_v" DROP COLUMN "version_submitter_name";
  ALTER TABLE "_annotations_v" DROP COLUMN "version_submitter_email";
  ALTER TABLE "_annotations_v" DROP COLUMN "version_submitter_hash";
  DROP TYPE "public"."enum_annotations_source";
  DROP TYPE "public"."enum__annotations_v_version_source";`)
}
