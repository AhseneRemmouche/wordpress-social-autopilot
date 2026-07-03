import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — WordPress Social Autopilot",
  description: "Terms of Service for the WordPress Social Autopilot application.",
};

export default function TermsPage(): ReactElement {
  return (
    <LegalPage title="Terms of Service" updated="July 3, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of WordPress Social Autopilot
        (the &ldquo;Service&rdquo;), an application operated by MLS Campus Inc (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By connecting a social media account to the Service
        or otherwise using it, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. What the Service does</h2>
      <p>
        The Service reads content you publish on your own WordPress site, uses it to draft
        platform-tailored social media posts, and — with your review and authorization — publishes
        those posts to social media accounts you have connected (such as LinkedIn, Facebook,
        Instagram, X, YouTube, and TikTok). You remain the author and owner of your content and are
        responsible for it.
      </p>

      <h2>2. Accounts and authorization</h2>
      <p>
        The Service is operated for a single authorized owner. You connect third-party accounts
        through each platform&rsquo;s official OAuth flow and may disconnect them at any time. You
        are responsible for maintaining the confidentiality of your credentials and for all activity
        that occurs under your connected accounts. You must have the right to publish the content you
        submit and to post to the accounts you connect.
      </p>

      <h2>3. Third-party platforms</h2>
      <p>
        When you connect a third-party platform, your use of that platform remains subject to that
        platform&rsquo;s own terms and policies, including the TikTok Developer Terms of Service, the
        Meta Platform Terms, the X Developer Agreement, the LinkedIn API Terms, and the YouTube API
        Services Terms of Service. You agree to comply with those terms. We are not responsible for
        the availability, accuracy, or actions of third-party platforms.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        You agree not to use the Service to publish content that is unlawful, infringing, deceptive,
        or that violates the rules of any connected platform, and not to interfere with or attempt to
        gain unauthorized access to the Service or its systems.
      </p>

      <h2>5. Content ownership</h2>
      <p>
        You retain all rights to the content you provide and publish through the Service. You grant
        us a limited license to process and transmit that content solely to provide the Service to
        you (for example, generating drafts and delivering them to the platforms you have connected).
      </p>

      <h2>6. Disclaimer and limitation of liability</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum
        extent permitted by law, we are not liable for any indirect, incidental, or consequential
        damages, or for content published to third-party platforms at your direction.
      </p>

      <h2>7. Changes and termination</h2>
      <p>
        We may modify or discontinue the Service, and may update these Terms, at any time. Continued
        use after changes take effect constitutes acceptance of the updated Terms. You may stop using
        the Service and disconnect your accounts at any time.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href="mailto:support@mlscampus.com">support@mlscampus.com</a>.
      </p>
    </LegalPage>
  );
}
