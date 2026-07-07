import { Suspense, type ReactElement } from "react";

import { TEAM_LOGIN_EMAIL, teamLoginEnabled } from "@/lib/team-login";

import { SignInCard } from "./SignInCard";

/** Sign-in page (FR-022): branded, dark-aware, team + GitHub sign-in. */
export default function SignInPage(): ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-text">
      <Suspense fallback={<div className="h-64 w-full max-w-sm" />}>
        <SignInCard teamEnabled={teamLoginEnabled()} teamEmail={TEAM_LOGIN_EMAIL} />
      </Suspense>
    </main>
  );
}
