import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_items_people_role" AS ENUM('creator', 'correspondent', 'contributor');
  CREATE TYPE "public"."enum_items_regions" AS ENUM('China', 'Japan', 'Korea', 'Philippines', 'Thailand', 'Burma', 'Singapore');
  CREATE TYPE "public"."enum_items_review_status" AS ENUM('ai_generated', 'in_review', 'reviewed');
  CREATE TYPE "public"."enum_items_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__items_v_version_people_role" AS ENUM('creator', 'correspondent', 'contributor');
  CREATE TYPE "public"."enum__items_v_version_regions" AS ENUM('China', 'Japan', 'Korea', 'Philippines', 'Thailand', 'Burma', 'Singapore');
  CREATE TYPE "public"."enum__items_v_version_review_status" AS ENUM('ai_generated', 'in_review', 'reviewed');
  CREATE TYPE "public"."enum__items_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_events_names_language" AS ENUM('zh', 'ja', 'ko', 'th', 'my', 'fil');
  CREATE TYPE "public"."enum_events_regions" AS ENUM('China', 'Japan', 'Korea', 'Philippines', 'Thailand', 'Burma', 'Singapore');
  CREATE TYPE "public"."enum_events_importance" AS ENUM('major', 'notable');
  CREATE TYPE "public"."enum_events_review_status" AS ENUM('ai_drafted', 'reviewed');
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_names_language" AS ENUM('zh', 'ja', 'ko', 'th', 'my', 'fil');
  CREATE TYPE "public"."enum__events_v_version_regions" AS ENUM('China', 'Japan', 'Korea', 'Philippines', 'Thailand', 'Burma', 'Singapore');
  CREATE TYPE "public"."enum__events_v_version_importance" AS ENUM('major', 'notable');
  CREATE TYPE "public"."enum__events_v_version_review_status" AS ENUM('ai_drafted', 'reviewed');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_people_kind" AS ENUM('person', 'organization', 'group');
  CREATE TYPE "public"."enum_people_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__people_v_version_kind" AS ENUM('person', 'organization', 'group');
  CREATE TYPE "public"."enum__people_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'contributor');
  CREATE TABLE "items_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"label" varchar
  );
  
  CREATE TABLE "items_people" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"role" "enum_items_people_role"
  );
  
  CREATE TABLE "items_regions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_items_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "items_import_issues" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"issue" varchar
  );
  
  CREATE TABLE "items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" varchar,
  	"description" varchar,
  	"rights" varchar,
  	"transcript" varchar,
  	"hide_auto_context" boolean,
  	"archival_repository" varchar,
  	"archival_collection" varchar,
  	"archival_series" varchar,
  	"archival_box" varchar,
  	"archival_folder" varchar,
  	"archival_call_number" varchar,
  	"item_id" varchar,
  	"slug" varchar,
  	"date_sort" timestamp(3) with time zone,
  	"language" varchar,
  	"review_status" "enum_items_review_status" DEFAULT 'ai_generated',
  	"review_reviewed_by_id" integer,
  	"review_reviewed_at" timestamp(3) with time zone,
  	"review_notes" varchar,
  	"ai_model" varchar,
  	"ai_prompt_version" varchar,
  	"ai_transcript_confidence" numeric,
  	"ai_low_confidence" boolean,
  	"ai_field_confidence" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_items_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "items_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"places_id" integer,
  	"subjects_id" integer,
  	"genres_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "_items_v_version_pages" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_items_v_version_people" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"role" "enum__items_v_version_people_role",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_items_v_version_regions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__items_v_version_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_items_v_version_import_issues" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"issue" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_items_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_date" varchar,
  	"version_description" varchar,
  	"version_rights" varchar,
  	"version_transcript" varchar,
  	"version_hide_auto_context" boolean,
  	"version_archival_repository" varchar,
  	"version_archival_collection" varchar,
  	"version_archival_series" varchar,
  	"version_archival_box" varchar,
  	"version_archival_folder" varchar,
  	"version_archival_call_number" varchar,
  	"version_item_id" varchar,
  	"version_slug" varchar,
  	"version_date_sort" timestamp(3) with time zone,
  	"version_language" varchar,
  	"version_review_status" "enum__items_v_version_review_status" DEFAULT 'ai_generated',
  	"version_review_reviewed_by_id" integer,
  	"version_review_reviewed_at" timestamp(3) with time zone,
  	"version_review_notes" varchar,
  	"version_ai_model" varchar,
  	"version_ai_prompt_version" varchar,
  	"version_ai_transcript_confidence" numeric,
  	"version_ai_low_confidence" boolean,
  	"version_ai_field_confidence" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__items_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_items_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"places_id" integer,
  	"subjects_id" integer,
  	"genres_id" integer,
  	"events_id" integer
  );
  
  CREATE TABLE "events_names" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"language" "enum_events_names_language",
  	"name" varchar
  );
  
  CREATE TABLE "events_regions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_events_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "events_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"citation" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"start_date" varchar,
  	"end_date" varchar,
  	"importance" "enum_events_importance" DEFAULT 'notable',
  	"summary" varchar,
  	"start_year" numeric,
  	"end_year" numeric,
  	"review_status" "enum_events_review_status" DEFAULT 'ai_drafted',
  	"review_reviewed_by_id" integer,
  	"review_reviewed_at" timestamp(3) with time zone,
  	"review_notes" varchar,
  	"drafted_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_events_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_events_v_version_names" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"language" "enum__events_v_version_names_language",
  	"name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_regions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__events_v_version_regions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_events_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"citation" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_start_date" varchar,
  	"version_end_date" varchar,
  	"version_importance" "enum__events_v_version_importance" DEFAULT 'notable',
  	"version_summary" varchar,
  	"version_start_year" numeric,
  	"version_end_year" numeric,
  	"version_review_status" "enum__events_v_version_review_status" DEFAULT 'ai_drafted',
  	"version_review_reviewed_by_id" integer,
  	"version_review_reviewed_at" timestamp(3) with time zone,
  	"version_review_notes" varchar,
  	"version_drafted_by" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "people_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "people_merged_from" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"import_key" varchar,
  	"merged_at" timestamp(3) with time zone,
  	"merged_by_id" integer
  );
  
  CREATE TABLE "people" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"kind" "enum_people_kind" DEFAULT 'person',
  	"dates" varchar,
  	"bio" jsonb,
  	"public" boolean DEFAULT false,
  	"import_key" varchar,
  	"needs_review" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_people_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "people_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer
  );
  
  CREATE TABLE "_people_v_version_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_people_v_version_merged_from" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"import_key" varchar,
  	"merged_at" timestamp(3) with time zone,
  	"merged_by_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_people_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_kind" "enum__people_v_version_kind" DEFAULT 'person',
  	"version_dates" varchar,
  	"version_bio" jsonb,
  	"version_public" boolean DEFAULT false,
  	"version_import_key" varchar,
  	"version_needs_review" boolean,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__people_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_people_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer
  );
  
  CREATE TABLE "places" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"authority_uri" varchar,
  	"description" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subjects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"authority_uri" varchar,
  	"description" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "genres" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"authority_uri" varchar,
  	"description" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"public" boolean DEFAULT false,
  	"source_filename" varchar,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_reading_url" varchar,
  	"sizes_reading_width" numeric,
  	"sizes_reading_height" numeric,
  	"sizes_reading_mime_type" varchar,
  	"sizes_reading_filesize" numeric,
  	"sizes_reading_filename" varchar
  );
  
  CREATE TABLE "team" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"title" varchar,
  	"affiliation" varchar,
  	"bio" jsonb,
  	"photo_id" integer,
  	"order" numeric DEFAULT 100,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'contributor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"items_id" integer,
  	"events_id" integer,
  	"people_id" integer,
  	"places_id" integer,
  	"subjects_id" integer,
  	"genres_id" integer,
  	"media_id" integer,
  	"team_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Documenting Asian American Histories in Ohio' NOT NULL,
  	"intro" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "home_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"items_id" integer
  );
  
  CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'About the project' NOT NULL,
  	"body" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "items_pages" ADD CONSTRAINT "items_pages_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "items_pages" ADD CONSTRAINT "items_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_people" ADD CONSTRAINT "items_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "items_people" ADD CONSTRAINT "items_people_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_regions" ADD CONSTRAINT "items_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_import_issues" ADD CONSTRAINT "items_import_issues_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items" ADD CONSTRAINT "items_review_reviewed_by_id_users_id_fk" FOREIGN KEY ("review_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "items_rels" ADD CONSTRAINT "items_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_rels" ADD CONSTRAINT "items_rels_places_fk" FOREIGN KEY ("places_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_rels" ADD CONSTRAINT "items_rels_subjects_fk" FOREIGN KEY ("subjects_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_rels" ADD CONSTRAINT "items_rels_genres_fk" FOREIGN KEY ("genres_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "items_rels" ADD CONSTRAINT "items_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_version_pages" ADD CONSTRAINT "_items_v_version_pages_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v_version_pages" ADD CONSTRAINT "_items_v_version_pages_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_items_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_version_people" ADD CONSTRAINT "_items_v_version_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v_version_people" ADD CONSTRAINT "_items_v_version_people_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_items_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_version_regions" ADD CONSTRAINT "_items_v_version_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_items_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_version_import_issues" ADD CONSTRAINT "_items_v_version_import_issues_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_items_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v" ADD CONSTRAINT "_items_v_parent_id_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v" ADD CONSTRAINT "_items_v_version_review_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_review_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_items_v_rels" ADD CONSTRAINT "_items_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_items_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_rels" ADD CONSTRAINT "_items_v_rels_places_fk" FOREIGN KEY ("places_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_rels" ADD CONSTRAINT "_items_v_rels_subjects_fk" FOREIGN KEY ("subjects_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_rels" ADD CONSTRAINT "_items_v_rels_genres_fk" FOREIGN KEY ("genres_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_rels" ADD CONSTRAINT "_items_v_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_names" ADD CONSTRAINT "events_names_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_regions" ADD CONSTRAINT "events_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_sources" ADD CONSTRAINT "events_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_review_reviewed_by_id_users_id_fk" FOREIGN KEY ("review_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_version_names" ADD CONSTRAINT "_events_v_version_names_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_regions" ADD CONSTRAINT "_events_v_version_regions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_sources" ADD CONSTRAINT "_events_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_review_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_review_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people_aliases" ADD CONSTRAINT "people_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_merged_from" ADD CONSTRAINT "people_merged_from_merged_by_id_users_id_fk" FOREIGN KEY ("merged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people_merged_from" ADD CONSTRAINT "people_merged_from_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people_rels" ADD CONSTRAINT "people_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_people_v_version_aliases" ADD CONSTRAINT "_people_v_version_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_people_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_people_v_version_merged_from" ADD CONSTRAINT "_people_v_version_merged_from_merged_by_id_users_id_fk" FOREIGN KEY ("merged_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_people_v_version_merged_from" ADD CONSTRAINT "_people_v_version_merged_from_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_people_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_people_v" ADD CONSTRAINT "_people_v_parent_id_people_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_people_v_rels" ADD CONSTRAINT "_people_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_people_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_people_v_rels" ADD CONSTRAINT "_people_v_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "team" ADD CONSTRAINT "team_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_items_fk" FOREIGN KEY ("items_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_places_fk" FOREIGN KEY ("places_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subjects_fk" FOREIGN KEY ("subjects_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_genres_fk" FOREIGN KEY ("genres_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_team_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "home_rels" ADD CONSTRAINT "home_rels_items_fk" FOREIGN KEY ("items_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "items_pages_order_idx" ON "items_pages" USING btree ("_order");
  CREATE INDEX "items_pages_parent_id_idx" ON "items_pages" USING btree ("_parent_id");
  CREATE INDEX "items_pages_image_idx" ON "items_pages" USING btree ("image_id");
  CREATE INDEX "items_people_order_idx" ON "items_people" USING btree ("_order");
  CREATE INDEX "items_people_parent_id_idx" ON "items_people" USING btree ("_parent_id");
  CREATE INDEX "items_people_person_idx" ON "items_people" USING btree ("person_id");
  CREATE INDEX "items_regions_order_idx" ON "items_regions" USING btree ("order");
  CREATE INDEX "items_regions_parent_idx" ON "items_regions" USING btree ("parent_id");
  CREATE INDEX "items_import_issues_order_idx" ON "items_import_issues" USING btree ("_order");
  CREATE INDEX "items_import_issues_parent_id_idx" ON "items_import_issues" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "items_item_id_idx" ON "items" USING btree ("item_id");
  CREATE UNIQUE INDEX "items_slug_idx" ON "items" USING btree ("slug");
  CREATE INDEX "items_date_sort_idx" ON "items" USING btree ("date_sort");
  CREATE INDEX "items_review_review_reviewed_by_idx" ON "items" USING btree ("review_reviewed_by_id");
  CREATE INDEX "items_updated_at_idx" ON "items" USING btree ("updated_at");
  CREATE INDEX "items_created_at_idx" ON "items" USING btree ("created_at");
  CREATE INDEX "items__status_idx" ON "items" USING btree ("_status");
  CREATE INDEX "items_rels_order_idx" ON "items_rels" USING btree ("order");
  CREATE INDEX "items_rels_parent_idx" ON "items_rels" USING btree ("parent_id");
  CREATE INDEX "items_rels_path_idx" ON "items_rels" USING btree ("path");
  CREATE INDEX "items_rels_places_id_idx" ON "items_rels" USING btree ("places_id");
  CREATE INDEX "items_rels_subjects_id_idx" ON "items_rels" USING btree ("subjects_id");
  CREATE INDEX "items_rels_genres_id_idx" ON "items_rels" USING btree ("genres_id");
  CREATE INDEX "items_rels_events_id_idx" ON "items_rels" USING btree ("events_id");
  CREATE INDEX "_items_v_version_pages_order_idx" ON "_items_v_version_pages" USING btree ("_order");
  CREATE INDEX "_items_v_version_pages_parent_id_idx" ON "_items_v_version_pages" USING btree ("_parent_id");
  CREATE INDEX "_items_v_version_pages_image_idx" ON "_items_v_version_pages" USING btree ("image_id");
  CREATE INDEX "_items_v_version_people_order_idx" ON "_items_v_version_people" USING btree ("_order");
  CREATE INDEX "_items_v_version_people_parent_id_idx" ON "_items_v_version_people" USING btree ("_parent_id");
  CREATE INDEX "_items_v_version_people_person_idx" ON "_items_v_version_people" USING btree ("person_id");
  CREATE INDEX "_items_v_version_regions_order_idx" ON "_items_v_version_regions" USING btree ("order");
  CREATE INDEX "_items_v_version_regions_parent_idx" ON "_items_v_version_regions" USING btree ("parent_id");
  CREATE INDEX "_items_v_version_import_issues_order_idx" ON "_items_v_version_import_issues" USING btree ("_order");
  CREATE INDEX "_items_v_version_import_issues_parent_id_idx" ON "_items_v_version_import_issues" USING btree ("_parent_id");
  CREATE INDEX "_items_v_parent_idx" ON "_items_v" USING btree ("parent_id");
  CREATE INDEX "_items_v_version_version_item_id_idx" ON "_items_v" USING btree ("version_item_id");
  CREATE INDEX "_items_v_version_version_slug_idx" ON "_items_v" USING btree ("version_slug");
  CREATE INDEX "_items_v_version_version_date_sort_idx" ON "_items_v" USING btree ("version_date_sort");
  CREATE INDEX "_items_v_version_review_version_review_reviewed_by_idx" ON "_items_v" USING btree ("version_review_reviewed_by_id");
  CREATE INDEX "_items_v_version_version_updated_at_idx" ON "_items_v" USING btree ("version_updated_at");
  CREATE INDEX "_items_v_version_version_created_at_idx" ON "_items_v" USING btree ("version_created_at");
  CREATE INDEX "_items_v_version_version__status_idx" ON "_items_v" USING btree ("version__status");
  CREATE INDEX "_items_v_created_at_idx" ON "_items_v" USING btree ("created_at");
  CREATE INDEX "_items_v_updated_at_idx" ON "_items_v" USING btree ("updated_at");
  CREATE INDEX "_items_v_latest_idx" ON "_items_v" USING btree ("latest");
  CREATE INDEX "_items_v_rels_order_idx" ON "_items_v_rels" USING btree ("order");
  CREATE INDEX "_items_v_rels_parent_idx" ON "_items_v_rels" USING btree ("parent_id");
  CREATE INDEX "_items_v_rels_path_idx" ON "_items_v_rels" USING btree ("path");
  CREATE INDEX "_items_v_rels_places_id_idx" ON "_items_v_rels" USING btree ("places_id");
  CREATE INDEX "_items_v_rels_subjects_id_idx" ON "_items_v_rels" USING btree ("subjects_id");
  CREATE INDEX "_items_v_rels_genres_id_idx" ON "_items_v_rels" USING btree ("genres_id");
  CREATE INDEX "_items_v_rels_events_id_idx" ON "_items_v_rels" USING btree ("events_id");
  CREATE INDEX "events_names_order_idx" ON "events_names" USING btree ("_order");
  CREATE INDEX "events_names_parent_id_idx" ON "events_names" USING btree ("_parent_id");
  CREATE INDEX "events_regions_order_idx" ON "events_regions" USING btree ("order");
  CREATE INDEX "events_regions_parent_idx" ON "events_regions" USING btree ("parent_id");
  CREATE INDEX "events_sources_order_idx" ON "events_sources" USING btree ("_order");
  CREATE INDEX "events_sources_parent_id_idx" ON "events_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_start_year_idx" ON "events" USING btree ("start_year");
  CREATE INDEX "events_end_year_idx" ON "events" USING btree ("end_year");
  CREATE INDEX "events_review_review_reviewed_by_idx" ON "events" USING btree ("review_reviewed_by_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "events__status_idx" ON "events" USING btree ("_status");
  CREATE INDEX "_events_v_version_names_order_idx" ON "_events_v_version_names" USING btree ("_order");
  CREATE INDEX "_events_v_version_names_parent_id_idx" ON "_events_v_version_names" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_regions_order_idx" ON "_events_v_version_regions" USING btree ("order");
  CREATE INDEX "_events_v_version_regions_parent_idx" ON "_events_v_version_regions" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_sources_order_idx" ON "_events_v_version_sources" USING btree ("_order");
  CREATE INDEX "_events_v_version_sources_parent_id_idx" ON "_events_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_start_year_idx" ON "_events_v" USING btree ("version_start_year");
  CREATE INDEX "_events_v_version_version_end_year_idx" ON "_events_v" USING btree ("version_end_year");
  CREATE INDEX "_events_v_version_review_version_review_reviewed_by_idx" ON "_events_v" USING btree ("version_review_reviewed_by_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE INDEX "people_aliases_order_idx" ON "people_aliases" USING btree ("_order");
  CREATE INDEX "people_aliases_parent_id_idx" ON "people_aliases" USING btree ("_parent_id");
  CREATE INDEX "people_merged_from_order_idx" ON "people_merged_from" USING btree ("_order");
  CREATE INDEX "people_merged_from_parent_id_idx" ON "people_merged_from" USING btree ("_parent_id");
  CREATE INDEX "people_merged_from_import_key_idx" ON "people_merged_from" USING btree ("import_key");
  CREATE INDEX "people_merged_from_merged_by_idx" ON "people_merged_from" USING btree ("merged_by_id");
  CREATE UNIQUE INDEX "people_slug_idx" ON "people" USING btree ("slug");
  CREATE UNIQUE INDEX "people_import_key_idx" ON "people" USING btree ("import_key");
  CREATE INDEX "people_updated_at_idx" ON "people" USING btree ("updated_at");
  CREATE INDEX "people_created_at_idx" ON "people" USING btree ("created_at");
  CREATE INDEX "people__status_idx" ON "people" USING btree ("_status");
  CREATE INDEX "people_rels_order_idx" ON "people_rels" USING btree ("order");
  CREATE INDEX "people_rels_parent_idx" ON "people_rels" USING btree ("parent_id");
  CREATE INDEX "people_rels_path_idx" ON "people_rels" USING btree ("path");
  CREATE INDEX "people_rels_people_id_idx" ON "people_rels" USING btree ("people_id");
  CREATE INDEX "_people_v_version_aliases_order_idx" ON "_people_v_version_aliases" USING btree ("_order");
  CREATE INDEX "_people_v_version_aliases_parent_id_idx" ON "_people_v_version_aliases" USING btree ("_parent_id");
  CREATE INDEX "_people_v_version_merged_from_order_idx" ON "_people_v_version_merged_from" USING btree ("_order");
  CREATE INDEX "_people_v_version_merged_from_parent_id_idx" ON "_people_v_version_merged_from" USING btree ("_parent_id");
  CREATE INDEX "_people_v_version_merged_from_import_key_idx" ON "_people_v_version_merged_from" USING btree ("import_key");
  CREATE INDEX "_people_v_version_merged_from_merged_by_idx" ON "_people_v_version_merged_from" USING btree ("merged_by_id");
  CREATE INDEX "_people_v_parent_idx" ON "_people_v" USING btree ("parent_id");
  CREATE INDEX "_people_v_version_version_slug_idx" ON "_people_v" USING btree ("version_slug");
  CREATE INDEX "_people_v_version_version_import_key_idx" ON "_people_v" USING btree ("version_import_key");
  CREATE INDEX "_people_v_version_version_updated_at_idx" ON "_people_v" USING btree ("version_updated_at");
  CREATE INDEX "_people_v_version_version_created_at_idx" ON "_people_v" USING btree ("version_created_at");
  CREATE INDEX "_people_v_version_version__status_idx" ON "_people_v" USING btree ("version__status");
  CREATE INDEX "_people_v_created_at_idx" ON "_people_v" USING btree ("created_at");
  CREATE INDEX "_people_v_updated_at_idx" ON "_people_v" USING btree ("updated_at");
  CREATE INDEX "_people_v_latest_idx" ON "_people_v" USING btree ("latest");
  CREATE INDEX "_people_v_rels_order_idx" ON "_people_v_rels" USING btree ("order");
  CREATE INDEX "_people_v_rels_parent_idx" ON "_people_v_rels" USING btree ("parent_id");
  CREATE INDEX "_people_v_rels_path_idx" ON "_people_v_rels" USING btree ("path");
  CREATE INDEX "_people_v_rels_people_id_idx" ON "_people_v_rels" USING btree ("people_id");
  CREATE UNIQUE INDEX "places_name_idx" ON "places" USING btree ("name");
  CREATE UNIQUE INDEX "places_slug_idx" ON "places" USING btree ("slug");
  CREATE INDEX "places_updated_at_idx" ON "places" USING btree ("updated_at");
  CREATE INDEX "places_created_at_idx" ON "places" USING btree ("created_at");
  CREATE UNIQUE INDEX "subjects_name_idx" ON "subjects" USING btree ("name");
  CREATE UNIQUE INDEX "subjects_slug_idx" ON "subjects" USING btree ("slug");
  CREATE INDEX "subjects_updated_at_idx" ON "subjects" USING btree ("updated_at");
  CREATE INDEX "subjects_created_at_idx" ON "subjects" USING btree ("created_at");
  CREATE UNIQUE INDEX "genres_name_idx" ON "genres" USING btree ("name");
  CREATE UNIQUE INDEX "genres_slug_idx" ON "genres" USING btree ("slug");
  CREATE INDEX "genres_updated_at_idx" ON "genres" USING btree ("updated_at");
  CREATE INDEX "genres_created_at_idx" ON "genres" USING btree ("created_at");
  CREATE INDEX "media_source_filename_idx" ON "media" USING btree ("source_filename");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_reading_sizes_reading_filename_idx" ON "media" USING btree ("sizes_reading_filename");
  CREATE INDEX "team_photo_idx" ON "team" USING btree ("photo_id");
  CREATE INDEX "team_updated_at_idx" ON "team" USING btree ("updated_at");
  CREATE INDEX "team_created_at_idx" ON "team" USING btree ("created_at");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_items_id_idx" ON "payload_locked_documents_rels" USING btree ("items_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_people_id_idx" ON "payload_locked_documents_rels" USING btree ("people_id");
  CREATE INDEX "payload_locked_documents_rels_places_id_idx" ON "payload_locked_documents_rels" USING btree ("places_id");
  CREATE INDEX "payload_locked_documents_rels_subjects_id_idx" ON "payload_locked_documents_rels" USING btree ("subjects_id");
  CREATE INDEX "payload_locked_documents_rels_genres_id_idx" ON "payload_locked_documents_rels" USING btree ("genres_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_team_id_idx" ON "payload_locked_documents_rels" USING btree ("team_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "home_rels_order_idx" ON "home_rels" USING btree ("order");
  CREATE INDEX "home_rels_parent_idx" ON "home_rels" USING btree ("parent_id");
  CREATE INDEX "home_rels_path_idx" ON "home_rels" USING btree ("path");
  CREATE INDEX "home_rels_items_id_idx" ON "home_rels" USING btree ("items_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "items_pages" CASCADE;
  DROP TABLE "items_people" CASCADE;
  DROP TABLE "items_regions" CASCADE;
  DROP TABLE "items_import_issues" CASCADE;
  DROP TABLE "items" CASCADE;
  DROP TABLE "items_rels" CASCADE;
  DROP TABLE "_items_v_version_pages" CASCADE;
  DROP TABLE "_items_v_version_people" CASCADE;
  DROP TABLE "_items_v_version_regions" CASCADE;
  DROP TABLE "_items_v_version_import_issues" CASCADE;
  DROP TABLE "_items_v" CASCADE;
  DROP TABLE "_items_v_rels" CASCADE;
  DROP TABLE "events_names" CASCADE;
  DROP TABLE "events_regions" CASCADE;
  DROP TABLE "events_sources" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "_events_v_version_names" CASCADE;
  DROP TABLE "_events_v_version_regions" CASCADE;
  DROP TABLE "_events_v_version_sources" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "people_aliases" CASCADE;
  DROP TABLE "people_merged_from" CASCADE;
  DROP TABLE "people" CASCADE;
  DROP TABLE "people_rels" CASCADE;
  DROP TABLE "_people_v_version_aliases" CASCADE;
  DROP TABLE "_people_v_version_merged_from" CASCADE;
  DROP TABLE "_people_v" CASCADE;
  DROP TABLE "_people_v_rels" CASCADE;
  DROP TABLE "places" CASCADE;
  DROP TABLE "subjects" CASCADE;
  DROP TABLE "genres" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "team" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "home" CASCADE;
  DROP TABLE "home_rels" CASCADE;
  DROP TABLE "about" CASCADE;
  DROP TYPE "public"."enum_items_people_role";
  DROP TYPE "public"."enum_items_regions";
  DROP TYPE "public"."enum_items_review_status";
  DROP TYPE "public"."enum_items_status";
  DROP TYPE "public"."enum__items_v_version_people_role";
  DROP TYPE "public"."enum__items_v_version_regions";
  DROP TYPE "public"."enum__items_v_version_review_status";
  DROP TYPE "public"."enum__items_v_version_status";
  DROP TYPE "public"."enum_events_names_language";
  DROP TYPE "public"."enum_events_regions";
  DROP TYPE "public"."enum_events_importance";
  DROP TYPE "public"."enum_events_review_status";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_names_language";
  DROP TYPE "public"."enum__events_v_version_regions";
  DROP TYPE "public"."enum__events_v_version_importance";
  DROP TYPE "public"."enum__events_v_version_review_status";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum_people_kind";
  DROP TYPE "public"."enum_people_status";
  DROP TYPE "public"."enum__people_v_version_kind";
  DROP TYPE "public"."enum__people_v_version_status";
  DROP TYPE "public"."enum_users_role";`)
}
