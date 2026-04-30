import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.js',
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DB_PATH || 'data/app.db',
  },
  casing: 'snake_case',
})
