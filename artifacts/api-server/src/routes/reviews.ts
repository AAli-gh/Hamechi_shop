import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, reviewsTable } from "@workspace/db";
import { CreateReviewBody, ListReviewsQueryParams } from "@workspace/api-zod";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/reviews", async (req, res): Promise<void> => {
  const params = ListReviewsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.productId, params.data.productId));
  res.json(reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

// Reviews are tied to a signed-in account so ratings cannot be stuffed anonymously.
router.post("/reviews", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.extend({ rating: z.number().int().min(1).max(5) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "امتیاز باید بین ۱ تا ۵ و نام حداقل ۲ حرف باشد" }); return; }
  const { productId, authorName, rating, comment } = parsed.data;
  const [review] = await db.insert(reviewsTable)
    .values({ productId, authorName, rating, comment, userId: req.user!.id, isVerified: false })
    .returning();
  res.status(201).json({ ...review, createdAt: review.createdAt.toISOString() });
});

export default router;
