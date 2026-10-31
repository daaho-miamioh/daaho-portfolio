import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_action" AS ENUM('create', 'update', 'publish', 'unpublish', 'delete', 'invite', 'login', 'logout', 'login_failed', 'reset_requested', 'password');
  CREATE TABLE "activity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"summary" varchar NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"action" "enum_activity_action" NOT NULL,
  	"user_id" integer,
  	"who" varchar,
  	"record_type" varchar,
  	"record_id" varchar,
  	"record_title" varchar,
  	"changes" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_id" integer;
  ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "activity_created_at_idx" ON "activity" USING btree ("created_at");
  CREATE INDEX "activity_action_idx" ON "activity" USING btree ("action");
  CREATE INDEX "activity_user_idx" ON "activity" USING btree ("user_id");
  CREATE INDEX "activity_record_type_idx" ON "activity" USING btree ("record_type");
  CREATE INDEX "activity_record_id_idx" ON "activity" USING btree ("record_id");
  CREATE INDEX "activity_updated_at_idx" ON "activity" USING btree ("updated_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activity_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activity_fk";
  
  DROP INDEX "payload_locked_documents_rels_activity_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activity_id";
  DROP TYPE "public"."enum_activity_action";`)
}
