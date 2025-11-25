import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service - Chauffs',
  description: 'Terms of Service for Chauffs trip planning platform',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <div className="space-y-6 text-sm leading-relaxed">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
                <p>
                  By accessing or using Chauffs ("Service", "Platform", "we", "us", "our"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
                <p>
                  Chauffs is a SaaS platform that provides trip planning, analysis, and driver briefing services. The Service includes:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Trip planning and itinerary management</li>
                  <li>AI-powered trip analysis and risk assessment</li>
                  <li>Driver briefing generation</li>
                  <li>Quote management and driver assignment</li>
                  <li>Integration with third-party services for location data, weather, traffic, and safety information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. User Accounts and Registration</h2>
                <p>
                  To use certain features of the Service, you must register for an account. You agree to:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Provide accurate, current, and complete information during registration</li>
                  <li>Maintain and update your account information to keep it accurate</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized access or security breach</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
                <p>You agree not to:</p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Use the Service for any illegal purpose or in violation of any laws</li>
                  <li>Transmit any harmful code, viruses, or malicious software</li>
                  <li>Attempt to gain unauthorized access to the Service or related systems</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use automated systems to access the Service without permission</li>
                  <li>Impersonate any person or entity</li>
                  <li>Collect or harvest information about other users</li>
                  <li>Use the Service to send spam or unsolicited communications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. User Content and Data</h2>
                <p>
                  You retain ownership of all content and data you submit to the Service ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, process, and display your User Content solely for the purpose of providing the Service.
                </p>
                <p className="mt-3">
                  You are solely responsible for your User Content and warrant that:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>You have the right to submit the User Content</li>
                  <li>Your User Content does not violate any third-party rights</li>
                  <li>Your User Content is accurate and not misleading</li>
                  <li>Your User Content complies with all applicable laws</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. AI-Generated Content</h2>
                <p>
                  The Service uses artificial intelligence to generate trip reports, analyses, and recommendations. You acknowledge that:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>AI-generated content may contain errors or inaccuracies</li>
                  <li>You should verify all AI-generated information before relying on it</li>
                  <li>We are not liable for decisions made based on AI-generated content</li>
                  <li>AI-generated content is provided "as is" without warranties</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Third-Party Services and Data</h2>
                <p>
                  The Service integrates with third-party services and APIs (including but not limited to Google Maps, Open-Meteo, UK Police API, TfL API) to provide location, weather, traffic, and safety data. We are not responsible for:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>The accuracy, completeness, or availability of third-party data</li>
                  <li>Any errors or omissions in third-party services</li>
                  <li>Service interruptions or changes to third-party APIs</li>
                  <li>Third-party terms of service or privacy policies</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Payment and Billing</h2>
                <p>
                  If you subscribe to a paid plan:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Fees are charged in advance on a recurring basis</li>
                  <li>All fees are non-refundable unless required by law</li>
                  <li>You authorize us to charge your payment method automatically</li>
                  <li>Price changes will be communicated with at least 30 days notice</li>
                  <li>You may cancel your subscription at any time</li>
                  <li>Cancellation takes effect at the end of the current billing period</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Intellectual Property</h2>
                <p>
                  The Service, including its original content, features, and functionality, is owned by Chauffs and protected by international copyright, trademark, and other intellectual property laws. You may not:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Copy, modify, or create derivative works of the Service</li>
                  <li>Reverse engineer or attempt to extract source code</li>
                  <li>Remove any copyright or proprietary notices</li>
                  <li>Use our trademarks or logos without permission</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Service Availability and Modifications</h2>
                <p>
                  We reserve the right to:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Modify, suspend, or discontinue the Service at any time</li>
                  <li>Update features, functionality, or pricing</li>
                  <li>Perform maintenance that may temporarily interrupt service</li>
                  <li>Restrict access to the Service for any reason</li>
                </ul>
                <p className="mt-3">
                  We will provide reasonable notice of significant changes when possible.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Termination</h2>
                <p>
                  We may terminate or suspend your account and access to the Service immediately, without prior notice, for:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Violation of these Terms</li>
                  <li>Fraudulent, abusive, or illegal activity</li>
                  <li>Non-payment of fees (for paid plans)</li>
                  <li>Extended periods of inactivity</li>
                </ul>
                <p className="mt-3">
                  Upon termination, your right to use the Service ceases immediately. You may terminate your account at any time by contacting us or using account deletion features.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Disclaimers</h2>
                <p>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
                </p>
                <p className="mt-3">
                  We do not warrant that:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>The Service will be uninterrupted or error-free</li>
                  <li>Defects will be corrected</li>
                  <li>The Service is free of viruses or harmful components</li>
                  <li>Results obtained from the Service will be accurate or reliable</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">13. Limitation of Liability</h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHAUFFS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
                </p>
                <p className="mt-3">
                  Our total liability for any claims arising from or related to the Service shall not exceed the amount you paid us in the 12 months preceding the claim, or $100, whichever is greater.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">14. Indemnification</h2>
                <p>
                  You agree to indemnify, defend, and hold harmless Chauffs, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Your use of the Service</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any third-party rights</li>
                  <li>Your User Content</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">15. Governing Law and Dispute Resolution</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
                </p>
                <p className="mt-3">
                  Any disputes arising from these Terms or the Service shall be resolved through binding arbitration in accordance with [Arbitration Rules], except where prohibited by law.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">16. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. We will notify users of material changes by:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Posting the updated Terms on this page</li>
                  <li>Updating the "Last updated" date</li>
                  <li>Sending email notifications for significant changes</li>
                </ul>
                <p className="mt-3">
                  Your continued use of the Service after changes become effective constitutes acceptance of the modified Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">17. Contact Information</h2>
                <p>
                  If you have questions about these Terms, please contact us at:
                </p>
                <p className="mt-2">
                  Email: <a href="mailto:legal@chauffs.com" className="text-primary hover:underline">legal@chauffs.com</a>
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">18. Severability</h2>
                <p>
                  If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">19. Entire Agreement</h2>
                <p>
                  These Terms constitute the entire agreement between you and Chauffs regarding the Service and supersede all prior agreements and understandings.
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

