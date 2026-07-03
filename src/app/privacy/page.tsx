import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — WordPress Social Autopilot",
  description: "Privacy Policy for the WordPress Social Autopilot application.",
};

export default function PrivacyPage(): ReactElement {
  return (
    <LegalPage title="Privacy Policy" updated="July 3, 2026">
      <p>
        This Privacy Policy explains how WordPress Social Autopilot (the &ldquo;Service&rdquo;),
        operated by MLS Campus Inc (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;),
        collects, uses, and protects information when you connect accounts and publish content
        through the Service.
      </p>

      <h2>Information we collect</h2>
      <p>We collect only what is needed to operate the Service:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Authentication tokens.</strong> When you connect a third-party platform (such as
          TikTok, LinkedIn, Facebook, Instagram, X, or YouTube) through its official OAuth flow, we
          store the access and refresh tokens the platform issues so we can publish on your behalf.
        </li>
        <li>
          <strong>Basic account identifiers.</strong> We store the account or page identifiers and
          usernames returned by each platform (for example, a TikTok open ID or a Facebook Page ID)
          to associate connections with your posts.
        </li>
        <li>
          <strong>Content you provide.</strong> We process the WordPress posts you choose to
          syndicate and the social media drafts generated from them.
        </li>
      </ul>
      <p>
        We do not collect payment information, and we do not ask you to enter platform passwords into
        the Service — authorization happens entirely through each platform&rsquo;s OAuth screens.
      </p>

      <h2>How we use information</h2>
      <p>
        We use the information solely to provide the Service: to generate social media drafts from
        your content, to let you review and approve them, and to publish approved posts to the
        accounts you have connected. We do not sell your information, and we do not use it for
        advertising.
      </p>

      <h2>How we protect information</h2>
      <p>
        Authentication tokens are encrypted at rest using AES-256-GCM and are transmitted over
        HTTPS. Access to the Service is restricted to the authorized owner. Tokens are used only to
        make API requests to the platforms you have connected.
      </p>

      <h2>Data sharing</h2>
      <p>
        We share content only with the third-party platforms you explicitly connect and choose to
        publish to, and only to fulfill your publishing requests. We may disclose information if
        required by law. We do not otherwise share your information with third parties.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We retain connection tokens and post records for as long as an account remains connected and
        the Service is in use. When you disconnect a platform, its stored tokens are removed. You may
        request deletion of your data at any time by contacting us, and we will delete the associated
        tokens and records.
      </p>

      <h2>Third-party platforms</h2>
      <p>
        Your connected platforms process data under their own privacy policies, including those of
        TikTok, Meta (Facebook and Instagram), X, LinkedIn, and Google (YouTube). This Policy covers
        only the WordPress Social Autopilot application.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy questions or data deletion requests, contact us at{" "}
        <a href="mailto:support@mlscampus.com">support@mlscampus.com</a>.
      </p>
    </LegalPage>
  );
}
