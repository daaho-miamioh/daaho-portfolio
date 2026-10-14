import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_project_events_kind" AS ENUM('exhibit', 'conference', 'community', 'talk', 'workshop', 'launch', 'other');
  CREATE TYPE "public"."enum_project_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__project_events_v_version_kind" AS ENUM('exhibit', 'conference', 'community', 'talk', 'workshop', 'launch', 'other');
  CREATE TYPE "public"."enum__project_events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_team_group" AS ENUM('project-team', 'partners', 'committee', 'former-students');
  CREATE TABLE "project_events_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "project_events_sponsors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "project_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"kind" "enum_project_events_kind" DEFAULT 'other',
  	"start" varchar,
  	"end" varchar,
  	"time_text" varchar,
  	"location" varchar,
  	"link" varchar,
  	"summary" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_project_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_project_events_v_version_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_project_events_v_version_sponsors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_project_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_kind" "enum__project_events_v_version_kind" DEFAULT 'other',
  	"version_start" varchar,
  	"version_end" varchar,
  	"version_time_text" varchar,
  	"version_location" varchar,
  	"version_link" varchar,
  	"version_summary" varchar,
  	"version_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__project_events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "home_slides" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "home_goals" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "home_sponsors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"logo_id" integer,
  	"url" varchar
  );
  
  ALTER TABLE "team" ALTER COLUMN "bio" SET DATA TYPE varchar;
  ALTER TABLE "team" ADD COLUMN "group" "enum_team_group" DEFAULT 'partners' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "project_events_id" integer;
  ALTER TABLE "home" ADD COLUMN "submit_link_label" varchar DEFAULT 'Submit a collection';
  ALTER TABLE "home" ADD COLUMN "submit_link_url" varchar;
  ALTER TABLE "home" ADD COLUMN "mission" varchar;
  ALTER TABLE "home" ADD COLUMN "goals_intro" varchar;
  ALTER TABLE "home" ADD COLUMN "events_intro" varchar;
  ALTER TABLE "about" ADD COLUMN "logo_heading" varchar DEFAULT 'About our logo';
  ALTER TABLE "about" ADD COLUMN "logo_image_id" integer;
  ALTER TABLE "about" ADD COLUMN "logo_text" varchar;
  ALTER TABLE "project_events_images" ADD CONSTRAINT "project_events_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "project_events_images" ADD CONSTRAINT "project_events_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."project_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "project_events_sponsors" ADD CONSTRAINT "project_events_sponsors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."project_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_project_events_v_version_images" ADD CONSTRAINT "_project_events_v_version_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_project_events_v_version_images" ADD CONSTRAINT "_project_events_v_version_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_project_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_project_events_v_version_sponsors" ADD CONSTRAINT "_project_events_v_version_sponsors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_project_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_project_events_v" ADD CONSTRAINT "_project_events_v_parent_id_project_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."project_events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_slides" ADD CONSTRAINT "home_slides_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_slides" ADD CONSTRAINT "home_slides_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_goals" ADD CONSTRAINT "home_goals_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_sponsors" ADD CONSTRAINT "home_sponsors_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "home_sponsors" ADD CONSTRAINT "home_sponsors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "project_events_images_order_idx" ON "project_events_images" USING btree ("_order");
  CREATE INDEX "project_events_images_parent_id_idx" ON "project_events_images" USING btree ("_parent_id");
  CREATE INDEX "project_events_images_image_idx" ON "project_events_images" USING btree ("image_id");
  CREATE INDEX "project_events_sponsors_order_idx" ON "project_events_sponsors" USING btree ("_order");
  CREATE INDEX "project_events_sponsors_parent_id_idx" ON "project_events_sponsors" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "project_events_slug_idx" ON "project_events" USING btree ("slug");
  CREATE INDEX "project_events_updated_at_idx" ON "project_events" USING btree ("updated_at");
  CREATE INDEX "project_events_created_at_idx" ON "project_events" USING btree ("created_at");
  CREATE INDEX "project_events__status_idx" ON "project_events" USING btree ("_status");
  CREATE INDEX "_project_events_v_version_images_order_idx" ON "_project_events_v_version_images" USING btree ("_order");
  CREATE INDEX "_project_events_v_version_images_parent_id_idx" ON "_project_events_v_version_images" USING btree ("_parent_id");
  CREATE INDEX "_project_events_v_version_images_image_idx" ON "_project_events_v_version_images" USING btree ("image_id");
  CREATE INDEX "_project_events_v_version_sponsors_order_idx" ON "_project_events_v_version_sponsors" USING btree ("_order");
  CREATE INDEX "_project_events_v_version_sponsors_parent_id_idx" ON "_project_events_v_version_sponsors" USING btree ("_parent_id");
  CREATE INDEX "_project_events_v_parent_idx" ON "_project_events_v" USING btree ("parent_id");
  CREATE INDEX "_project_events_v_version_version_slug_idx" ON "_project_events_v" USING btree ("version_slug");
  CREATE INDEX "_project_events_v_version_version_updated_at_idx" ON "_project_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_project_events_v_version_version_created_at_idx" ON "_project_events_v" USING btree ("version_created_at");
  CREATE INDEX "_project_events_v_version_version__status_idx" ON "_project_events_v" USING btree ("version__status");
  CREATE INDEX "_project_events_v_created_at_idx" ON "_project_events_v" USING btree ("created_at");
  CREATE INDEX "_project_events_v_updated_at_idx" ON "_project_events_v" USING btree ("updated_at");
  CREATE INDEX "_project_events_v_latest_idx" ON "_project_events_v" USING btree ("latest");
  CREATE INDEX "home_slides_order_idx" ON "home_slides" USING btree ("_order");
  CREATE INDEX "home_slides_parent_id_idx" ON "home_slides" USING btree ("_parent_id");
  CREATE INDEX "home_slides_image_idx" ON "home_slides" USING btree ("image_id");
  CREATE INDEX "home_goals_order_idx" ON "home_goals" USING btree ("_order");
  CREATE INDEX "home_goals_parent_id_idx" ON "home_goals" USING btree ("_parent_id");
  CREATE INDEX "home_sponsors_order_idx" ON "home_sponsors" USING btree ("_order");
  CREATE INDEX "home_sponsors_parent_id_idx" ON "home_sponsors" USING btree ("_parent_id");
  CREATE INDEX "home_sponsors_logo_idx" ON "home_sponsors" USING btree ("logo_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_project_events_fk" FOREIGN KEY ("project_events_id") REFERENCES "public"."project_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_logo_image_id_media_id_fk" FOREIGN KEY ("logo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "team_group_idx" ON "team" USING btree ("group");
  CREATE INDEX "payload_locked_documents_rels_project_events_id_idx" ON "payload_locked_documents_rels" USING btree ("project_events_id");
  CREATE INDEX "about_logo_logo_image_idx" ON "about" USING btree ("logo_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "project_events_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "project_events_sponsors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "project_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_project_events_v_version_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_project_events_v_version_sponsors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_project_events_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_slides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_goals" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "home_sponsors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "project_events_images" CASCADE;
  DROP TABLE "project_events_sponsors" CASCADE;
  DROP TABLE "project_events" CASCADE;
  DROP TABLE "_project_events_v_version_images" CASCADE;
  DROP TABLE "_project_events_v_version_sponsors" CASCADE;
  DROP TABLE "_project_events_v" CASCADE;
  DROP TABLE "home_slides" CASCADE;
  DROP TABLE "home_goals" CASCADE;
  DROP TABLE "home_sponsors" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_project_events_fk";
  
  ALTER TABLE "about" DROP CONSTRAINT "about_logo_image_id_media_id_fk";
  
  DROP INDEX "team_group_idx";
  DROP INDEX "payload_locked_documents_rels_project_events_id_idx";
  DROP INDEX "about_logo_logo_image_idx";
  ALTER TABLE "team" ALTER COLUMN "bio" SET DATA TYPE jsonb;
  ALTER TABLE "team" DROP COLUMN "group";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "project_events_id";
  ALTER TABLE "home" DROP COLUMN "submit_link_label";
  ALTER TABLE "home" DROP COLUMN "submit_link_url";
  ALTER TABLE "home" DROP COLUMN "mission";
  ALTER TABLE "home" DROP COLUMN "goals_intro";
  ALTER TABLE "home" DROP COLUMN "events_intro";
  ALTER TABLE "about" DROP COLUMN "logo_heading";
  ALTER TABLE "about" DROP COLUMN "logo_image_id";
  ALTER TABLE "about" DROP COLUMN "logo_text";
  DROP TYPE "public"."enum_project_events_kind";
  DROP TYPE "public"."enum_project_events_status";
  DROP TYPE "public"."enum__project_events_v_version_kind";
  DROP TYPE "public"."enum__project_events_v_version_status";
  DROP TYPE "public"."enum_team_group";`)
}
