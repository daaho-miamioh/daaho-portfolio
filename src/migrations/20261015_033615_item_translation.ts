import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_items_translation_status" AS ENUM('ai', 'verified', 'human');
  CREATE TYPE "public"."enum__items_v_version_translation_status" AS ENUM('ai', 'verified', 'human');
  ALTER TABLE "items" ADD COLUMN "translation_text" varchar;
  ALTER TABLE "items" ADD COLUMN "translation_status" "enum_items_translation_status" DEFAULT 'ai';
  ALTER TABLE "items" ADD COLUMN "translation_model" varchar;
  ALTER TABLE "items" ADD COLUMN "translation_translator" varchar;
  ALTER TABLE "items" ADD COLUMN "translation_note" varchar;
  ALTER TABLE "items" ADD COLUMN "translation_verified_by_id" integer;
  ALTER TABLE "items" ADD COLUMN "translation_verified_at" timestamp(3) with time zone;
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_text" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_status" "enum__items_v_version_translation_status" DEFAULT 'ai';
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_model" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_translator" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_note" varchar;
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_verified_by_id" integer;
  ALTER TABLE "_items_v" ADD COLUMN "version_translation_verified_at" timestamp(3) with time zone;
  ALTER TABLE "items" ADD CONSTRAINT "items_translation_verified_by_id_users_id_fk" FOREIGN KEY ("translation_verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v" ADD CONSTRAINT "_items_v_version_translation_verified_by_id_users_id_fk" FOREIGN KEY ("version_translation_verified_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "items_translation_translation_verified_by_idx" ON "items" USING btree ("translation_verified_by_id");
  CREATE INDEX "_items_v_version_translation_version_translation_verifie_idx" ON "_items_v" USING btree ("version_translation_verified_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "items" DROP CONSTRAINT "items_translation_verified_by_id_users_id_fk";
  
  ALTER TABLE "_items_v" DROP CONSTRAINT "_items_v_version_translation_verified_by_id_users_id_fk";
  
  DROP INDEX "items_translation_translation_verified_by_idx";
  DROP INDEX "_items_v_version_translation_version_translation_verifie_idx";
  ALTER TABLE "items" DROP COLUMN "translation_text";
  ALTER TABLE "items" DROP COLUMN "translation_status";
  ALTER TABLE "items" DROP COLUMN "translation_model";
  ALTER TABLE "items" DROP COLUMN "translation_translator";
  ALTER TABLE "items" DROP COLUMN "translation_note";
  ALTER TABLE "items" DROP COLUMN "translation_verified_by_id";
  ALTER TABLE "items" DROP COLUMN "translation_verified_at";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_text";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_status";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_model";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_translator";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_note";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_verified_by_id";
  ALTER TABLE "_items_v" DROP COLUMN "version_translation_verified_at";
  DROP TYPE "public"."enum_items_translation_status";
  DROP TYPE "public"."enum__items_v_version_translation_status";`)
}
