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

const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE } = process.env

const connectionString = `postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`

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

### 2.3 Create the User Table
