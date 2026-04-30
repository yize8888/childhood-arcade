import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Status enum (soft-delete pattern copied from retroassembly)
export const STATUS = Object.freeze({
  deleted: 0,
  normal: 1,
})

const ts = () => integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)
const tsNullable = () => integer({ mode: 'timestamp' })

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: ts('updated_at').$onUpdateFn(() => new Date()),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  status: integer('status').notNull().default(STATUS.normal),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at').$onUpdateFn(() => new Date()),
})

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  ip: text('ip'),
  userAgent: text('user_agent'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  lastActivityAt: ts('last_activity_at').$onUpdateFn(() => new Date()),
  createdAt: ts('created_at'),
}, (t) => [
  index('idx_sessions_user').on(t.userId),
  index('idx_sessions_expires').on(t.expiresAt),
])

export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  hostUserId: integer('host_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  romId: integer('rom_id').notNull().references(() => roms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  allowPlay: integer('allow_play', { mode: 'boolean' }).notNull().default(true),
  passwordHash: text('password_hash'),
  status: integer('status').notNull().default(STATUS.normal),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at').$onUpdateFn(() => new Date()),
  closedAt: tsNullable('closed_at'),
})

export const roms = sqliteTable('roms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  platform: text('platform').notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  // Optional parent ROM — for arcade clone/variant sets where the child depends
  // on shared data from the parent (e.g. kof97pls is a split clone of kof97).
  // Children are hidden from the main Gallery list and shown as a version
  // picker on the parent's detail. `null` = this ROM is a top-level game.
  parentRomId: integer('parent_rom_id'),
  versionLabel: text('version_label'),
  status: integer('status').notNull().default(STATUS.normal),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at').$onUpdateFn(() => new Date()),
})

export const favorites = sqliteTable('favorites', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  romId: integer('rom_id').notNull().references(() => roms.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at'),
}, (t) => [
  index('idx_favorites_user').on(t.userId),
  index('idx_favorites_rom').on(t.romId),
])

export const saveStates = sqliteTable('save_states', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  romId: integer('rom_id').notNull().references(() => roms.id, { onDelete: 'cascade' }),
  slot: integer('slot').notNull().default(0),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  status: integer('status').notNull().default(STATUS.normal),
  updatedAt: ts('updated_at').$onUpdateFn(() => new Date()),
})
