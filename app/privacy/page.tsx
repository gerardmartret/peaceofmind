import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - Chauffs',
  description: 'Privacy Policy for Chauffs trip planning platform',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <div className="space-y-6 text-sm leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
                <p>
                  Chauffs ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service. By using the Service, you consent to the data practices described in this policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
                
                <h3 className="text-lg font-semibold mt-4 mb-2">2.1 Information You Provide</h3>
                <p>We collect information you provide directly to us, including:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Account Information:</strong> Email address, password (hashed), and profile information</li>
                  <li><strong>Trip Data:</strong> Locations, dates, times, passenger information, trip notes, and preferences</li>
                  <li><strong>Driver Information:</strong> Driver email addresses, quotes, and assignment details</li>
                  <li><strong>Communication Data:</strong> Messages, feedback, and support requests</li>
                  <li><strong>Payment Information:</strong> Billing details processed through secure payment processors</li>
                </ul>

                <h3 className="text-lg font-semibold mt-4 mb-2">2.2 Automatically Collected Information</h3>
                <p>We automatically collect certain information when you use the Service:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and interaction patterns</li>
                  <li><strong>Device Information:</strong> IP address, browser type, operating system, and device identifiers</li>
                  <li><strong>Log Data:</strong> Access times, error logs, and system events</li>
                  <li><strong>Cookies and Tracking:</strong> See our Cookie Policy section below</li>
                </ul>

                <h3 className="text-lg font-semibold mt-4 mb-2">2.3 Third-Party Data</h3>
                <p>We may collect data from third-party services you authorize, such as:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Location data from Google Maps API</li>
                  <li>Weather data from Open-Meteo</li>
                  <li>Traffic and safety data from public APIs (TfL, UK Police)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
                <p>We use collected information for the following purposes:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Service Provision:</strong> To provide, maintain, and improve the Service</li>
                  <li><strong>Trip Management:</strong> To create, store, and manage your trip plans and reports</li>
                  <li><strong>AI Processing:</strong> To generate trip analyses, risk assessments, and driver trips</li>
                  <li><strong>Communication:</strong> To send trip updates, notifications, and respond to inquiries</li>
                  <li><strong>Driver Coordination:</strong> To facilitate driver assignments, quotes, and confirmations</li>
                  <li><strong>Analytics:</strong> To analyze usage patterns and improve service quality</li>
                  <li><strong>Security:</strong> To detect, prevent, and address security issues</li>
                  <li><strong>Legal Compliance:</strong> To comply with legal obligations and enforce our Terms</li>
                  <li><strong>Marketing:</strong> To send promotional communications (with your consent, opt-out available)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Data Processing and AI</h2>
                <p>
                  Your trip data is processed using artificial intelligence to generate reports and analyses. This includes:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Processing trip notes and requirements through AI models (OpenAI GPT-4o-mini)</li>
                  <li>Analyzing location data, weather, traffic, and safety information</li>
                  <li>Generating executive reports and driver trips</li>
                  <li>Quality evaluation and improvement of AI-generated content</li>
                </ul>
                <p className="mt-3">
                  AI processing is performed in accordance with our data processing agreements and OpenAI's privacy policies. Your data is not used to train AI models without your explicit consent.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Sharing and Disclosure</h2>
                <p>We may share your information in the following circumstances:</p>
                
                <h3 className="text-lg font-semibold mt-4 mb-2">5.1 Service Providers</h3>
                <p>We share data with trusted service providers who assist in operating the Service:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Cloud Hosting:</strong> Supabase (database and authentication)</li>
                  <li><strong>AI Services:</strong> OpenAI (report generation and analysis)</li>
                  <li><strong>Email Services:</strong> Resend (transactional emails)</li>
                  <li><strong>Payment Processors:</strong> Secure payment processing services</li>
                  <li><strong>Analytics:</strong> Service usage and performance monitoring</li>
                </ul>

                <h3 className="text-lg font-semibold mt-4 mb-2">5.2 Driver Information</h3>
                <p>
                  When you assign a driver to a trip, we share relevant trip information (locations, times, passenger details, trip notes) with the assigned driver via email and the Service interface.
                </p>

                <h3 className="text-lg font-semibold mt-4 mb-2">5.3 Legal Requirements</h3>
                <p>We may disclose information if required by law or to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Comply with legal processes or government requests</li>
                  <li>Enforce our Terms of Service</li>
                  <li>Protect our rights, privacy, safety, or property</li>
                  <li>Prevent fraud or security issues</li>
                </ul>

                <h3 className="text-lg font-semibold mt-4 mb-2">5.4 Business Transfers</h3>
                <p>
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Storage and Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your data:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Encryption:</strong> Data in transit (TLS/SSL) and at rest</li>
                  <li><strong>Access Controls:</strong> Limited access to authorized personnel only</li>
                  <li><strong>Authentication:</strong> Secure password hashing and session management</li>
                  <li><strong>Regular Audits:</strong> Security assessments and vulnerability testing</li>
                  <li><strong>Data Backup:</strong> Regular backups with disaster recovery procedures</li>
                </ul>
                <p className="mt-3">
                  However, no method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
                <p>We retain your information for as long as necessary to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Provide the Service to you</li>
                  <li>Comply with legal obligations</li>
                  <li>Resolve disputes and enforce agreements</li>
                  <li>Maintain business records for analytics and improvement</li>
                </ul>
                <p className="mt-3">
                  When you delete your account, we will delete or anonymize your personal data within 30 days, except where retention is required by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Your Rights and Choices</h2>
                <p>Depending on your location, you may have the following rights:</p>
                
                <h3 className="text-lg font-semibold mt-4 mb-2">8.1 Access and Portability</h3>
                <p>You can access, download, or export your data at any time through your account settings or by contacting us.</p>

                <h3 className="text-lg font-semibold mt-4 mb-2">8.2 Correction</h3>
                <p>You can update or correct your account information and trip data through the Service interface.</p>

                <h3 className="text-lg font-semibold mt-4 mb-2">8.3 Deletion</h3>
                <p>You can request deletion of your account and associated data by contacting us or using account deletion features.</p>

                <h3 className="text-lg font-semibold mt-4 mb-2">8.4 Opt-Out</h3>
                <p>You can opt-out of marketing communications by:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Clicking unsubscribe links in emails</li>
                  <li>Updating your account preferences</li>
                  <li>Contacting us directly</li>
                </ul>

                <h3 className="text-lg font-semibold mt-4 mb-2">8.5 GDPR Rights (EU Users)</h3>
                <p>If you are in the European Union, you have additional rights under GDPR:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Right to access your personal data</li>
                  <li>Right to rectification of inaccurate data</li>
                  <li>Right to erasure ("right to be forgotten")</li>
                  <li>Right to restrict processing</li>
                  <li>Right to data portability</li>
                  <li>Right to object to processing</li>
                  <li>Right to withdraw consent</li>
                </ul>

                <h3 className="text-lg font-semibold mt-4 mb-2">8.6 CCPA Rights (California Users)</h3>
                <p>If you are a California resident, you have rights under CCPA:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Right to know what personal information is collected</li>
                  <li>Right to delete personal information</li>
                  <li>Right to opt-out of sale of personal information (we do not sell your data)</li>
                  <li>Right to non-discrimination for exercising your rights</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Cookies and Tracking Technologies</h2>
                <p>We use cookies and similar technologies to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Essential Cookies:</strong> Required for authentication and core functionality</li>
                  <li><strong>Analytics Cookies:</strong> To understand usage patterns and improve the Service</li>
                  <li><strong>Preference Cookies:</strong> To remember your settings and preferences</li>
                </ul>
                <p className="mt-3">
                  You can control cookies through your browser settings. However, disabling essential cookies may affect Service functionality.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Third-Party Services</h2>
                <p>Our Service integrates with third-party services that have their own privacy policies:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li><strong>Supabase:</strong> Database and authentication services</li>
                  <li><strong>OpenAI:</strong> AI processing and report generation</li>
                  <li><strong>Resend:</strong> Email delivery services</li>
                  <li><strong>Google Maps API:</strong> Location and mapping services</li>
                  <li><strong>Payment Processors:</strong> Secure payment processing</li>
                </ul>
                <p className="mt-3">
                  We encourage you to review their privacy policies. We are not responsible for the privacy practices of third-party services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. International Data Transfers</h2>
                <p>
                  Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We ensure appropriate safeguards are in place, including:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Standard contractual clauses</li>
                  <li>Adequacy decisions where applicable</li>
                  <li>Other appropriate safeguards as required by law</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Children's Privacy</h2>
                <p>
                  The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete such information promptly.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">13. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of material changes by:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Posting the updated policy on this page</li>
                  <li>Updating the "Last updated" date</li>
                  <li>Sending email notifications for significant changes</li>
                  <li>Displaying in-app notifications</li>
                </ul>
                <p className="mt-3">
                  Your continued use of the Service after changes become effective constitutes acceptance of the updated Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">14. Data Protection Officer</h2>
                <p>
                  For privacy-related inquiries, data protection requests, or to exercise your rights, please contact:
                </p>
                <p className="mt-2">
                  Email: <a href="mailto:privacy@chauffs.com" className="text-primary hover:underline">privacy@chauffs.com</a>
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">15. Contact Us</h2>
                <p>
                  If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
                </p>
                <p className="mt-2">
                  Email: <a href="mailto:privacy@chauffs.com" className="text-primary hover:underline">privacy@chauffs.com</a>
                </p>
                <p className="mt-2">
                  Address: [Your Company Address]
                </p>
              </section>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

