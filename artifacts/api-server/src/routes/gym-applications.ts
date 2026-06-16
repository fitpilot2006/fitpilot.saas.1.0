import { Router } from "express";
import { db } from "@workspace/db";
import { gymApplicationsTable } from "@workspace/db";
import nodemailer from "nodemailer";

const router = Router();

async function sendAdminNotification(app: {
  gymName: string; ownerName: string; email: string; phone: string;
  planRequest: string; memberCount?: number | null;
}) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.log("[gym-applications] EMAIL_USER/EMAIL_PASS not set — skipping email notification");
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"FitPilot Platform" <${user}>`,
      to: "fitpilot.saas@gmail.com",
      subject: `🏋️ New Gym Application: ${app.gymName}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:16px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
            <div style="width:40px;height:40px;background:#7c3aed;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">🏋️</div>
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:800;color:#fff">New Gym Application</h2>
              <p style="margin:2px 0 0;font-size:13px;color:#888">FitPilot Platform Admin</p>
            </div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888;width:130px">Gym Name</td>
              <td style="padding:10px 0;color:#fff;font-weight:600">${app.gymName}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Owner Name</td>
              <td style="padding:10px 0;color:#fff">${app.ownerName}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Email</td>
              <td style="padding:10px 0;color:#7c3aed">${app.email}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Phone</td>
              <td style="padding:10px 0;color:#fff">${app.phone}</td>
            </tr>
            <tr style="border-bottom:1px solid #222">
              <td style="padding:10px 0;color:#888">Plan Interested In</td>
              <td style="padding:10px 0;color:#fff;text-transform:capitalize">${app.planRequest}</td>
            </tr>
            ${app.memberCount ? `<tr><td style="padding:10px 0;color:#888">Members</td><td style="padding:10px 0;color:#fff">${app.memberCount}</td></tr>` : ""}
          </table>
          <div style="margin-top:24px;padding:16px;background:#111;border-radius:10px;border:1px solid #222">
            <p style="margin:0;font-size:13px;color:#888">Login to <strong style="color:#7c3aed">/platform-admin</strong> to review and respond to this application.</p>
          </div>
        </div>
      `,
    });
    console.log("[gym-applications] Admin notification email sent to fitpilot.saas@gmail.com");
  } catch (err) {
    console.error("[gym-applications] Email notification failed:", (err as Error).message);
  }
}

router.post("/", async (req, res) => {
  try {
    const { gymName, ownerName, phone, countryCode, email, address, planRequest, notes, memberCount } = req.body;
    if (!gymName || !ownerName || !phone || !email) {
      res.status(400).json({ error: "gymName, ownerName, phone, email required" });
      return;
    }
    const [app] = await db.insert(gymApplicationsTable).values({
      gymName: gymName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      countryCode: (countryCode ?? "+1").trim(),
      email: email.trim().toLowerCase(),
      address: address ? address.trim() : null,
      planRequest: planRequest ?? "basic",
      notes: notes ? notes.trim() : null,
      memberCount: memberCount ? Number(memberCount) : null,
    }).returning();

    sendAdminNotification({
      gymName: app.gymName,
      ownerName: app.ownerName,
      email: app.email,
      phone: app.phone,
      planRequest: app.planRequest ?? "basic",
      memberCount: app.memberCount,
    }).catch(console.error);

    console.log(`[gym-applications] New application: ${app.gymName} (${app.email})`);
    res.status(201).json({ id: app.id, message: "Application submitted. The platform admin will review it shortly." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gym-applications post]", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
