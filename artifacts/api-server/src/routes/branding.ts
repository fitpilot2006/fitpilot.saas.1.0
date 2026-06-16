import { Router } from "express";
import { db, brandingTable, gymsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

function serializeBranding(b: typeof brandingTable.$inferSelect) {
  return {
    id: b.id, gymName: b.gymName, tagline: b.tagline,
    logoUrl: b.logoUrl, bannerUrl: b.bannerUrl, thumbnailUrl: b.thumbnailUrl,
    faviconUrl: b.faviconUrl, primaryColor: b.primaryColor, secondaryColor: b.secondaryColor,
    accentColor: b.accentColor, sidebarColor: b.sidebarColor, cardColor: b.cardColor,
    buttonColor: b.buttonColor, themeName: b.themeName, headingFont: b.headingFont,
    bodyFont: b.bodyFont, address: b.address, phone: b.phone, email: b.email,
    website: b.website, customCss: b.customCss,
  };
}

router.get("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [branding] = await db.select().from(brandingTable).where(eq(brandingTable.gymId, gymId)).limit(1);

    if (!branding) {
      const [gymRow] = await db.select().from(gymsTable).where(eq(gymsTable.id, gymId)).limit(1);
      const [created] = await db.insert(brandingTable).values({
        gymId, gymName: gymRow?.name ?? "My Gym",
        primaryColor: "#f97316", secondaryColor: "#0f172a",
      }).returning();
      res.json(serializeBranding(created));
      return;
    }

    res.json(serializeBranding(branding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [existing] = await db.select().from(brandingTable).where(eq(brandingTable.gymId, gymId)).limit(1);

    const ALLOWED_FIELDS = [
      "gymName", "tagline", "logoUrl", "bannerUrl", "thumbnailUrl", "faviconUrl",
      "primaryColor", "secondaryColor", "accentColor", "sidebarColor", "cardColor",
      "buttonColor", "themeName", "headingFont", "bodyFont",
      "address", "phone", "email", "website", "customCss",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    let branding;
    if (!existing) {
      const [created] = await db.insert(brandingTable).values({ gymId, gymName: "My Gym", primaryColor: "#f97316", secondaryColor: "#0f172a", ...updates }).returning();
      branding = created;
    } else {
      const [updated] = await db.update(brandingTable).set(updates as any).where(eq(brandingTable.gymId, gymId)).returning();
      branding = updated;
    }

    res.json(serializeBranding(branding));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
