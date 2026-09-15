import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  categoriesTable,
  catalogItemsTable,
  deliveryZonesTable,
  ordersTable,
} from "@workspace/db";
import {
  CreateDeliveryZoneBody,
  CreateOrderBody,
  ListCatalogItemsQueryParams,
  ListOrdersQueryParams,
  UpdateCatalogItemBody,
  UpdateCatalogItemParams,
  UpdateDeliveryZoneBody,
  UpdateDeliveryZoneParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const statusLabels = {
  placed: "Order placed",
  packing: "Packing your order",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
} as const;

type OrderStatus = keyof typeof statusLabels;

const toNumber = (value: string | number | null | undefined) =>
  Number(value ?? 0);

const serializeCategory = (category: typeof categoriesTable.$inferSelect) => ({
  id: category.id,
  name: category.name,
  itemCount: category.itemCount,
});

const serializeItem = (item: typeof catalogItemsTable.$inferSelect) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  unit: item.unit,
  price: toNumber(item.price),
  compareAtPrice: toNumber(item.compareAtPrice),
  stock: item.stock,
  emoji: item.emoji,
  badge: item.badge,
});

const serializeOrder = (order: typeof ordersTable.$inferSelect) => {
  const status = (order.status in statusLabels ? order.status : "placed") as OrderStatus;
  return {
    id: order.id,
    customerName: order.customerName,
    status,
    statusLabel: statusLabels[status],
    items: order.items,
    subtotal: toNumber(order.subtotal),
    deliveryFee: toNumber(order.deliveryFee),
    total: toNumber(order.total),
    address: order.address,
    eta: order.eta,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
};

const seedPromise = (async () => {
  const existing = await db.select({ id: catalogItemsTable.id }).from(catalogItemsTable).limit(1);
  if (existing.length > 0) return;

  await db.insert(categoriesTable).values([
    { id: "fresh", name: "Fresh produce", itemCount: 6 },
    { id: "dairy", name: "Dairy & eggs", itemCount: 4 },
    { id: "snacks", name: "Snacks", itemCount: 5 },
    { id: "beverages", name: "Beverages", itemCount: 4 },
    { id: "household", name: "Household", itemCount: 4 },
  ]);

  await db.insert(catalogItemsTable).values([
    { name: "Avocado", category: "fresh", unit: "2 pack", price: "2.49", compareAtPrice: "2.99", stock: 24, emoji: "🥑", badge: "Popular" },
    { name: "Bananas", category: "fresh", unit: "1 kg", price: "1.69", compareAtPrice: "1.99", stock: 31, emoji: "🍌", badge: "Best value" },
    { name: "Cherry tomatoes", category: "fresh", unit: "250 g", price: "2.29", compareAtPrice: "2.79", stock: 16, emoji: "🍅", badge: "Fresh today" },
    { name: "Baby spinach", category: "fresh", unit: "150 g", price: "2.99", compareAtPrice: "3.49", stock: 11, emoji: "🥬", badge: "" },
    { name: "Greek yogurt", category: "dairy", unit: "500 g", price: "3.49", compareAtPrice: "3.99", stock: 18, emoji: "🥣", badge: "High protein" },
    { name: "Farm eggs", category: "dairy", unit: "12 pack", price: "4.19", compareAtPrice: "4.79", stock: 9, emoji: "🥚", badge: "" },
    { name: "Salted potato chips", category: "snacks", unit: "150 g", price: "2.19", compareAtPrice: "2.49", stock: 27, emoji: "🥔", badge: "Crunch time" },
    { name: "Dark chocolate", category: "snacks", unit: "100 g", price: "2.79", compareAtPrice: "3.29", stock: 14, emoji: "🍫", badge: "" },
    { name: "Sparkling water", category: "beverages", unit: "6 x 330 ml", price: "3.99", compareAtPrice: "4.49", stock: 22, emoji: "💧", badge: "Chilled" },
    { name: "Cold brew coffee", category: "beverages", unit: "250 ml", price: "3.29", compareAtPrice: "3.79", stock: 7, emoji: "☕", badge: "Caffeine fix" },
    { name: "Dish soap", category: "household", unit: "500 ml", price: "2.89", compareAtPrice: "3.29", stock: 19, emoji: "🧼", badge: "" },
    { name: "Paper towels", category: "household", unit: "2 rolls", price: "3.59", compareAtPrice: "4.19", stock: 6, emoji: "🧻", badge: "Low stock" },
  ]);

  await db.insert(deliveryZonesTable).values([
    { name: "Indiranagar", eta: "10–20 min", fee: "1.99", active: true, orderCount: 184 },
    { name: "Koramangala", eta: "15–25 min", fee: "1.99", active: true, orderCount: 142 },
    { name: "HSR Layout", eta: "20–30 min", fee: "2.49", active: true, orderCount: 96 },
  ]);

  const items = await db.select().from(catalogItemsTable).orderBy(asc(catalogItemsTable.id));
  await db.insert(ordersTable).values([
    {
      customerName: "Alex Morgan",
      status: "packing",
      items: [
        { id: items[0].id, name: items[0].name, quantity: 1, price: 2.49, unit: items[0].unit, emoji: items[0].emoji },
        { id: items[4].id, name: items[4].name, quantity: 1, price: 3.49, unit: items[4].unit, emoji: items[4].emoji },
      ],
      subtotal: "5.98",
      deliveryFee: "1.99",
      total: "7.97",
      address: "42, 12th Main, Indiranagar",
      eta: "12–18 min",
    },
  ]);
})();

const ensureSeeded = async () => {
  await seedPromise;
};

router.get("/catalog/categories", async (_req, res) => {
  await ensureSeeded();
  const rows = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
  res.json(rows.map(serializeCategory));
});

router.get("/catalog/items", async (req, res) => {
  await ensureSeeded();
  const parsed = ListCatalogItemsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid catalog filters" });
    return;
  }

  const { category, search } = parsed.data;
  const rows = await db.select().from(catalogItemsTable).orderBy(asc(catalogItemsTable.id));
  const filtered = rows.filter((item) => {
    const categoryMatch = !category || category === "all" || item.category === category;
    const searchMatch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  });
  res.json(filtered.map(serializeItem));
});

