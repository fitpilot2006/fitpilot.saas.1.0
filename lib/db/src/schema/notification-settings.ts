import { pgTable, text, serial, timestamp, bigint, boolean, integer } from "drizzle-orm/pg-core";

export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull().unique(),
  twilioAccountSid: text("twilio_account_sid"),
  twilioAuthToken: text("twilio_auth_token"),
  whatsappNumber: text("whatsapp_number"),
  paymentReminderEnabled: boolean("payment_reminder_enabled").default(false),
  expiryReminderEnabled: boolean("expiry_reminder_enabled").default(false),
  welcomeMessageEnabled: boolean("welcome_message_enabled").default(false),
  overdueAlertEnabled: boolean("overdue_alert_enabled").default(false),
  paymentReminderDays: integer("payment_reminder_days").default(3),
  expiryReminderDays: integer("expiry_reminder_days").default(7),
  paymentTemplate: text("payment_template"),
  expiryTemplate: text("expiry_template"),
  welcomeTemplate: text("welcome_template"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationSettings = typeof notificationSettingsTable.$inferSelect;
