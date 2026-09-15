import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const categoriesTable = pgTable("quickcart_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  itemCount: integer("item_count").notNull().default(0),
});

export const catalogItemsTable = pgTable("quickcart_catalog_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }).notNull().default("0"),
  stock: integer("stock").notNull().default(0),
  emoji: text("emoji").notNull().default(""),
  badge: text("badge").notNull().default(""),
});

export const ordersTable = pgTable("quickcart_orders", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  status: text("status").notNull().default("placed"),
  items: jsonb("items").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  address: text("address").notNull(),
  eta: text("eta").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryZonesTable = pgTable("quickcart_delivery_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  eta: text("eta").notNull(),
  fee: numeric("fee", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  orderCount: integer("order_count").notNull().default(0),
});

export type Category = typeof categoriesTable.$inferSelect;
export type CatalogItem = typeof catalogItemsTable.$inferSelect;
export type Order = typeof ordersTable.$inferSelect;
export type DeliveryZone = typeof deliveryZonesTable.$inferSelect;