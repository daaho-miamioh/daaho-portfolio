import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_team_group" ADD VALUE 'former-team' BEFORE 'former-students';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "team" ALTER COLUMN "group" SET DATA TYPE text;
  ALTER TABLE "team" ALTER COLUMN "group" SET DEFAULT 'partners'::text;
  DROP TYPE "public"."enum_team_group";
  CREATE TYPE "public"."enum_team_group" AS ENUM('project-team', 'partners', 'committee', 'former-students');
  ALTER TABLE "team" ALTER COLUMN "group" SET DEFAULT 'partners'::"public"."enum_team_group";
  ALTER TABLE "team" ALTER COLUMN "group" SET DATA TYPE "public"."enum_team_group" USING "group"::"public"."enum_team_group";`)
}