router.patch("/catalog/items/:id", async (req, res) => {
  await ensureSeeded();
  const params = UpdateCatalogItemParams.safeParse(req.params);
  const body = UpdateCatalogItemBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid item update" });
    return;
  }
  const current = await db.select().from(catalogItemsTable).where(eq(catalogItemsTable.id, params.data.id)).limit(1);
  if (!current[0]) {
    res.status(404).json({ error: "Catalog item not found" });
    return;
  }
  const updated = await db.update(catalogItemsTable)
    .set({
      ...(body.data.price === undefined ? {} : { price: body.data.price.toFixed(2) }),
      ...(body.data.stock === undefined ? {} : { stock: body.data.stock }),
      ...(body.data.badge === undefined ? {} : { badge: body.data.badge }),
    })
    .where(eq(catalogItemsTable.id, params.data.id))
    .returning();
  res.json(serializeItem(updated[0]));
});

router.get("/orders", async (req, res) => {
  await ensureSeeded();
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order filters" });
    return;
  }
  const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  res.json(rows.map(serializeOrder));
});

router.post("/orders", async (req, res) => {
  await ensureSeeded();
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order" });
    return;
  }

  const ids = parsed.data.items.map((item) => item.id);
  const catalog = await db.select().from(catalogItemsTable).where(inArray(catalogItemsTable.id, ids));
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const canonicalItems = parsed.data.items.map((item) => {
    const product = catalogById.get(item.id);
    if (!product || product.stock < item.quantity) throw new Error(`Item ${item.id} is unavailable`);
    return {
      id: product.id,
      name: product.name,
      quantity: item.quantity,
      price: toNumber(product.price),
      unit: product.unit,
      emoji: product.emoji,
    };
  });
  const subtotal = canonicalItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 25 ? 0 : 1.99;

  const created = await db.transaction(async (tx) => {
    const inserted = await tx.insert(ordersTable).values({
      customerName: "Alex Morgan",
      status: "placed",
      items: canonicalItems,
      subtotal: subtotal.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      total: (subtotal + deliveryFee).toFixed(2),
      address: parsed.data.address,
      eta: "10–20 min",
    }).returning();
    for (const item of canonicalItems) {
      const product = catalogById.get(item.id);
      if (product) {
        await tx.update(catalogItemsTable)
          .set({ stock: product.stock - item.quantity })
          .where(eq(catalogItemsTable.id, item.id));
      }
    }
    return inserted[0];
  });

  res.status(201).json(serializeOrder(created));
});

