import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "May 21, 2026";

export default function TermsPage() {
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
            <h1 className="text-2xl font-bold text-white mb-2">Terms of Service</h1>
            <p className="text-sm text-slate-400">Last updated: {LAST_UPDATED}</p>
          </div>

          <Section title="1. Acceptance of Terms">
            <p>By accessing or using FitPilot ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These Terms apply to all users including gym owners, staff members, and gym members.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>FitPilot is a multi-tenant Software-as-a-Service (SaaS) gym management platform that enables gym owners to manage memberships, attendance, payments, workout plans, and staff. Access to the platform is granted upon approval and issuance of a valid access code.</p>
          </Section>

          <Section title="3. Account Registration">
            <ul>
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
              <li>You agree to notify us immediately of any unauthorized use of your account.</li>
              <li>Gym owner accounts require a valid access code issued by FitPilot administrators.</li>
              <li>You must be at least 18 years of age to create a gym owner or staff account.</li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
            <ul>
              <li>Use the Service in any way that violates applicable local, national, or international laws or regulations.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or its infrastructure.</li>
              <li>Reverse engineer, decompile, or disassemble any component of the Service.</li>
              <li>Use the Service to transmit spam, malware, or any harmful content.</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
              <li>Collect or harvest personal data from other users without their consent.</li>
              <li>Use automated tools (bots, scrapers) to access or interact with the Service.</li>
            </ul>
          </Section>

          <Section title="5. Subscription and Billing">
            <p>Access to FitPilot is provided on a subscription basis. By subscribing:</p>
            <ul>
              <li>You authorize us to charge your payment method on a recurring basis for the selected plan.</li>
              <li>Subscription fees are non-refundable except where required by applicable law.</li>
              <li>We reserve the right to modify pricing with 30 days' advance notice.</li>
              <li>Failure to maintain active subscription may result in suspension of your gym account.</li>
              <li>Gym accounts may be suspended for non-payment or violation of these Terms.</li>
            </ul>
          </Section>

          <Section title="6. Data and Privacy">
            <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-red-400 hover:text-red-300 transition-colors">Privacy Policy</Link>, which is incorporated into these Terms by reference. You agree that we may process your data as described in our Privacy Policy.</p>
            <p className="mt-3">As a gym owner, you are responsible for obtaining appropriate consent from your gym members for the collection and use of their personal data within the platform, and for complying with all applicable data protection laws (including GDPR where applicable).</p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>The Service and its original content, features, and functionality are owned by FitPilot and are protected by international copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works from any part of the Service without prior written consent.</p>
          </Section>

          <Section title="8. Termination">
            <p>We reserve the right to suspend or terminate your account at our sole discretion, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties. Upon termination, your right to use the Service will immediately cease.</p>
          </Section>

          <Section title="9. Disclaimers and Limitation of Liability">
            <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind. To the maximum extent permitted by law, FitPilot shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising from your use of or inability to use the Service.</p>
          </Section>

          <Section title="10. Indemnification">
            <p>You agree to defend, indemnify, and hold harmless FitPilot and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, or expenses arising out of or related to your use of the Service, your violation of these Terms, or your violation of any third party's rights.</p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>We reserve the right to modify these Terms at any time. We will notify registered users of material changes via email or in-app notification. Continued use of the Service after changes constitutes your acceptance of the revised Terms.</p>
          </Section>

          <Section title="12. Governing Law">
            <p>These Terms shall be governed by and construed in accordance with applicable laws. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts.</p>
          </Section>

          <Section title="13. Contact Us">
            <p>If you have any questions about these Terms of Service, please contact us:</p>
            <ul>
              <li>Email: <span className="text-slate-300">fitpilot.saas@gmail.com</span></li>
              <li>Platform: FitPilot Support</li>
            </ul>
          </Section>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500">
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
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
