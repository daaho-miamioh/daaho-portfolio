import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_items_format" AS ENUM('document', 'photograph', 'oral_history', 'audio', 'video');
  CREATE TYPE "public"."enum__items_v_version_format" AS ENUM('document', 'photograph', 'oral_history', 'audio', 'video');
  ALTER TYPE "public"."enum_items_people_role" ADD VALUE 'interviewee' BEFORE 'contributor';
  ALTER TYPE "public"."enum_items_people_role" ADD VALUE 'interviewer' BEFORE 'contributor';
  ALTER TYPE "public"."enum__items_v_version_people_role" ADD VALUE 'interviewee' BEFORE 'contributor';
  ALTER TYPE "public"."enum__items_v_version_people_role" ADD VALUE 'interviewer' BEFORE 'contributor';
  ALTER TABLE "items" ADD COLUMN "archival_url" varchar;
  ALTER TABLE "items" ADD COLUMN "format" "enum_items_format" DEFAULT 'document';
  ALTER TABLE "_items_v" ADD COLUMN "version_archival_url" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_format" "enum__items_v_version_format" DEFAULT 'document';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "items_people" ALTER COLUMN "role" SET DATA TYPE text;
  DROP TYPE "public"."enum_items_people_role";
  CREATE TYPE "public"."enum_items_people_role" AS ENUM('creator', 'correspondent', 'contributor');
  ALTER TABLE "items_people" ALTER COLUMN "role" SET DATA TYPE "public"."enum_items_people_role" USING "role"::"public"."enum_items_people_role";
  ALTER TABLE "_items_v_version_people" ALTER COLUMN "role" SET DATA TYPE text;
  DROP TYPE "public"."enum__items_v_version_people_role";
  CREATE TYPE "public"."enum__items_v_version_people_role" AS ENUM('creator', 'correspondent', 'contributor');
  ALTER TABLE "_items_v_version_people" ALTER COLUMN "role" SET DATA TYPE "public"."enum__items_v_version_people_role" USING "role"::"public"."enum__items_v_version_people_role";
  ALTER TABLE "items" DROP COLUMN "archival_url";
  ALTER TABLE "items" DROP COLUMN "format";
  ALTER TABLE "_items_v" DROP COLUMN "version_archival_url";
  ALTER TABLE "_items_v" DROP COLUMN "version_format";
  DROP TYPE "public"."enum_items_format";
  DROP TYPE "public"."enum__items_v_version_format";`)
}
