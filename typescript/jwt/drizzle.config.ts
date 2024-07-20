import './src/load-env.ts'
import { defineConfig } from 'drizzle-kit'
import { connectionString } from './src/db/index.ts'

export default defineConfig({
  dialect: 'postgresql', // database dialect
  schema: './src/db/schema/*', // path to schema files
  out: './drizzle', // output directory for migration scripts
  dbCredentials: {
    url: connectionString, // database connection string
  },
})
