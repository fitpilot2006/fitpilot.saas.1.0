import { pgTable, text, serial, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brandingTable = pgTable("branding", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull().unique(),
  gymName: text("gym_name").notNull().default("GymFlow"),
  tagline: text("tagline"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  primaryColor: text("primary_color").notNull().default("#f97316"),
  secondaryColor: text("secondary_color").notNull().default("#1e293b"),
  accentColor: text("accent_color"),
  themeName: text("theme_name").default("midnight-orange"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBrandingSchema = createInsertSchema(brandingTable).omit({ id: true, updatedAt: true });
export type InsertBranding = z.infer<typeof insertBrandingSchema>;
export type Branding = typeof brandingTable.$inferSelect;
