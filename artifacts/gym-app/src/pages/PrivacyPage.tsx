import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "May 21, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-10">
          <img src="/fitpilot-logo.png" alt="FitPilot" className="h-9 w-auto" />
          <span className="font-black text-xl text-white">FitPilot</span>
        </div>

        <Link href="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </Link>

        <div className="bg-slate-800 border border-white/8 rounded-2xl p-8 space-y-8">
          <div className="border-b border-white/8 pb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
            <p className="text-sm text-slate-400">Last updated: {LAST_UPDATED}</p>
            <p className="text-sm text-slate-400 mt-2">
              FitPilot is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our platform.
            </p>
          </div>

          <Section title="1. Information We Collect">
            <p><strong className="text-slate-300">Account Information:</strong> When you register, we collect your name, email address, password (stored as a secure hash), and gym-related information.</p>
            <p><strong className="text-slate-300">Gym Member Data:</strong> Gym owners may add member profiles including names, emails, phone numbers, membership details, emergency contacts, and attendance records.</p>
            <p><strong className="text-slate-300">Usage Data:</strong> We automatically collect information about how you interact with our service, including IP addresses, browser type, pages visited, and timestamps.</p>
            <p><strong className="text-slate-300">Payment Data:</strong> Payment records stored within the platform are managed by gym owners. We do not process or store credit card numbers directly.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul>
              <li>To provide, maintain, and improve our gym management services.</li>
              <li>To authenticate users and maintain account security.</li>
              <li>To send service-related notifications (account alerts, expiry reminders).</li>
              <li>To generate analytics and reports within your gym account.</li>
              <li>To investigate and prevent fraud, abuse, or violations of our Terms of Service.</li>
              <li>To comply with legal obligations and enforce our policies.</li>
              <li>To communicate updates, security alerts, and administrative messages.</li>
            </ul>
          </Section>

          <Section title="3. Data Sharing and Disclosure">
            <p>We do not sell, rent, or trade your personal information to third parties. We may share your information only in the following circumstances:</p>
            <ul>
              <li><strong className="text-slate-300">Service Providers:</strong> Trusted third-party services that assist us in operating our platform (hosting, database, analytics) under strict confidentiality agreements.</li>
              <li><strong className="text-slate-300">Legal Requirements:</strong> When required by law, court order, or government authority.</li>
              <li><strong className="text-slate-300">Safety:</strong> When we believe disclosure is necessary to protect the rights, property, or safety of FitPilot, our users, or others.</li>
              <li><strong className="text-slate-300">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with notice provided to affected users.</li>
            </ul>
          </Section>

          <Section title="4. Multi-Tenant Data Isolation">
            <p>FitPilot is a multi-tenant platform. Each gym's data is strictly isolated — gym owners and staff can only access data belonging to their own gym. Gym members can only view their own profile and membership details. Platform administrators have oversight access for operational purposes.</p>
          </Section>

          <Section title="5. Data Security">
            <p>We implement industry-standard security measures to protect your personal information:</p>
            <ul>
              <li>Passwords are hashed using bcrypt with a high cost factor — we never store plaintext passwords.</li>
              <li>All communications are encrypted using HTTPS/TLS.</li>
              <li>Authentication uses secure JWT tokens with expiration.</li>
              <li>API endpoints include rate limiting and input validation to prevent abuse.</li>
              <li>Access controls ensure users can only access data they are authorized to view.</li>
            </ul>
            <p className="mt-2">However, no method of transmission over the Internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>
          </Section>

          <Section title="6. Data Retention">
            <p>We retain your personal data for as long as your account remains active or as needed to provide the Service. Gym owners may delete member data at any time through the platform. Upon account deletion, we will delete or anonymize your data within 30 days, except where retention is required by law.</p>
          </Section>

          <Section title="7. Cookies and Tracking">
            <p>FitPilot uses minimal client-side storage (localStorage) for authentication tokens only. We do not use advertising cookies or track users across third-party websites. We may use basic analytics to understand platform usage patterns in aggregate, anonymized form.</p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul>
              <li><strong className="text-slate-300">Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-slate-300">Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong className="text-slate-300">Deletion:</strong> Request deletion of your personal data (subject to legal obligations).</li>
              <li><strong className="text-slate-300">Portability:</strong> Request your data in a structured, machine-readable format.</li>
              <li><strong className="text-slate-300">Objection:</strong> Object to processing of your data in certain circumstances.</li>
              <li><strong className="text-slate-300">Restriction:</strong> Request restriction of processing in certain circumstances.</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us using the information in Section 11.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>The FitPilot platform is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately and we will take steps to delete it.</p>
          </Section>

          <Section title="10. International Data Transfers">
            <p>Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using the Service, you consent to the transfer of your information to these countries. We take appropriate safeguards to ensure your data is protected in accordance with this Privacy Policy.</p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Last updated" date. We encourage you to review this policy periodically. Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>
          </Section>

          <Section title="12. Contact Us">
            <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
            <ul>
              <li>Email: <span className="text-slate-300">fitpilot.saas@gmail.com</span></li>
              <li>Platform: FitPilot Support</li>
            </ul>
          </Section>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500">
          <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link href="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
          <span>·</span>
          <span>© 2026 FitPilot. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      <div className="text-sm text-slate-400 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:leading-relaxed">
        {children}
      </div>
    </div>
  );
}
