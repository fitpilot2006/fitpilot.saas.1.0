import { Router } from "express";
import { db, notificationSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

const DEFAULT_TEMPLATES = {
  paymentTemplate: "Hi {name}, your payment of {amount} is due on {dueDate}. Please visit the gym to renew your membership.",
  expiryTemplate: "Hi {name}, your membership expires on {expiryDate} ({daysLeft} days left). Contact us to renew!",
  welcomeTemplate: "Welcome to our gym, {name}! Your membership is active until {expiryDate}. Great to have you!",
};

router.get("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [settings] = await db.select().from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.gymId, gymId))
      .limit(1);
    if (!settings) {
      const [created] = await db.insert(notificationSettingsTable)
        .values({ gymId, ...DEFAULT_TEMPLATES }).returning();
      res.json(created);
      return;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req, res) => {
  try {
    const gymId = req.gymId!;
    const [existing] = await db.select().from(notificationSettingsTable)
      .where(eq(notificationSettingsTable.gymId, gymId))
      .limit(1);

    const ALLOWED = [
      "twilioAccountSid", "twilioAuthToken", "whatsappNumber",
      "paymentReminderEnabled", "expiryReminderEnabled",
      "welcomeMessageEnabled", "overdueAlertEnabled",
      "paymentReminderDays", "expiryReminderDays",
      "paymentTemplate", "expiryTemplate", "welcomeTemplate",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    let settings;
    if (!existing) {
      const [created] = await db.insert(notificationSettingsTable)
        .values({ gymId, ...DEFAULT_TEMPLATES, ...updates }).returning();
      settings = created;
    } else {
      const [updated] = await db.update(notificationSettingsTable)
        .set(updates as any)
        .where(eq(notificationSettingsTable.gymId, gymId))
        .returning();
      settings = updated;
    }
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
