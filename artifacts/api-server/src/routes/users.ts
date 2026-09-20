import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { and, asc, eq } from "drizzle-orm";
import { db, usersTable, addressesTable } from "@workspace/db";
import { UpdateUserBody, AddUserAddressBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/auth/me", requireAuth, (req, res): void => {
  const user = req.user!;
  res.json({
    id: user.id,
    mobile: user.mobile,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/auth/sign-out-all", requireAuth, async (req, res): Promise<void> => {
  const sessions = await clerkClient.sessions.getSessionList({ userId: req.clerkUserId! });
  await Promise.all(
    sessions.data
      .filter((session) => session.status === "active")
      .map((session) => clerkClient.sessions.revokeSession(session.id)),
  );
  res.json({ success: true });
});

function canAccessUser(req: Parameters<typeof requireAuth>[0], id: number): boolean {
  return req.user?.id === id || req.user?.role === "admin" || req.user?.role === "manager";
}

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!canAccessUser(req, id)) { res.status(403).json({ error: "دسترسی غیرمجاز" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: user.id, mobile: user.mobile, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt.toISOString() });
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!canAccessUser(req, id)) { res.status(403).json({ error: "دسترسی غیرمجاز" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: user.id, mobile: user.mobile, name: user.name, email: user.email, avatar: user.avatar, role: user.role, createdAt: user.createdAt.toISOString() });
});

router.get("/users/:id/addresses", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!canAccessUser(req, id)) { res.status(403).json({ error: "دسترسی غیرمجاز" }); return; }
  const addresses = await db.select().from(addressesTable).where(eq(addressesTable.userId, id));
  res.json(addresses);
});

const MAX_ADDRESSES = 10;

router.post("/users/:id/addresses", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!canAccessUser(req, id)) { res.status(403).json({ error: "دسترسی غیرمجاز" }); return; }
  const parsed = AddUserAddressBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "آدرس کامل و معتبر وارد کنید (کد پستی ۱۰ رقم)" }); return; }

  const existing = await db.select({ id: addressesTable.id }).from(addressesTable).where(eq(addressesTable.userId, id));
  if (existing.length >= MAX_ADDRESSES) { res.status(400).json({ error: `حداکثر ${MAX_ADDRESSES} آدرس می‌توانید ذخیره کنید` }); return; }

  // The first address is the default; marking a new one default clears the others.
  const isDefault = parsed.data.isDefault || existing.length === 0;
  const address = await db.transaction(async (tx) => {
    if (isDefault) await tx.update(addressesTable).set({ isDefault: false }).where(eq(addressesTable.userId, id));
    const [created] = await tx.insert(addressesTable).values({ ...parsed.data, isDefault, userId: id }).returning();
    return created;
  });
  res.status(201).json(address);
});

router.delete("/users/:id/addresses/:addressId", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const addressId = parseInt(String(req.params.addressId), 10);
  if (!canAccessUser(req, id)) { res.status(403).json({ error: "دسترسی غیرمجاز" }); return; }
  const [deleted] = await db.delete(addressesTable)
    .where(and(eq(addressesTable.id, addressId), eq(addressesTable.userId, id)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "آدرس یافت نشد" }); return; }
  // Keep exactly one default: promote the next address when the default is removed.
  if (deleted.isDefault) {
    const [next] = await db.select().from(addressesTable).where(eq(addressesTable.userId, id))
      .orderBy(asc(addressesTable.id)).limit(1);
    if (next) await db.update(addressesTable).set({ isDefault: true }).where(eq(addressesTable.id, next.id));
  }
  res.sendStatus(204);
});

export default router;
