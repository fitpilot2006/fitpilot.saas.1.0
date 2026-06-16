import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const gymApplicationsTable = pgTable("gym_applications", {
  id: serial("id").primaryKey(),
  gymName: text("gym_name").notNull(),
  ownerName: text("owner_name").notNull(),
  phone: text("phone").notNull(),
  countryCode: text("country_code").notNull().default("+1"),
  email: text("email").notNull(),
  address: text("address"),
  planRequest: text("plan_request").default("starter"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  assignedAccessCode: text("assigned_access_code"),
  assignedExpiry: text("assigned_expiry"),
  assignedMemberLimit: integer("assigned_member_limit"),
  memberCount: integer("member_count"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GymApplication = typeof gymApplicationsTable.$inferSelect;
