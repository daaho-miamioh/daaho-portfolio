import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_items_review_by_people" AS ENUM('title', 'description', 'transcript', 'links');
  CREATE TYPE "public"."enum__items_v_version_review_by_people" AS ENUM('title', 'description', 'transcript', 'links');
  CREATE TABLE "items_review_by_people" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_items_review_by_people",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_items_v_version_review_by_people" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__items_v_version_review_by_people",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  ALTER TABLE "items_review_by_people" ADD CONSTRAINT "items_review_by_people_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_items_v_version_review_by_people" ADD CONSTRAINT "_items_v_version_review_by_people_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_items_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "items_review_by_people_order_idx" ON "items_review_by_people" USING btree ("order");
  CREATE INDEX "items_review_by_people_parent_idx" ON "items_review_by_people" USING btree ("parent_id");
  CREATE INDEX "_items_v_version_review_by_people_order_idx" ON "_items_v_version_review_by_people" USING btree ("order");
  CREATE INDEX "_items_v_version_review_by_people_parent_idx" ON "_items_v_version_review_by_people" USING btree ("parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "items_review_by_people" CASCADE;
  DROP TABLE "_items_v_version_review_by_people" CASCADE;
  DROP TYPE "public"."enum_items_review_by_people";
  DROP TYPE "public"."enum__items_v_version_review_by_people";`)
}
