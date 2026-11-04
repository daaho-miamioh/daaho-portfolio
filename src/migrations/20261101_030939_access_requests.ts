import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_access_requests_kind" AS ENUM('student', 'researcher', 'library', 'community', 'other');
  CREATE TYPE "public"."enum_access_requests_status" AS ENUM('pending', 'approved', 'declined');
  CREATE TABLE "access_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"affiliation" varchar,
  	"kind" "enum_access_requests_kind" NOT NULL,
  	"reason" varchar NOT NULL,
  	"staff_note" varchar,
  	"status" "enum_access_requests_status" DEFAULT 'pending' NOT NULL,
  	"account_id" integer,
  	"decided_by_id" integer,
  	"decided_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "access_requests_id" integer;
  ALTER TABLE "settings" ADD COLUMN "accept_access_requests" boolean DEFAULT true;
  ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "access_requests_email_idx" ON "access_requests" USING btree ("email");
  CREATE INDEX "access_requests_status_idx" ON "access_requests" USING btree ("status");
  CREATE INDEX "access_requests_account_idx" ON "access_requests" USING btree ("account_id");
  CREATE INDEX "access_requests_decided_by_idx" ON "access_requests" USING btree ("decided_by_id");
  CREATE INDEX "access_requests_updated_at_idx" ON "access_requests" USING btree ("updated_at");
  CREATE INDEX "access_requests_created_at_idx" ON "access_requests" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_access_requests_fk" FOREIGN KEY ("access_requests_id") REFERENCES "public"."access_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_access_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("access_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "access_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "access_requests" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_access_requests_fk";
  
  DROP INDEX "payload_locked_documents_rels_access_requests_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "access_requests_id";
  ALTER TABLE "settings" DROP COLUMN "accept_access_requests";
  DROP TYPE "public"."enum_access_requests_kind";
  DROP TYPE "public"."enum_access_requests_status";`)
}
