# Handling JWTs in TypeScript

## 1. Prepare the Project

> [!NOTE]
> This tutorial is using [pnpm](https://pnpm.io/) as the package manager. Feel free to use `npm` or `yarn` if you prefer. Adjust the commands accordingly.

The following instructions will guide your through setting up the base TypeScript project that you will use for the JWT tutorial. There is nothing particular to JWTs in this step, but it is important to have a good foundation to build upon.

> [!TIP]
> You can save time by copying my [Express TypeScript template repository]().

### 1.1. Create a new project folder structure

If you haven't already, create a new project folder for the JWT TypeScript tutorial series. e.g.:
```bash
mkdir -p authentication-tutorials/typescript-jwt
cd authentication-tutorials/typescript-jwt
mkdir src
mkdir dist
```

### 1.2. Initialize a new Node.js project

```bash
pnpm init
git init
```

### 1.3 Create a basic .gitignore file
Copy the following basic configuration into a file named `.gitignore` in the root of your project folder:

<details>
  <summary>Example .gitignore file</summary>

```plaintext
# Logs
logs
_.log
npm-debug.log_
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]_.[0-9]_.[0-9]_.[0-9]_.json

# Runtime data
pids
_.pid
_.seed
\*.pid.lock

# Coverage directory used by tools like istanbul
coverage
\*.lcov

# Dependency directories
node_modules/
jspm_packages/

# TypeScript cache
\*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# Generated output
dist

# Stores VSCode versions used for testing VSCode extensions
.vscode-test


# Yarn Integrity file
.yarn-integrity

# yarn v2
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.\*

# IntelliJ based IDEs
.idea

# Finder (MacOS) folder config
.DS_Store
```
</details>

### 1.4. Install the necessary dependencies
Let's use the well know `express` library to create a simple web server. You will also need `typescript` to compile your code and `jiti` to help run tests. Type definitions for `node` and `express` are not bundled, so they need to be installed separately.

```bash
pnpm add express
pnpm add -D typescript jiti @types/node @types/express
```

### 1.5. Create a `tsconfig.json` file
Create a `tsconfig.json` file in the root of your project folder with the following content:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Node 20 (LTS)",
  "_version": "20.0.0",

  "compilerOptions": {
    /* Base Options: */
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "es2022",
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    // "verbatimModuleSyntax": true,
    /* Strictness */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    /* If transpiling with TypeScript: */
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "sourceMap": true,
    /* If your code doesn't run in the DOM: */
    "lib": ["es2022"]
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

### 1.6. Update the `package.json` file
 - Update the project title and description to your liking.
 - I like to start my projects at `version: 0.0.1`.
 - Set the main entrypoint to `dist/server.js`.
 - Set the `engines` to `node: >=20.0.0`.
 - Set the `type` to `module`.
 - Add the following scripts:
    - `start`: to run the compiled code.
    - `build`: to compile the TypeScript code.
    - `dev`: to run the TypeScript code in development mode. (this will be in 2 parts)
    - `test`: to run the tests.

<details>
  <summary>My package.json file looks like this:</summary>

```json
{
  "name": "typescript-jwt",
  "version": "0.0.1",
  "description": "A reference implementation of JWT handling in TypeScript",
  "keywords": [
    "TypeScript",
    "JWT",
    "Express",
    "Node.js"
  ],
  "author": "Robert McKenney <robert@mckenney.ca>",
  "license": "MIT",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev:tsc": "tsc --watch --preserveWatchOutput",
    "dev:node": "node --enable-source-maps --watch dist/server.js",
    "dev": "pnpm run \"/dev:/\"",
    "test": "JITI_SOURCE_MAPS=true node --require jiti/register --test src/**/*.test.ts"
  },
  "packageManager": "pnpm@9.1.4+sha512.9df9cf27c91715646c7d675d1c9c8e41f6fce88246f1318c1aa6a1ed1aeb3c4f032fcdf4ba63cc69c4fe6d634279176b5358727d8f2cc1e65b65f43ce2f8bfb0",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.11",
    "jiti": "^1.21.6",
    "typescript": "^5.5.3"
  }
}
```
</details>

### 1.7. Configure prettier
To ensure consistent formatting, you can use `prettier`. You can install it with the following command:

```bash
pnpm add -D prettier
```

Then create a `.prettierrc` file in the root of your project folder with the following content:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all"
}
```

### 1.8 Configure ESLint

To help with consistent code quality, you can use `eslint`. You can install it with the following command:

```bash
pnpm create @eslint/config@latest
```

This will ask you a few questions and then install the necessary dependencies and create the `.eslintrc` file in the root of your project.

Here is how I answered the setup questions:

```bash
✔ How would you like to use ESLint? · problems
✔ What type of modules does your project use? · esm
✔ Which framework does your project use? · none
✔ Does your project use TypeScript? · typescript
✔ Where does your code run? · node
The config that you've selected requires the following dependencies:

eslint@9.x, globals, @eslint/js, typescript-eslint
✔ Would you like to install them now? · No / Yes
✔ Which package manager do you want to use? · pnpm
```

Add a new script to your `package.json` file to run ESLint:

```json
"lint": "eslint src/**/*.ts"
```

### 1.8. Create a simple Express server
Create a new file named `src/server.ts` with the following content:

```typescript
import { createServer } from 'node:http'
import express from 'express'

/**
 * Create a simple Express router application.
 */
const app = express()
app.get('/ping', (req, res) => {
  res.send('pong')
})

/**
 * Create HTTP server.
 * HTTP server listen on provided port, on all network interfaces.
 */
const server = createServer(app)
const port = Number(process.env.API_PORT) || 3000
const host = process.env.API_HOST || '0.0.0.0'

server.listen({ port, host })

server.on('error', (err: Error) => {
  console.error(`Express failed to listen \n ${err.message} ...\n`, err.stack)
})

server.on('listening', () => {
  console.info(`Express server is listening at ${host}:${port}`)
})

```

### 1.9. Run the server
You can now run the server with the following command in your terminal:

```bash
pnpm run dev
```
This will run both the TypeScript compiler and the Node.js server in watch mode.

If everything is set up correctly, you should see output similar to this:

```bash
. dev:tsc$ tsc --watch --preserveWatchOutput
│ 7:18:05 p.m. - Starting compilation in watch mode...
│ 7:18:06 p.m. - Found 0 errors. Watching for file changes.
└─ Running...
. dev:node$ node --enable-source-maps --watch dist/server.js
│ Express server is listening at 0.0.0.0:3000
│ Restarting 'dist/server.js'
│ Express server is listening at 0.0.0.0:3000
└─ Running...
```

You can now open your browser and navigate to `http://localhost:3000/ping` to see the response `pong`.

> [!NOTE]
> Congratulations! 
> You have successfully set up the base TypeScript project with Express.js. With that in place, you can now start building JWT authentication handlers.

[Next step](./step-2.md)
