import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sets_color" AS ENUM('red', 'blue', 'green', 'amber', 'violet', 'slate');
  CREATE TYPE "public"."enum_sets_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__sets_v_version_color" AS ENUM('red', 'blue', 'green', 'amber', 'violet', 'slate');
  CREATE TYPE "public"."enum__sets_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "sets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"kind" varchar,
  	"short_title" varchar,
  	"summary" varchar,
  	"intro" jsonb,
  	"cover_id" integer,
  	"holder" varchar,
  	"url" varchar,
  	"rights" varchar,
  	"slug" varchar,
  	"color" "enum_sets_color" DEFAULT 'slate',
  	"order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_sets_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_sets_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_kind" varchar,
  	"version_short_title" varchar,
  	"version_summary" varchar,
  	"version_intro" jsonb,
  	"version_cover_id" integer,
  	"version_holder" varchar,
  	"version_url" varchar,
  	"version_rights" varchar,
  	"version_slug" varchar,
  	"version_color" "enum__sets_v_version_color" DEFAULT 'slate',
  	"version_order" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__sets_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  ALTER TABLE "items" ADD COLUMN "set_id" integer;
  ALTER TABLE "_items_v" ADD COLUMN "version_set_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sets_id" integer;
  ALTER TABLE "sets" ADD CONSTRAINT "sets_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sets_v" ADD CONSTRAINT "_sets_v_parent_id_sets_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sets_v" ADD CONSTRAINT "_sets_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sets_cover_idx" ON "sets" USING btree ("cover_id");
  CREATE UNIQUE INDEX "sets_slug_idx" ON "sets" USING btree ("slug");
  CREATE INDEX "sets_updated_at_idx" ON "sets" USING btree ("updated_at");
  CREATE INDEX "sets_created_at_idx" ON "sets" USING btree ("created_at");
  CREATE INDEX "sets__status_idx" ON "sets" USING btree ("_status");
  CREATE INDEX "_sets_v_parent_idx" ON "_sets_v" USING btree ("parent_id");
  CREATE INDEX "_sets_v_version_version_cover_idx" ON "_sets_v" USING btree ("version_cover_id");
  CREATE INDEX "_sets_v_version_version_slug_idx" ON "_sets_v" USING btree ("version_slug");
  CREATE INDEX "_sets_v_version_version_updated_at_idx" ON "_sets_v" USING btree ("version_updated_at");
  CREATE INDEX "_sets_v_version_version_created_at_idx" ON "_sets_v" USING btree ("version_created_at");
  CREATE INDEX "_sets_v_version_version__status_idx" ON "_sets_v" USING btree ("version__status");
  CREATE INDEX "_sets_v_created_at_idx" ON "_sets_v" USING btree ("created_at");
  CREATE INDEX "_sets_v_updated_at_idx" ON "_sets_v" USING btree ("updated_at");
  CREATE INDEX "_sets_v_latest_idx" ON "_sets_v" USING btree ("latest");
  ALTER TABLE "items" ADD CONSTRAINT "items_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v" ADD CONSTRAINT "_items_v_version_set_id_sets_id_fk" FOREIGN KEY ("version_set_id") REFERENCES "public"."sets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sets_fk" FOREIGN KEY ("sets_id") REFERENCES "public"."sets"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "items_set_idx" ON "items" USING btree ("set_id");
  CREATE INDEX "_items_v_version_version_set_idx" ON "_items_v" USING btree ("version_set_id");
  CREATE INDEX "payload_locked_documents_rels_sets_id_idx" ON "payload_locked_documents_rels" USING btree ("sets_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sets_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sets" CASCADE;
  DROP TABLE "_sets_v" CASCADE;
  ALTER TABLE "items" DROP CONSTRAINT "items_set_id_sets_id_fk";
  
  ALTER TABLE "_items_v" DROP CONSTRAINT "_items_v_version_set_id_sets_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sets_fk";
  
  DROP INDEX "items_set_idx";
  DROP INDEX "_items_v_version_version_set_idx";
  DROP INDEX "payload_locked_documents_rels_sets_id_idx";
  ALTER TABLE "items" DROP COLUMN "set_id";
  ALTER TABLE "_items_v" DROP COLUMN "version_set_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sets_id";
  DROP TYPE "public"."enum_sets_color";
  DROP TYPE "public"."enum_sets_status";
  DROP TYPE "public"."enum__sets_v_version_color";
  DROP TYPE "public"."enum__sets_v_version_status";`)
}
