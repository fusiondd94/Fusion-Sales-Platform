import type { Metadata } from "next";
import "./legal-append.css";

export const metadata: Metadata = {
  title: "Terms of Service | Fusion Digital Dynamics",
  description: "The terms that govern your use of Fusion Digital Dynamics LLC's services and platform."
};

export default function TermsOfServicePage() {
  return (
    <main className="shell shell-light legal-shell">
      <nav className="nav">
        <a className="brand" href="/">
          <span className="brand-mark">FDD</span>
          <span>Fusion Digital Dynamics</span>
        </a>
        <div className="nav-links">
          <a href="/#offers">Services</a>
          <a href="/#sales-flow">Sales Flow</a>
          <a href="/portal">Portal</a>
        </div>
        <a className="nav-cta" href="/#sales-flow">Start</a>
      </nav>

      <div className="legal-main">
        <p className="legal-eyebrow">Legal</p>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Effective date: August 1, 2026</p>

        <div className="legal-body">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) are a binding agreement between you and Fusion Digital
            Dynamics LLC (&ldquo;Fusion Digital Dynamics,&rdquo; &ldquo;Fusion,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;). They govern your access to and use of our website, our sales
            and client platform, the client portal at portal.fddynamics.com, and any related services
            (together, the &ldquo;Services&rdquo;). By visiting our website, submitting our questionnaire,
            purchasing a plan, or using the client portal, you agree to these Terms. If you are agreeing on
            behalf of a business, you represent that you have authority to bind that business.
          </p>
          <p>
            This document is written to be clear rather than exhaustive. It is not a substitute for legal
            advice, and if you need Terms tailored to a specific situation, we recommend having them reviewed
            by a qualified attorney.
          </p>

          <h2>1. Description of services</h2>
          <p>
            Fusion Digital Dynamics provides website design, hosting, security, and marketing services, along
            with a sales and client-relationship-management platform that includes a guided questionnaire and
            pricing recommendation tool, a client portal for managing projects and approvals, and a unified
            messaging inbox that can connect to WhatsApp, Facebook Messenger, and Instagram Direct on behalf of
            Fusion Digital Dynamics or a client who has connected their own business accounts. The specific
            services included in your engagement are described in your quote, order, or statement of work.
          </p>

          <h2>2. Accounts and eligibility</h2>
          <p>
            You must be at least 18 years old and able to form a binding contract to use the Services. If we
            provide you with a client-portal account, you are responsible for maintaining the confidentiality
            of your login credentials and for all activity that occurs under your account. Notify us promptly
            if you suspect unauthorized use of your account.
          </p>

          <h2>3. Messaging services (WhatsApp, Messenger, Instagram)</h2>
          <p>
            If you connect a WhatsApp Business, Facebook Messenger, or Instagram account to our platform, you
            authorize us to send and receive messages, media, and related data through that account on your
            behalf, and to process that data as described in our Privacy Policy. You remain responsible for
            complying with Meta&rsquo;s applicable platform terms and commerce policies, for obtaining any
            consent required to message your contacts, and for the content of messages sent from your account,
            including through automations you configure. We may suspend a connected channel if we reasonably
            believe it is being used to send unsolicited messages, spam, or content that violates Meta&rsquo;s
            policies or applicable law.
          </p>

          <h2>4. Fees and payment</h2>
          <p>
            Fees for the Services are set out in your quote or order and are processed through our
            payment processor, Stripe. Except where required by law or stated otherwise in your order, fees
            are non-refundable once work has begun. Recurring services (such as hosting) are billed on the
            cycle disclosed at checkout and will renew automatically unless cancelled in accordance with your
            order terms. You authorize us to charge your payment method on file for all fees due.
          </p>

          <h2>5. Client content and responsibilities</h2>
          <p>
            You are responsible for the accuracy and legality of any content, data, or contact information you
            provide to us or upload to the client portal, including copy, images, business information, and
            contact lists used for messaging or marketing. You represent that you have the rights necessary to
            provide that content to us and to have us use it to deliver the Services, and that your use of the
            Services complies with applicable law, including data-protection and anti-spam law.
          </p>

          <h2>6. Acceptable use</h2>
          <p>You agree not to use the Services to:</p>
          <ul>
            <li>Send unsolicited, deceptive, or unlawful messages or content, including through connected messaging channels.</li>
            <li>Violate the intellectual property, privacy, or other rights of any third party.</li>
            <li>Introduce malware, attempt to gain unauthorized access to our systems, or interfere with the Services&rsquo; operation.</li>
            <li>Use the Services for any purpose that violates applicable law or the terms of any third-party platform we integrate with, including Meta&rsquo;s platform terms.</li>
          </ul>
          <p>We may suspend or terminate access for use that violates this section.</p>

          <h2>7. Intellectual property</h2>
          <p>
            We retain all rights, title, and interest in the Services, including our website, platform
            software, design system, and documentation. Deliverables created specifically for you under a paid
            engagement (such as a custom website) are licensed or assigned to you as described in your order;
            absent a specific written assignment, we retain ownership of our underlying tools, templates, and
            code libraries used to build them. You retain ownership of the content and data you provide to us.
          </p>

          <h2>8. Third-party services</h2>
          <p>
            The Services rely on and integrate with third-party providers, including Meta Platforms, Inc.
            (WhatsApp, Messenger, Instagram), Stripe (payments), Supabase and Vercel (infrastructure), and
            Resend (email delivery). We are not responsible for the availability, security, or acts and
            omissions of these third parties, and your use of features built on their platforms is also subject
            to their own terms.
          </p>

          <h2>9. Disclaimers</h2>
          <p>
            The Services are provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the fullest extent
            permitted by law, we disclaim all warranties, express or implied, including warranties of
            merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that
            the Services will be uninterrupted, error-free, or that messages sent through connected channels
            will always be delivered, since delivery depends in part on third-party platforms outside our
            control.
          </p>

          <h2>10. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Fusion Digital Dynamics will not be liable for any
            indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenue,
            data, or goodwill, arising from your use of the Services. Our total liability for any claim arising
            out of or relating to these Terms or the Services will not exceed the amount you paid us for the
            Services giving rise to the claim in the twelve months before the claim arose.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold Fusion Digital Dynamics harmless from any claims, damages, or
            expenses (including reasonable attorneys&rsquo; fees) arising from your content, your use of the
            Services in violation of these Terms, or your violation of applicable law or a third party&rsquo;s
            rights.
          </p>

          <h2>12. Termination</h2>
          <p>
            You may stop using the Services at any time; cancellation of paid services is subject to the terms
            of your order. We may suspend or terminate your access to the Services if you materially breach
            these Terms and do not cure the breach after notice, or immediately if necessary to protect the
            Services, other users, or comply with law. Sections of these Terms that by their nature should
            survive termination (such as payment obligations, intellectual property, disclaimers, and
            limitation of liability) will survive.
          </p>

          <h2>13. Governing law</h2>
          <p>
            These Terms are governed by the laws of the United States and the state in which Fusion Digital
            Dynamics LLC is organized, without regard to conflict-of-law principles, unless a different
            governing law is required by applicable consumer-protection law.
          </p>

          <h2>14. Changes to these terms</h2>
          <p>
            We may update these Terms from time to time to reflect changes in our Services or for legal,
            operational, or regulatory reasons. We will update the &ldquo;Effective date&rdquo; above when we
            do, and, for material changes, we will provide additional notice where appropriate. Continued use
            of the Services after changes take effect constitutes acceptance of the updated Terms.
          </p>

          <h2>15. Contact us</h2>
          <p>If you have questions about these Terms, contact us at:</p>
          <div className="legal-contact">
            <p><strong>Fusion Digital Dynamics LLC</strong></p>
            <p>Email: privacy@fddynamics.com</p>
          </div>
        </div>

        <a className="legal-back" href="/">&larr; Back to Fusion Digital Dynamics</a>
      </div>
    </main>
  );
}
