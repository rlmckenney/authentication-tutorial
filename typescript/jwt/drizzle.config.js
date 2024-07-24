import { defineConfig } from 'drizzle-kit'
import { DB } from './dist/config.js'

export default defineConfig({
  dialect: 'postgresql', // database dialect
  schema: './dist/db/schema.js', // path to schema files
  out: './drizzle', // output directory for migration scripts
  dbCredentials: {
    url: DB.connectionString, // database connection string
  },
})
