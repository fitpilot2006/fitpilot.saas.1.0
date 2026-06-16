import { pgTable, text, serial, timestamp, bigint } from "drizzle-orm/pg-core";

export const brandingTable = pgTable("branding", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull().unique(),
  gymName: text("gym_name").notNull().default("GymFlow"),
  tagline: text("tagline"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  thumbnailUrl: text("thumbnail_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").notNull().default("#f97316"),
  secondaryColor: text("secondary_color").notNull().default("#1e293b"),
  accentColor: text("accent_color"),
  sidebarColor: text("sidebar_color").default("#0f172a"),
  cardColor: text("card_color").default("#1e293b"),
  buttonColor: text("button_color").default("#f97316"),
  themeName: text("theme_name").default("midnight-orange"),
  headingFont: text("heading_font").default("Inter"),
  bodyFont: text("body_font").default("Inter"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  customCss: text("custom_css"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Branding = typeof brandingTable.$inferSelect;
