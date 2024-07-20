# Handling JWTs in TypeScript

## 2. Prepare the Database

In this step, you will set up a PostgreSQL database to store user profiles and their hashed passwords. There are differing opinons on how to create your database schema. I tend to favour separate tables for the user objects and their login credentials. This makes it easier to protect personally identifying information and allows for more flexibility in the future if you decide to add additional authentication methods.

You may choose a different approach based on your requirements. The important thing is to ensure that you are storing passwords securely. This tutorial uses the `bcrypt` library to hash passwords before storing them in the database.

> [!IMPORTANT] 
> **Prerequisites**
> - Complete Step 1: Prepare the Project
> - A basic understanding of SQL and relational databases

### 2.1 Tool Options

1. Use a tool like `pgAdmin` or `DBeaver` to create the tables manually.
2. Use the base `pg` library to create the tables programmatically.
3. Use an Object Relational Mapping (ORM) library like [Prisma](https://www.prisma.io) or [drizzle](https://orm.drizzle.team/)

In a real world project you would likely use an ORM library to manage your database schema definition and include db migrations with your project source code. This makes it easier keep your database schema in sync with your application code and both Pisma and Drizzle provide automatic type generation for TypeScript.

For this tutorial, use Drizzle to create the tables programmatically.

> [!NOTE]
> This is not a tutorial on how to use Drizzle. The focus is on handling JWTs in TypeScript. Drizzle is used here to simplify the database setup. I'll cover the basics of using Drizzle in this context. 
> For more information on Drizzle, refer to the excellent [Drizzle Documentation](https://orm.drizzle.team/).

### 2.2.1 Install Drizzle

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

### 2.2 Create a Database Connection

#### 2.2.1 Set the Environment Variables
The connection string parameters are normally injected as environment variables. Set the defaults for your development environment in the `.env` file at the root of the project. 

```
# PostgreSQL Connection
PG_HOST='localhost'
PG_PORT=5432
PG_USER='dev_user'
PG_PASSWORD='dev_password'
PG_DATABASE='authentication_tutorial'
```

> [!NOTE]
> If you prefer, this could all be combined into a single `DATABASE_URL` environment variable rather than assembling the connection string in code. I like the flexibility of being able to override individual parameters for development and testing.

> [!WARNING]
> Your `.env` file should be added to your `.gitignore` file to prevent it from being checked into source control.

#### 2.2.2 Load the Environment Variables

Create a new file in the `src` directory called `load-env.ts` and add the following code:

```typescript
import { config } from 'dotenv'

config()
```

Now edit the `server.ts` file to load the environment variables before starting the server:

```typescript
import './load-env.js'
```

> [!IMPORTANT]
> The import path uses the `.js` extension because the project type is set to **module** in the `package.json` file and the `tsconfig.json` file has "moduleResolution": "NodeNext". The `.js` extension is what the compiled code should look like -- tsc knows how to interpret this.
> These strict module resolution rules may seem odd at first, but this configuration enables modern features like _top-level await_. I think it is worth the trade-off.

#### 2.2.3 Create the Database Querry Client

The `postgres` library is used to create a connection to the database. That querry client is passed to the `drizzle` function to create the ORM instance.

Create a new file called `src/db/index.ts` and add the following code:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const host = process.env.PG_HOST || 'localhost'
const port = process.env.PG_PORT || '5432'
const user = process.env.PG_USER || 'dev_user'
const password = process.env.PG_PASSWORD || 'dev_password'
const database = process.env.PG_DATABASE || 'authentication_tutorial'

export const connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`

const querryClient = postgres(connectionString)

export const db = drizzle(querryClient)
```

#### 2.2.4 Test the connection

This would be a good time to check your work. Temporarily add the following code to the top of the `server.ts` file to test the connection:

```typescript
import { sql } from 'drizzle-orm'
import { db } from './db/index.js'

// test the db connection
// should output => db result:  Result(1) [ { result: 2 } ]
console.debug('db result: ', await db.execute(sql`SELECT 1 + 1 AS result`))
```

Run the server with `pnpm run dev` and check the console output. If you see the expected result, then the database connection is working. 

This would be a good time to commit your changes.

Now you can remove the test code from the `server.ts` file.

### 2.3 Create database schema
Now that you have a working database connection, you can define the database  schema for each table. 

Let's start by creating a table to store user profiles with a simple set of attributes:
  - `id` - a unique identifier for the user
  - `firstName` - the user's first name
  - `lastName` - the user's last name
  - `email` - the user's email address, which should be unique


#### 2.3.1 Install the UUID7 Library
I like to use UUIDs for primary keys in my tables. This provides better scalability and security than using auto-incrementing integers. UUID version 7 is a good choice because it is time-based and sortable. It uses half the storage space of UUID version 4 and is more secure than UUID version 1.

```bash
pnpm add uuid7
```

> [!NOTE]
> If you prefer to use auto-incrementing integers, you can skip this step and use the `bigserial` column type provided by Drizzle to create the primary key column.
  
#### 2.3.2 Create the User Table Schema
  
Create a `src/db/schema` directory and add a new file called `user.ts` with the following code:

```typescript
import { boolean, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { uuidv7 } from 'uuidv7'

export const users = pgTable('users', {
  id: uuid('id').$defaultFn(uuidv7).primaryKey(),
  firstName: varchar('first_name', { length: 256 }).notNull(),
  lastName: varchar('last_name', { length: 256 }).notNull(),
  email: varchar('email', { length: 256 }).unique().notNull(),
})
```

#### 2.3.3 Add the schema for the User Credentials table

The user credentials table will store the user's loginName (which may or may not be their email) and a password hash. This table will be used to authenticate users and link them to their full profile.

This could go in a separate file, but for simplicity, just add it to the same file as the user profile schema.

```typescript

export const userCredentials = pgTable('user_credentials', {
  id: uuid('id').$defaultFn(uuidv7).primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  loginName: varchar('login_name', { length: 256 }).unique().notNull(),
  passwordHash: varchar('password', { length: 256 }).notNull(),
  isSuspended: boolean('is_suspended').notNull().default(false),
})

```

#### 2.3.4 Optional - Add a Timestamps Extension
It is a very common pattern to add `created_at` and `updated_at` columns to tables to track when records were created and last updated. You can easily add these two columns to all tables at the end of the feild definitions like so ...

```typescript
createdAt: timestamp('created_at', {
  mode: 'date',
  precision: 3,
}).defaultNow(),

updatedAt: timestamp('updated_at', { mode: 'date', precision: 3 }).$onUpdate(
  () => new Date(),
),
```

### 2.4 Deploy the table definitions to your database

You can use the `drizzle-kit` CLI to generate a migration script that will create the tables in your database. First you need to create a configuration file for the CLI.

#### 2.4.1 Dizzle Configuration File
At the root of your project, create a file called `drizzle.config.ts` and add the following code:

```typescript
import './src/load-env.ts'
import { defineConfig } from 'drizzle-kit'
import { connectionString } from './src/db/index.ts'

export default defineConfig({
  dialect: 'postgresql',       // database dialect
  schema: './src/db/schema/*', // path to schema files
  out: './drizzle',            // output directory for migration scripts
  dbCredentials: {
    url: connectionString,     // database connection string
  },
})
```
> [!IMPORTANT]
> *dirzzle-kit* runs the TypeScript code directly, so the relative import paths include the `.ts` extension.

Add two new convenience scripts to the `package.json` file:

```json
"scripts": {
  ...
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate"
}
```

#### 2.4.2 Create a migration script
Run `pnpm run db:generate` to create the migration script. This will create a new directory called `drizzle` with a sequentially numbered migration script (SQL) that will create the tables in your database.

> [!WARNING]
> Do not modify the migration script. It is generated automatically and should not be edited by hand. Especially do not add or remove files from the `drizzle` directory. See the docs for more information on how to manage migrations.

<details>
  <summary>Expand to see the generated migration script</summary>

```sql
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
```

#### 2.4.3 Run the migration script

Run `pnpm run db:migrate` to execute the migration script and create the tables in your database. You can inspect the database with a tool like [TablePlus](https://tableplus.com/) to verify that the tables were created successfully.
