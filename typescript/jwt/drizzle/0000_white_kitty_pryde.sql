CREATE TABLE IF NOT EXISTS "user_credentials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"login_name" varchar(256) NOT NULL,
	"password" varchar(256) NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) DEFAULT now(),
	"updated_at" timestamp (3),
	CONSTRAINT "user_credentials_login_name_unique" UNIQUE("login_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(256) NOT NULL,
	"last_name" varchar(256) NOT NULL,
	"email" varchar(256) NOT NULL,
	"created_at" timestamp (3) DEFAULT now(),
	"updated_at" timestamp (3),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