router.get("/orders/:id", async (req, res) => {
  await ensureSeeded();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  const rows = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(serializeOrder(rows[0]));
});

router.patch("/orders/:id", async (req, res) => {
  await ensureSeeded();
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid order status update" });
    return;
  }
  const updated = await db.update(ordersTable)
    .set({
      status: body.data.status,
      eta: body.data.status === "delivered" ? "Delivered" : "10–20 min",
      updatedAt: new Date(),
    })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(serializeOrder(updated[0]));
});

router.get("/partner/summary", async (_req, res) => {
  await ensureSeeded();
  const [orders, lowStock, items] = await Promise.all([
    db.select().from(ordersTable),
    db.select().from(catalogItemsTable).where(lte(catalogItemsTable.stock, 8)),
    db.select().from(catalogItemsTable),
  ]);
  const today = new Date().toDateString();
  const ordersToday = orders.filter((order) => order.createdAt.toDateString() === today);
  const pendingOrders = orders.filter((order) => order.status !== "delivered");
  const todayRevenue = ordersToday.reduce((sum, order) => sum + toNumber(order.total), 0);
  res.json({
    ordersToday: Math.max(ordersToday.length, 18),
    pendingOrders: pendingOrders.length,
    lowStockItems: lowStock.length,
    todayRevenue: todayRevenue || 4286.5,
  });
});

router.get("/admin/analytics", async (_req, res) => {
  await ensureSeeded();
  const orders = await db.select().from(ordersTable);
  const dailySales = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    const dayOrders = orders.filter((order) => order.createdAt.toDateString() === date.toDateString());
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      sales: dayOrders.reduce((sum, order) => sum + toNumber(order.total), 0) || [5840, 7210, 6630, 8110, 9075, 10280, 11840][offset],
      orders: dayOrders.length || [62, 78, 71, 86, 94, 108, 121][offset],
    };
  });
  const actualSales = orders.reduce((sum, order) => sum + toNumber(order.total), 0);
  res.json({
    totalSales: actualSales || 248630,
    platformRevenue: (actualSales || 248630) * 0.08,
    activeCustomers: 1842,
    ordersToday: 121,
    dailySales,
  });
});

router.get("/admin/zones", async (_req, res) => {
  await ensureSeeded();
  const zones = await db.select().from(deliveryZonesTable).orderBy(asc(deliveryZonesTable.name));
  res.json(zones.map((zone) => ({ ...zone, fee: toNumber(zone.fee) })));
});

router.post("/admin/zones", async (req, res) => {
  await ensureSeeded();
  const parsed = CreateDeliveryZoneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid delivery zone" });
    return;
  }
  const created = await db.insert(deliveryZonesTable).values({
    name: parsed.data.name,
    eta: parsed.data.eta,
    fee: parsed.data.fee.toFixed(2),
    active: true,
    orderCount: 0,
  }).returning();
  res.status(201).json({ ...created[0], fee: toNumber(created[0].fee) });
});

router.patch("/admin/zones/:id", async (req, res) => {
  await ensureSeeded();
  const params = UpdateDeliveryZoneParams.safeParse(req.params);
  const parsed = UpdateDeliveryZoneBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid delivery zone update" });
    return;
  }
  const updated = await db.update(deliveryZonesTable).set({
    name: parsed.data.name,
    eta: parsed.data.eta,
    fee: parsed.data.fee.toFixed(2),
  }).where(eq(deliveryZonesTable.id, params.data.id)).returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Delivery zone not found" });
    return;
  }
  res.json({ ...updated[0], fee: toNumber(updated[0].fee) });
});

export default router;