import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_annotations_category" AS ENUM('context', 'person', 'place', 'translation', 'correction', 'harmful-language', 'other');
  CREATE TYPE "public"."enum_annotations_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');
  CREATE TYPE "public"."enum__annotations_v_version_category" AS ENUM('context', 'person', 'place', 'translation', 'correction', 'harmful-language', 'other');
  CREATE TYPE "public"."enum__annotations_v_version_status" AS ENUM('draft', 'submitted', 'approved', 'rejected');
  CREATE TABLE "annotations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"quote" varchar NOT NULL,
  	"category" "enum_annotations_category" DEFAULT 'context' NOT NULL,
  	"body" varchar NOT NULL,
  	"status" "enum_annotations_status" DEFAULT 'submitted' NOT NULL,
  	"review_note" varchar,
  	"author_id" integer,
  	"last_edited_by_id" integer,
  	"reviewed_by_id" integer,
  	"reviewed_at" timestamp(3) with time zone,
  	"start" numeric,
  	"end" numeric,
  	"prefix" varchar,
  	"suffix" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_annotations_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_item_id" integer NOT NULL,
  	"version_quote" varchar NOT NULL,
  	"version_category" "enum__annotations_v_version_category" DEFAULT 'context' NOT NULL,
  	"version_body" varchar NOT NULL,
  	"version_status" "enum__annotations_v_version_status" DEFAULT 'submitted' NOT NULL,
  	"version_review_note" varchar,
  	"version_author_id" integer,
  	"version_last_edited_by_id" integer,
  	"version_reviewed_by_id" integer,
  	"version_reviewed_at" timestamp(3) with time zone,
  	"version_start" numeric,
  	"version_end" numeric,
  	"version_prefix" varchar,
  	"version_suffix" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "annotations_id" integer;
  ALTER TABLE "annotations" ADD CONSTRAINT "annotations_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "annotations" ADD CONSTRAINT "annotations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "annotations" ADD CONSTRAINT "annotations_last_edited_by_id_users_id_fk" FOREIGN KEY ("last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "annotations" ADD CONSTRAINT "annotations_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_annotations_v" ADD CONSTRAINT "_annotations_v_parent_id_annotations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."annotations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_annotations_v" ADD CONSTRAINT "_annotations_v_version_item_id_items_id_fk" FOREIGN KEY ("version_item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_annotations_v" ADD CONSTRAINT "_annotations_v_version_author_id_users_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_annotations_v" ADD CONSTRAINT "_annotations_v_version_last_edited_by_id_users_id_fk" FOREIGN KEY ("version_last_edited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_annotations_v" ADD CONSTRAINT "_annotations_v_version_reviewed_by_id_users_id_fk" FOREIGN KEY ("version_reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "annotations_item_idx" ON "annotations" USING btree ("item_id");
  CREATE INDEX "annotations_status_idx" ON "annotations" USING btree ("status");
  CREATE INDEX "annotations_author_idx" ON "annotations" USING btree ("author_id");
  CREATE INDEX "annotations_last_edited_by_idx" ON "annotations" USING btree ("last_edited_by_id");
  CREATE INDEX "annotations_reviewed_by_idx" ON "annotations" USING btree ("reviewed_by_id");
  CREATE INDEX "annotations_updated_at_idx" ON "annotations" USING btree ("updated_at");
  CREATE INDEX "annotations_created_at_idx" ON "annotations" USING btree ("created_at");
  CREATE INDEX "_annotations_v_parent_idx" ON "_annotations_v" USING btree ("parent_id");
  CREATE INDEX "_annotations_v_version_version_item_idx" ON "_annotations_v" USING btree ("version_item_id");
  CREATE INDEX "_annotations_v_version_version_status_idx" ON "_annotations_v" USING btree ("version_status");
  CREATE INDEX "_annotations_v_version_version_author_idx" ON "_annotations_v" USING btree ("version_author_id");
  CREATE INDEX "_annotations_v_version_version_last_edited_by_idx" ON "_annotations_v" USING btree ("version_last_edited_by_id");
  CREATE INDEX "_annotations_v_version_version_reviewed_by_idx" ON "_annotations_v" USING btree ("version_reviewed_by_id");
  CREATE INDEX "_annotations_v_version_version_updated_at_idx" ON "_annotations_v" USING btree ("version_updated_at");
  CREATE INDEX "_annotations_v_version_version_created_at_idx" ON "_annotations_v" USING btree ("version_created_at");
  CREATE INDEX "_annotations_v_created_at_idx" ON "_annotations_v" USING btree ("created_at");
  CREATE INDEX "_annotations_v_updated_at_idx" ON "_annotations_v" USING btree ("updated_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_annotations_fk" FOREIGN KEY ("annotations_id") REFERENCES "public"."annotations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_annotations_id_idx" ON "payload_locked_documents_rels" USING btree ("annotations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "annotations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_annotations_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "annotations" CASCADE;
  DROP TABLE "_annotations_v" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_annotations_fk";
  
  DROP INDEX "payload_locked_documents_rels_annotations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "annotations_id";
  DROP TYPE "public"."enum_annotations_category";
  DROP TYPE "public"."enum_annotations_status";
  DROP TYPE "public"."enum__annotations_v_version_category";
  DROP TYPE "public"."enum__annotations_v_version_status";`)
}
