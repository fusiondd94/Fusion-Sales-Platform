import type { Metadata } from "next";
import "./legal-append.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Fusion Digital Dynamics",
  description: "How Fusion Digital Dynamics LLC collects, uses, and protects your information."
};

export default function PrivacyPolicyPage() {
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
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Effective date: August 1, 2026</p>

        <div className="legal-body">
          <p>
            Fusion Digital Dynamics LLC (&ldquo;Fusion Digital Dynamics,&rdquo; &ldquo;Fusion,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
            or &ldquo;our&rdquo;) provides website design, hosting, security, marketing, and client-relationship-management
            services, including a sales and client platform accessible at this domain and at portal.fddynamics.com
            (together, the &ldquo;Services&rdquo;). This Privacy Policy explains what information we collect, how we use
            and share it, and the choices you have. It applies to visitors, prospective clients, clients, and any
            individual who contacts Fusion Digital Dynamics or a Fusion Digital Dynamics client through a channel
            we operate on their behalf, including WhatsApp, Facebook Messenger, and Instagram Direct.
          </p>
          <p>
            This policy is written to be clear rather than exhaustive. It is not a substitute for legal advice, and
            if you are relying on it to meet a specific regulatory obligation, we recommend having it reviewed by a
            qualified attorney.
          </p>

          <h2>1. Who this policy covers</h2>
          <p>We act in two roles, and this policy covers both:</p>
          <ul>
            <li>
              <strong>As a service provider to our clients.</strong> When a business purchases our website,
              hosting, or CRM services, we process the personal data of that business&rsquo;s own customers and
              contacts on the business&rsquo;s behalf &mdash; for example, messages sent to a client&rsquo;s WhatsApp
              Business number, or leads captured through a client&rsquo;s website. In this role, our client is the
              data controller and we act as a processor under their instructions.
            </li>
            <li>
              <strong>As the operator of our own sales platform.</strong> When you fill out our questionnaire,
              request a quote, create a client-portal account, or otherwise interact directly with Fusion Digital
              Dynamics, we are the data controller of that information.
            </li>
          </ul>

          <h2>2. Information we collect</h2>
          <p>
            <strong>Information you provide directly.</strong> When you use our guided questionnaire, request a
            plan, or check out, we collect information such as your name, business name, email address, phone
            number, billing address, and answers to questions about your business (industry, goals, and similar
            details) used to generate a recommendation. When you create or use a client-portal account, we collect
            your login credentials, project details, uploaded files, and any comments or messages you send us
            through the portal.
          </p>
          <p>
            <strong>Payment information.</strong> Payments are processed by Stripe. We do not store full card
            numbers on our servers; Stripe provides us with limited transaction details (such as the last four
            digits of a card, amount, and status) needed to maintain your billing record.
          </p>
          <p>
            <strong>Messaging data (WhatsApp, Messenger, Instagram).</strong> Fusion Digital Dynamics operates a
            unified inbox that connects to the WhatsApp Business Platform, Facebook Messenger, and Instagram
            Direct on behalf of Fusion Digital Dynamics and, where a client has connected their own business
            accounts, on behalf of that client. Through these integrations we may receive and store:
          </p>
          <ul>
            <li>The content of messages sent to or from a connected business account (text, and metadata about media, template, and interactive messages).</li>
            <li>Sender and recipient identifiers, such as a WhatsApp phone number, a Messenger-scoped user ID, or an Instagram-scoped user ID, and profile information made available by the platform (such as a display name).</li>
            <li>Message status events (sent, delivered, read, failed).</li>
            <li>
              For businesses that keep using the WhatsApp Business mobile app alongside our platform
              (&ldquo;coexistence&rdquo;), we also receive: up to 180 days of prior chat history the business
              consents to share, contact records synced from the business&rsquo;s phone (name and phone number),
              and copies of messages the business sends from the WhatsApp Business app itself, so that our unified
              inbox stays consistent with what the business actually sent.
            </li>
          </ul>
          <p>
            We use this messaging data to display conversations in our clients&rsquo; inbox, route them to the
            right team member, trigger automations the client has configured (such as auto-replies or lead
            routing), and &mdash; where the client has enabled it &mdash; to power AI-assisted drafting or
            summarization of conversations.
          </p>
          <p>
            <strong>Automatically collected information.</strong> Like most web platforms, our servers and hosting
            provider (Vercel) log standard technical data such as IP address, browser type, device information,
            pages visited, and timestamps, primarily for security, debugging, and performance monitoring.
          </p>
          <p>
            <strong>Cookies.</strong> We use a limited number of cookies and similar local-storage technologies to
            keep you signed in, remember preferences, and, where applicable, measure aggregate site usage. We do
            not use cookies to sell your personal information.
          </p>

          <h2>3. How we use information</h2>
          <p>We use the information described above to:</p>
          <ul>
            <li>Operate, maintain, and improve the Services, including generating pricing recommendations, processing purchases, and managing the client portal.</li>
            <li>Provide the unified inbox, CRM, and automation features that let our clients (and, where we operate the account directly, Fusion Digital Dynamics itself) communicate with their own contacts over WhatsApp, Messenger, and Instagram.</li>
            <li>Send transactional communications, such as purchase confirmations, launch-requirement checklists, and account notices, by email (via Resend) or through the connected messaging channels.</li>
            <li>Detect, investigate, and prevent fraud, abuse, and security incidents.</li>
            <li>Comply with legal obligations and enforce our agreements.</li>
            <li>With appropriate consent or as otherwise permitted, send marketing communications about our services; you can opt out at any time (see Section 6).</li>
          </ul>
          <p>
            We do not sell personal information, and we do not use WhatsApp, Messenger, or Instagram message
            content for advertising purposes.
          </p>

          <h2>4. How we share information</h2>
          <p>We share information with:</p>
          <ul>
            <li>
              <strong>Service providers who process data on our behalf</strong>, under contract and only for the
              purposes described in this policy. These currently include Supabase (database and backend
              infrastructure), Vercel (hosting), Stripe (payment processing), Resend (transactional email
              delivery), and Meta Platforms, Inc. (WhatsApp Business Platform, Messenger, and Instagram messaging
              APIs, used to send and receive messages on behalf of connected business accounts).
            </li>
            <li>
              <strong>The business that owns a connected messaging account.</strong> If you message a Fusion
              Digital Dynamics client&rsquo;s WhatsApp, Messenger, or Instagram account, your messages and related
              information are shared with that business so they can respond to you, exactly as if you had messaged
              them directly.
            </li>
            <li>
              <strong>Professional advisors and successors</strong>, such as auditors or legal counsel, or in
              connection with a merger, acquisition, financing, or sale of assets, subject to standard
              confidentiality protections.
            </li>
            <li>
              <strong>Law enforcement or regulators</strong>, where we believe disclosure is required by law, or
              necessary to protect the rights, property, or safety of Fusion Digital Dynamics, our clients, or
              others.
            </li>
          </ul>
          <p>
            We do not permit our service providers to use your information for their own independent marketing
            purposes.
          </p>

          <h2>5. Data retention</h2>
          <p>
            We retain personal information for as long as needed to provide the Services, comply with legal and
            tax obligations, resolve disputes, and enforce our agreements. Messaging data is generally retained
            for as long as the associated client account remains active, plus a reasonable period afterward for
            record-keeping, unless a shorter period is requested and we are not otherwise required to retain it.
            You may request deletion as described in Section 6.
          </p>

          <h2>6. Your rights and choices</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, delete, or receive a copy of your
            personal information, or to object to or restrict certain processing. To exercise these rights,
            contact us using the details in Section 9. If we process your information as a processor on behalf of
            one of our clients (for example, because you messaged their WhatsApp number), we will generally direct
            your request to that client, since they control the data; you&rsquo;re also welcome to contact them
            directly.
          </p>
          <p>
            <strong>Messaging opt-out.</strong> You can stop receiving messages from a connected WhatsApp,
            Messenger, or Instagram account at any time by blocking the account or, for WhatsApp, by using the
            platform&rsquo;s standard opt-out controls. Opting out of one channel does not affect other channels
            you may have separately opted into.
          </p>
          <p>
            <strong>Marketing opt-out.</strong> Marketing emails include an unsubscribe link. You can also contact
            us directly to opt out.
          </p>
          <p>
            <strong>Do Not Track.</strong> Our Services do not currently respond to browser &ldquo;Do Not
            Track&rdquo; signals.
          </p>

          <h2>7. Data security</h2>
          <p>
            We use commercially reasonable administrative, technical, and physical safeguards designed to protect
            personal information, including encryption in transit, access controls, and reliance on infrastructure
            providers (Supabase, Vercel) that maintain their own security programs. No method of transmission or
            storage is completely secure, and we cannot guarantee absolute security.
          </p>

          <h2>8. Children&rsquo;s privacy</h2>
          <p>
            The Services are intended for businesses and individuals who are at least 18 years old. We do not
            knowingly collect personal information from children. If you believe a child has provided us with
            personal information, please contact us and we will take appropriate steps to delete it.
          </p>

          <h2>9. International data transfers</h2>
          <p>
            We and our service providers may process and store information in the United States and other
            countries. Where required, we rely on appropriate safeguards for cross-border transfers of personal
            information.
          </p>

          <h2>10. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices or for legal,
            operational, or regulatory reasons. We will update the &ldquo;Effective date&rdquo; above when we do,
            and, for material changes, we will provide additional notice where appropriate.
          </p>

          <h2>11. Contact us</h2>
          <p>If you have questions about this Privacy Policy or want to exercise a privacy right, contact us at:</p>
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
