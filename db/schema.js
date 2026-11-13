import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{
  ownerId:text('owner_id').primaryKey().notNull(),
  data:text('data').notNull(),
  revision:integer('revision').notNull().default(0),
  updatedAt:text('updated_at').notNull()
});
export const authAccounts=sqliteTable('auth_accounts',{
 username:text('username').primaryKey().notNull(),
 passwordHash:text('password_hash').notNull(),
 salt:text('salt').notNull(),
 passwordVersion:integer('password_version').notNull().default(1)
});
export const authSessions=sqliteTable('auth_sessions',{
 tokenHash:text('token_hash').primaryKey().notNull(),
 username:text('username').notNull(),
 passwordVersion:integer('password_version').notNull(),
 expiresAt:integer('expires_at').notNull()
});
export const authAttempts=sqliteTable('auth_attempts',{
 bucketKey:text('bucket_key').primaryKey().notNull(),
 attempts:integer('attempts').notNull().default(0),
 expiresAt:integer('expires_at').notNull()
});
