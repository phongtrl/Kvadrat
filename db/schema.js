import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const workspaces=sqliteTable('workspaces',{
  ownerId:text('owner_id').primaryKey().notNull(),
  data:text('data').notNull(),
  revision:integer('revision').notNull().default(0),
  updatedAt:text('updated_at').notNull()
});
