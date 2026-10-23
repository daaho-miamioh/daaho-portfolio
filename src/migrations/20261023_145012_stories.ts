import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_stories_story_type" AS ENUM('biography', 'theme');
  CREATE TYPE "public"."enum_stories_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__stories_v_version_story_type" AS ENUM('biography', 'theme');
  CREATE TYPE "public"."enum__stories_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "stories_elsewhere" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "stories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"dek" varchar,
  	"body" jsonb,
  	"credit" varchar,
  	"subject_name" varchar,
  	"subject_life_dates" varchar,
  	"subject_at_miami" varchar,
  	"subject_portrait_id" integer,
  	"subject_portrait_caption" varchar,
  	"sources" jsonb,
  	"slug" varchar,
  	"story_type" "enum_stories_story_type" DEFAULT 'biography',
  	"published_at" timestamp(3) with time zone,
  	"origin_site" varchar,
  	"origin_url" varchar,
  	"origin_license" varchar,
  	"origin_license_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_stories_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "stories_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "stories_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"items_id" integer
  );
  
  CREATE TABLE "_stories_v_version_elsewhere" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"description" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_stories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_dek" varchar,
  	"version_body" jsonb,
  	"version_credit" varchar,
  	"version_subject_name" varchar,
  	"version_subject_life_dates" varchar,
  	"version_subject_at_miami" varchar,
  	"version_subject_portrait_id" integer,
  	"version_subject_portrait_caption" varchar,
  	"version_sources" jsonb,
  	"version_slug" varchar,
  	"version_story_type" "enum__stories_v_version_story_type" DEFAULT 'biography',
  	"version_published_at" timestamp(3) with time zone,
  	"version_origin_site" varchar,
  	"version_origin_url" varchar,
  	"version_origin_license" varchar,
  	"version_origin_license_url" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__stories_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_stories_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_stories_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"items_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stories_id" integer;
  ALTER TABLE "stories_elsewhere" ADD CONSTRAINT "stories_elsewhere_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stories" ADD CONSTRAINT "stories_subject_portrait_id_media_id_fk" FOREIGN KEY ("subject_portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stories_texts" ADD CONSTRAINT "stories_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stories_rels" ADD CONSTRAINT "stories_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "stories_rels" ADD CONSTRAINT "stories_rels_items_fk" FOREIGN KEY ("items_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_stories_v_version_elsewhere" ADD CONSTRAINT "_stories_v_version_elsewhere_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_stories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_stories_v" ADD CONSTRAINT "_stories_v_parent_id_stories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_stories_v" ADD CONSTRAINT "_stories_v_version_subject_portrait_id_media_id_fk" FOREIGN KEY ("version_subject_portrait_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_stories_v_texts" ADD CONSTRAINT "_stories_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_stories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_stories_v_rels" ADD CONSTRAINT "_stories_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_stories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_stories_v_rels" ADD CONSTRAINT "_stories_v_rels_items_fk" FOREIGN KEY ("items_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "stories_elsewhere_order_idx" ON "stories_elsewhere" USING btree ("_order");
  CREATE INDEX "stories_elsewhere_parent_id_idx" ON "stories_elsewhere" USING btree ("_parent_id");
  CREATE INDEX "stories_subject_subject_portrait_idx" ON "stories" USING btree ("subject_portrait_id");
  CREATE UNIQUE INDEX "stories_slug_idx" ON "stories" USING btree ("slug");
  CREATE INDEX "stories_updated_at_idx" ON "stories" USING btree ("updated_at");
  CREATE INDEX "stories_created_at_idx" ON "stories" USING btree ("created_at");
  CREATE INDEX "stories__status_idx" ON "stories" USING btree ("_status");
  CREATE INDEX "stories_texts_order_parent" ON "stories_texts" USING btree ("order","parent_id");
  CREATE INDEX "stories_rels_order_idx" ON "stories_rels" USING btree ("order");
  CREATE INDEX "stories_rels_parent_idx" ON "stories_rels" USING btree ("parent_id");
  CREATE INDEX "stories_rels_path_idx" ON "stories_rels" USING btree ("path");
  CREATE INDEX "stories_rels_items_id_idx" ON "stories_rels" USING btree ("items_id");
  CREATE INDEX "_stories_v_version_elsewhere_order_idx" ON "_stories_v_version_elsewhere" USING btree ("_order");
  CREATE INDEX "_stories_v_version_elsewhere_parent_id_idx" ON "_stories_v_version_elsewhere" USING btree ("_parent_id");
  CREATE INDEX "_stories_v_parent_idx" ON "_stories_v" USING btree ("parent_id");
  CREATE INDEX "_stories_v_version_subject_version_subject_portrait_idx" ON "_stories_v" USING btree ("version_subject_portrait_id");
  CREATE INDEX "_stories_v_version_version_slug_idx" ON "_stories_v" USING btree ("version_slug");
  CREATE INDEX "_stories_v_version_version_updated_at_idx" ON "_stories_v" USING btree ("version_updated_at");
  CREATE INDEX "_stories_v_version_version_created_at_idx" ON "_stories_v" USING btree ("version_created_at");
  CREATE INDEX "_stories_v_version_version__status_idx" ON "_stories_v" USING btree ("version__status");
  CREATE INDEX "_stories_v_created_at_idx" ON "_stories_v" USING btree ("created_at");
  CREATE INDEX "_stories_v_updated_at_idx" ON "_stories_v" USING btree ("updated_at");
  CREATE INDEX "_stories_v_latest_idx" ON "_stories_v" USING btree ("latest");
  CREATE INDEX "_stories_v_texts_order_parent" ON "_stories_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_stories_v_rels_order_idx" ON "_stories_v_rels" USING btree ("order");
  CREATE INDEX "_stories_v_rels_parent_idx" ON "_stories_v_rels" USING btree ("parent_id");
  CREATE INDEX "_stories_v_rels_path_idx" ON "_stories_v_rels" USING btree ("path");
  CREATE INDEX "_stories_v_rels_items_id_idx" ON "_stories_v_rels" USING btree ("items_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stories_fk" FOREIGN KEY ("stories_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_stories_id_idx" ON "payload_locked_documents_rels" USING btree ("stories_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stories_elsewhere" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stories_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stories_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_stories_v_version_elsewhere" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_stories_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_stories_v_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_stories_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "stories_elsewhere" CASCADE;
  DROP TABLE "stories" CASCADE;
  DROP TABLE "stories_texts" CASCADE;
  DROP TABLE "stories_rels" CASCADE;
  DROP TABLE "_stories_v_version_elsewhere" CASCADE;
  DROP TABLE "_stories_v" CASCADE;
  DROP TABLE "_stories_v_texts" CASCADE;
  DROP TABLE "_stories_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stories_fk";
  
  DROP INDEX "payload_locked_documents_rels_stories_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stories_id";
  DROP TYPE "public"."enum_stories_story_type";
  DROP TYPE "public"."enum_stories_status";
  DROP TYPE "public"."enum__stories_v_version_story_type";
  DROP TYPE "public"."enum__stories_v_version_status";`)
}
