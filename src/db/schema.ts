import { sqliteTable, text, int } from "drizzle-orm/sqlite-core";

export const articleTable = sqliteTable("article_table", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  url: text().notNull(),
  userID: text().notNull(),
});
