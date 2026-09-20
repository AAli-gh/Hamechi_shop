/**
 * Fills the database with Persian sample data for development and tests.
 * Existing catalogue rows are removed first, so never run this against real data.
 *
 *   DATABASE_URL=... pnpm --filter @workspace/db run seed
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Placeholder artwork lives with the uploads the API serves.
const uploads = path.join(ROOT, "artifacts/api-server/uploads");
fs.mkdirSync(uploads, { recursive: true });

// Bumping this changes every placeholder URL, so browsers do not keep the old art
// (uploads are served with long-lived caching).
const ART_VERSION = "v2";

function svg(name, emoji, bg1, bg2, w = 800, h = 800) {
  const file = name.replace(/\.svg$/, `.${ART_VERSION}.svg`);
  const size = Math.min(w, h) * 0.42;
  // Placeholder art for the dark storefront: deep teal-navy with a soft glow.
  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
  <radialGradient id="glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#2ee6cf" stop-opacity=".22"/><stop offset="1" stop-color="#2ee6cf" stop-opacity="0"/></radialGradient>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect width="100%" height="100%" fill="url(#glow)"/>
<circle cx="${w * 0.82}" cy="${h * 0.18}" r="${Math.min(w, h) * 0.12}" fill="#2ee6cf" opacity=".10"/>
<circle cx="${w * 0.15}" cy="${h * 0.85}" r="${Math.min(w, h) * 0.18}" fill="#2ee6cf" opacity=".07"/>
<text x="50%" y="54%" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
</svg>`;
  fs.writeFileSync(path.join(uploads, file), body);
  return `/api/uploads/${file}`;
}

const q = (sql, params) => client.query(sql, params);

await q(`TRUNCATE categories, products, product_variants, cart_items, carts, order_items, orders, banners, discounts, shipping_methods, blog_categories, blog_posts, reviews RESTART IDENTITY CASCADE`);

const categories = [
  ["Digital", "کالای دیجیتال", "digital", "📱", "#0e3a4a"],
  ["Fashion", "مد و پوشاک", "fashion", "👕", "#3a2a12"],
  ["Home & Kitchen", "خانه و آشپزخانه", "home-kitchen", "🏠", "#123a2a"],
  ["Beauty & Health", "زیبایی و سلامت", "beauty-health", "💄", "#3a1830"],
  ["Sports & Travel", "ورزش و سفر", "sports-travel", "⚽", "#231a3d"],
  ["Kids & Baby", "کودک و نوزاد", "kids-baby", "🧸", "#3a3312"],
];
const catIds = {};
for (const [name, nameFa, slug, icon, color] of categories) {
  const image = svg(`cat-${slug}.svg`, icon, color, "#071b22");
  const r = await q(`INSERT INTO categories (name, name_fa, slug, icon, image, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [name, nameFa, slug, icon, image, color]);
  catIds[slug] = r.rows[0].id;
}

const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000);
// [slug, nameFa, cat, emoji, price, salePrice, stock, ageGroup, gender, brand, featured, flash, best, desc]
const products = [
  ["wireless-earbuds", "هدفون بی‌سیم نویزکنسلینگ", "digital", "🎧", 4900000, 4190000, 35, null, null, "سونیک", true, true, true, "هدفون بی‌سیم با حذف نویز فعال، ۳۰ ساعت شارژدهی و قاب شارژ وایرلس."],
  ["smartphone-a55", "گوشی هوشمند ۱۲۸ گیگابایت", "digital", "📱", 18900000, null, 12, null, null, "گلکسی", true, false, true, "نمایشگر ۶.۶ اینچی AMOLED، دوربین ۵۰ مگاپیکسل و باتری ۵۰۰۰ میلی‌آمپر."],
  ["smart-watch", "ساعت هوشمند ورزشی", "digital", "⌚", 3600000, 2990000, 20, null, null, "امیزفیت", false, true, false, "ضربان‌سنج، ردیاب خواب، GPS داخلی و ضدآب تا عمق ۵۰ متر."],
  ["power-bank", "پاوربانک ۲۰۰۰۰ میلی‌آمپر", "digital", "🔋", 1250000, null, 60, null, null, "انکر", false, false, true, "شارژ سریع ۲۲.۵ وات با دو خروجی USB و یک خروجی Type-C."],
  ["laptop-14", "لپ‌تاپ ۱۴ اینچی", "digital", "💻", 42500000, 39900000, 6, null, null, "ایسوس", true, false, false, "پردازنده نسل جدید، ۱۶ گیگ رم و ۵۱۲ گیگ SSD، وزن ۱.۳ کیلوگرم."],
  ["men-shirt", "پیراهن مردانه نخی", "fashion", "👔", 1150000, 890000, 40, null, "male", "هاکوپیان", false, true, false, "پیراهن ۱۰۰٪ نخی با دوخت اسلیم‌فیت، مناسب محیط کار."],
  ["women-manto", "مانتو کتان زنانه", "fashion", "🧥", 2350000, null, 18, null, "female", "آمیتیس", true, false, true, "مانتو کتان سبک با آستین سه‌ربع، مناسب فصل بهار."],
  ["running-shoes", "کفش پیاده‌روی", "fashion", "👟", 3200000, 2690000, 25, null, "unisex", "پرشین‌استپ", true, true, true, "زیره‌ی طبی و رویه‌ی مش تنفس‌پذیر برای استفاده‌ی روزانه."],
  ["leather-bag", "کیف چرمی دوشی", "fashion", "👜", 2800000, null, 10, null, "female", "چرم مشهد", false, false, false, "کیف چرم طبیعی دست‌دوز با بند قابل تنظیم."],
  ["coffee-maker", "قهوه‌ساز اسپرسو", "home-kitchen", "☕", 9800000, 8750000, 8, null, null, "دلونگی", true, true, false, "فشار ۱۵ بار، مخزن شیر و کف‌ساز برای کاپوچینو و لاته."],
  ["cookware-set", "سرویس قابلمه ۱۰ پارچه", "home-kitchen", "🍳", 6400000, null, 14, null, null, "عالی‌نسب", false, false, true, "سرویس گرانیتی نچسب، سازگار با انواع اجاق."],
  ["bedding-set", "روتختی دونفره", "home-kitchen", "🛏️", 2600000, 2190000, 16, null, null, "لیان", false, true, false, "روتختی نخی شش‌تکه با طرح مینیمال."],
  ["desk-lamp", "چراغ مطالعه LED", "home-kitchen", "💡", 890000, null, 45, null, null, "پارس‌شعاع", false, false, false, "سه حالت نور، قابل تنظیم و مصرف کم."],
  ["sunscreen", "کرم ضدآفتاب SPF50", "beauty-health", "🧴", 480000, null, 90, null, "unisex", "سینره", true, false, true, "ضدآفتاب فاقد چربی، مناسب پوست‌های مختلط و چرب."],
  ["hair-dryer", "سشوار حرفه‌ای", "beauty-health", "💨", 2100000, 1790000, 22, null, null, "فیلیپس", false, true, false, "۲۲۰۰ وات با یون منفی و سه سطح دما."],
  ["perfume-100", "ادوپرفیوم ۱۰۰ میلی‌لیتر", "beauty-health", "🌸", 3900000, null, 0, null, "female", "اسکلاره", false, false, false, "رایحه‌ی گلی-چوبی با ماندگاری بالا."],
  ["yoga-mat", "مت یوگا ۸ میلی‌متری", "sports-travel", "🧘", 750000, null, 50, null, null, "اسپرت‌لند", false, false, true, "مت ضدلغزش با بند حمل، مناسب یوگا و پیلاتس."],
  ["dumbbell-set", "ست دمبل قابل تنظیم", "sports-travel", "🏋️", 4200000, 3790000, 9, null, null, "اسپرت‌لند", true, true, false, "دو دمبل قابل تنظیم از ۲ تا ۲۰ کیلوگرم."],
  ["travel-suitcase", "چمدان سایز متوسط", "sports-travel", "🧳", 5600000, null, 11, null, null, "سامسونت", false, false, false, "بدنه‌ی پلی‌کربنات، چهار چرخ ۳۶۰ درجه و قفل TSA."],
  ["camping-tent", "چادر مسافرتی ۴ نفره", "sports-travel", "⛺", 3400000, null, 7, null, null, "کوهنورد", false, false, false, "چادر ضدآب دولایه با برپایی سریع."],
  ["teddy-bear", "خرس عروسکی بزرگ", "kids-baby", "🧸", 1450000, 1190000, 22, "1-3y", "unisex", "توی‌تاون", false, true, true, "خرس پولیشی ۶۰ سانتی با الیاف ضدحساسیت."],
  ["baby-stroller", "کالسکه سبک مسافرتی", "kids-baby", "🚼", 8900000, null, 5, "6-12m", "unisex", "چیکو", false, false, false, "کالسکه‌ی ۶ کیلویی با تاشوی یک‌دست."],
  ["lego-set", "لگو ساختنی ۵۰۰ قطعه", "kids-baby", "🧱", 2300000, null, 15, "3-5y", "unisex", "لگو", true, false, false, "مجموعه‌ی ساختنی خلاقانه برای تقویت مهارت‌های کودک."],
];
// Card backgrounds, all dark enough for white text and the teal accent.
const palette = ["#0b2029", "#0a2430", "#0d2227", "#08202b", "#101f2b", "#09242a"];
let i = 0;
const productIds = [];
for (const [slug, nameFa, cat, emoji, price, sale, stock, age, gender, brand, featured, flash, best, desc] of products) {
  const img1 = svg(`p-${slug}-1.svg`, emoji, palette[i % 6], "#ffffff");
  const img2 = svg(`p-${slug}-2.svg`, emoji, "#061419", palette[(i + 2) % 6]);
  const r = await q(
    `INSERT INTO products (name, name_fa, slug, description, description_fa, price, sale_price, images, category_id, stock, sku, brand, age_group, gender, is_featured, is_flash_sale, is_best_seller, flash_sale_ends_at, tags, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19, now() - ($20 || ' hours')::interval) RETURNING id`,
    [slug.replace(/-/g, " "), nameFa, slug, desc, desc, price, sale, JSON.stringify([img1, img2]), catIds[cat], stock,
     `BZ-${1000 + i}`, brand, age, gender, featured, flash, best, flash ? soon : null, JSON.stringify([brand]), String(i * 7)],
  );
  productIds.push(r.rows[0].id);
  i++;
}

// Sub-categories: [parent slug, name, nameFa, slug, icon, and the product slugs that move into it]
const subCategories = [
  ["digital", "Mobile", "موبایل", "mobile", "📱", ["smartphone-a55", "power-bank"]],
  ["digital", "Laptop", "لپ‌تاپ", "laptop", "💻", ["laptop-14"]],
  ["digital", "Audio", "صوتی و تصویری", "audio", "🎧", ["wireless-earbuds", "smart-watch"]],
  ["fashion", "Men", "مردانه", "men-fashion", "👔", ["men-shirt"]],
  ["fashion", "Women", "زنانه", "women-fashion", "👗", ["women-manto", "leather-bag"]],
  ["fashion", "Shoes", "کفش", "shoes", "👟", ["running-shoes"]],
  ["home-kitchen", "Kitchen", "آشپزخانه", "kitchen", "🍳", ["coffee-maker", "cookware-set"]],
  ["home-kitchen", "Home", "دکوراسیون و خواب", "home-decor", "🛏️", ["bedding-set", "desk-lamp"]],
];
for (const [parentSlug, name, nameFa, slug, icon, productSlugs] of subCategories) {
  const r = await q(`INSERT INTO categories (name, name_fa, slug, icon, parent_id, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [name, nameFa, slug, icon, catIds[parentSlug], "#14313a"]);
  for (const productSlug of productSlugs) {
    await q(`UPDATE products SET category_id=$1 WHERE slug=$2`, [r.rows[0].id, productSlug]);
  }
}

const specSets = {
  "smartphone-a55": [["نمایشگر", "۶.۶ اینچ AMOLED"], ["دوربین اصلی", "۵۰ مگاپیکسل"], ["باتری", "۵۰۰۰ میلی‌آمپرساعت"], ["رم", "۸ گیگابایت"], ["سیستم‌عامل", "اندروید ۱۴"], ["گارانتی", "۱۸ ماه شرکتی"]],
  "laptop-14": [["پردازنده", "Core i7 نسل ۱۳"], ["رم", "۱۶ گیگابایت DDR5"], ["حافظه", "۵۱۲ گیگابایت SSD"], ["نمایشگر", "۱۴ اینچ IPS"], ["وزن", "۱.۳ کیلوگرم"], ["گارانتی", "۱۲ ماه"]],
  "wireless-earbuds": [["نوع اتصال", "بلوتوث ۵.۳"], ["حذف نویز", "فعال (ANC)"], ["شارژدهی", "۳۰ ساعت با کیس"], ["ضدآب", "IPX4"], ["وزن هر ایربادز", "۵ گرم"]],
  "smart-watch": [["نمایشگر", "۱.۴ اینچ AMOLED"], ["ضدآب", "۵ ATM"], ["باتری", "تا ۱۴ روز"], ["حسگرها", "ضربان قلب، SpO2، GPS"]],
  "coffee-maker": [["فشار پمپ", "۱۵ بار"], ["توان", "۱۴۵۰ وات"], ["مخزن آب", "۱.۸ لیتر"], ["کف‌ساز شیر", "دارد"]],
  "running-shoes": [["جنس رویه", "مش تنفس‌پذیر"], ["زیره", "فوم طبی"], ["کاربرد", "پیاده‌روی و دویدن سبک"]],
};
for (const [slug, rows] of Object.entries(specSets)) {
  await q(`UPDATE products SET specs=$2 WHERE slug=$1`, [slug, JSON.stringify(rows.map(([name, value]) => ({ name, value })))]);
}

// Variants: [slug, optionNames, rows of [values, ownPrice|null, stock]]
const variantSets = [
  ["men-shirt", ["سایز"], [[["M"], null, 12], [["L"], null, 15], [["XL"], null, 8], [["XXL"], null, 0]]],
  ["women-manto", ["سایز"], [[["۳۶"], null, 5], [["۳۸"], null, 7], [["۴۰"], null, 4], [["۴۲"], null, 2]]],
  ["running-shoes", ["رنگ", "سایز"], [
    [["مشکی", "۴۰"], null, 4], [["مشکی", "۴۱"], null, 6], [["مشکی", "۴۲"], null, 5], [["مشکی", "۴۳"], null, 0],
    [["سفید", "۴۰"], null, 3], [["سفید", "۴۱"], null, 0], [["سفید", "۴۲"], null, 4], [["سفید", "۴۳"], null, 3],
  ]],
  ["smartphone-a55", ["حافظه", "رنگ"], [
    [["۱۲۸ گیگابایت", "مشکی"], null, 5], [["۱۲۸ گیگابایت", "آبی"], null, 3],
    [["۲۵۶ گیگابایت", "مشکی"], 21900000, 4], [["۲۵۶ گیگابایت", "آبی"], 21900000, 0],
  ]],
];
for (const [slug, names, rows] of variantSets) {
  const { rows: [prod] } = await q(`SELECT id FROM products WHERE slug=$1`, [slug]);
  for (const [order, [values, price, stock]] of rows.entries()) {
    const options = names.map((name, i) => ({ name, value: values[i] }));
    await q(`INSERT INTO product_variants (product_id, options, price, stock, sort_order, sku) VALUES ($1,$2,$3,$4,$5,$6)`,
      [prod.id, JSON.stringify(options), price, stock, order, `${slug}-${order + 1}`]);
  }
  await q(`UPDATE products SET stock = (SELECT sum(stock) FROM product_variants WHERE product_id=$1) WHERE id=$1`, [prod.id]);
}

const reviewers = [["مریم", 5, "کیفیت عالی، دقیقاً مثل عکس بود."], ["سارا", 4, "خوب بود ولی ارسال کمی طول کشید."], ["رضا", 5, "ارزش خرید داشت، ممنون از بازارچه 👌"]];
for (const [n, id] of productIds.entries()) {
  if (n % 2) continue;
  for (const [author, rating, comment] of reviewers.slice(0, 1 + (n % 3))) {
    await q(`INSERT INTO reviews (product_id, author_name, rating, comment, is_verified) VALUES ($1,$2,$3,$4,true)`, [id, author, rating, comment]);
  }
}

const banners = [
  ["جشنواره فروش بازارچه", "تا ۴۰٪ تخفیف روی کالای دیجیتال و پوشاک", "🛍️", "#3a2a12", "#0a1b22", "/shop?flashSale=true", "خرید کنید", "hero", 0],
  ["دنیای دیجیتال", "جدیدترین گوشی، هدفون و لپ‌تاپ", "📱", "#0e3a4a", "#0a1b22", "/shop?category=digital", "مشاهده", "hero", 1],
  ["ارسال رایگان", "برای خریدهای بالای ۲ میلیون تومان", "🚚", "#123a2a", "#0a1b22", "/shipping-policy", "اطلاعات بیشتر", "promo", 2],
];
for (const [t, s, emoji, c1, c2, link, btn, pos, order] of banners) {
  const image = svg(`banner-${order}.svg`, emoji, c1, c2, 1600, 600);
  await q(`INSERT INTO banners (title, title_fa, subtitle, subtitle_fa, image, link, position, button_text, button_text_fa, sort_order) VALUES ($1,$1,$2,$2,$3,$4,$5,$6,$6,$7)`, [t, s, image, link, pos, btn, order]);
}

await q(`INSERT INTO shipping_methods (name, name_fa, price, estimated_days, is_free, min_order_for_free) VALUES
  ('standard','پست پیشتاز',30000,4,false,2000000),
  ('express','پیک فوری (تهران)',80000,1,false,null)`);

await q(`INSERT INTO discounts (code, type, value, min_order, max_uses, expires_at) VALUES
  ('WELCOME10','percent',10,500000,100, now() + interval '30 days'),
  ('KOODAK50','fixed',50000,1000000,50, now() + interval '30 days')`);

const bc = await q(`INSERT INTO blog_categories (name, name_fa, slug) VALUES ('Buying Guide','راهنمای خرید','buying-guide'), ('Reviews','بررسی کالا','reviews') RETURNING id`);
const posts = [
  ["choose-earbuds", "راهنمای خرید هدفون بی‌سیم", "قبل از خرید هدفون بی‌سیم به چه نکاتی توجه کنیم؟", "🎧", bc.rows[0].id],
  ["home-coffee", "چطور قهوه‌ساز مناسب خانه را انتخاب کنیم؟", "مقایسه‌ی اسپرسوساز، فرنچ‌پرس و قهوه‌ساز دمی.", "☕", bc.rows[0].id],
  ["running-shoes-review", "بررسی بهترین کفش‌های پیاده‌روی", "کفش راحت برای پیاده‌روی روزانه چه ویژگی‌هایی دارد؟", "👟", bc.rows[1].id],
];
for (const [slug, title, excerpt, emoji, cat] of posts) {
  const cover = svg(`blog-${slug}.svg`, emoji, "#0b2029", "#08202b", 1200, 675);
  const content = `<p>${excerpt}</p><h2>نکته‌ی اول</h2><p>این یک متن نمونه برای محیط توسعه است و بعداً با محتوای واقعی جایگزین می‌شود.</p><h2>نکته‌ی دوم</h2><p>با بازارچه، خریدی مطمئن و آسان را تجربه کنید.</p>`;
  await q(`INSERT INTO blog_posts (slug, title, title_fa, excerpt, excerpt_fa, content, content_fa, cover_image, category_id, author_name, is_published, reading_time) VALUES ($1,$2,$2,$3,$3,$4,$4,$5,$6,'تیم بازارچه',true,4)`, [slug, title, excerpt, content, cover, cat]);
}

console.log(`Seeded: ${categories.length}+${subCategories.length} categories, ${products.length} products (${variantSets.length} with variants, ${Object.keys(specSets).length} with specs), ${banners.length} banners, ${posts.length} posts`);
await client.end();
