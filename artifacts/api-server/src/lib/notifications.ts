import { and, eq } from "drizzle-orm";
import { db, productsTable, stockNotificationsTable } from "@workspace/db";
import { logger } from "./logger";
import { SITE_URL, emailLayout, escapeHtml, isMailerConfigured, sendMail } from "./mailer";

/**
 * Emails everyone waiting for this product and marks only the addresses that
 * were actually sent. Without a mail server the rows stay pending, so nobody is
 * silently dropped and the admin page keeps showing them.
 */
export async function notifyBackInStock(productId: number): Promise<{ sent: number; pending: number }> {
  const pending = await db
    .select()
    .from(stockNotificationsTable)
    .where(and(eq(stockNotificationsTable.productId, productId), eq(stockNotificationsTable.isNotified, false)));
  if (pending.length === 0) return { sent: 0, pending: 0 };

  if (!isMailerConfigured()) {
    logger.warn({ productId, pending: pending.length }, "back-in-stock emails pending: no mail server configured");
    return { sent: 0, pending: pending.length };
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) return { sent: 0, pending: pending.length };

  const name = product.nameFa || product.name;
  const link = SITE_URL ? `${SITE_URL}/product/${product.slug}` : null;
  const subject = `«${name}» دوباره موجود شد`;
  const html = emailLayout(subject, `
    <p style="margin:0 0 12px">کالایی که منتظرش بودید دوباره موجود شد:</p>
    <p style="margin:0 0 16px;font-weight:bold">${escapeHtml(name)}</p>
    ${link ? `<p style="margin:0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#e25b12;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px">مشاهده و خرید</a></p>` : ""}
  `);
  const text = `«${name}» دوباره موجود شد.${link ? `\n${link}` : ""}`;

  let sent = 0;
  for (const row of pending) {
    if (await sendMail({ to: row.email, subject, html, text })) {
      await db
        .update(stockNotificationsTable)
        .set({ isNotified: true, notifiedAt: new Date() })
        .where(eq(stockNotificationsTable.id, row.id));
      sent++;
    }
  }
  logger.info({ productId, sent, pending: pending.length - sent }, "back-in-stock emails processed");
  return { sent, pending: pending.length - sent };
}

/**
 * Call after any stock change. Sending runs in the background so restocking
 * never waits on the mail server.
 */
export function onStockChanged(productId: number, previousStock: number, newStock: number): void {
  if (previousStock > 0 || newStock <= 0) return;
  void notifyBackInStock(productId).catch((err) => logger.error({ err, productId }, "back-in-stock notification failed"));
}
