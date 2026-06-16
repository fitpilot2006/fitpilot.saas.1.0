import { pgTable, text, serial, timestamp, integer, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull(),
  memberId: integer("member_id").notNull(),
  memberName: text("member_name").notNull(),
  checkInAt: timestamp("check_in_at", { withTimezone: true }).notNull().defaultNow(),
  checkOutAt: timestamp("check_out_at", { withTimezone: true }),
  notes: text("notes"),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, checkInAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
