"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/Button";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "That GitHub account isn't authorized. Sign in with the owner account.",
  Configuration: "Sign-in is misconfigured. Contact the site owner.",
  Verification: "This sign-in link is no longer valid.",
};

function GitHubIcon(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.31-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.87.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.82 1.1.82 2.22 0 1.6-.02 2.9-.02 3.29 0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

/** Card contents; separated so useSearchParams sits inside a Suspense boundary. */
function SignInCard(): ReactElement {
  const errorCode = useSearchParams().get("error");
  const [loading, setLoading] = useState(false);

  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.")
    : null;

  function handleSignIn(): void {
    setLoading(true);
    void signIn("github", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="w-full max-w-sm motion-safe:animate-fade-in-up">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-text">WordPress Social Autopilot</h1>
        <p className="mt-2 text-sm text-muted">
          Owner access only. Sign in with the authorized GitHub account to manage connections and
          review generated posts.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {errorMessage}
          </div>
        )}

        <Button
          onClick={handleSignIn}
          loading={loading}
          leftIcon={<GitHubIcon />}
          className="mt-6 w-full"
        >
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}

/** Owner sign-in page (FR-022): branded, dark-aware, with error + loading states. */
export default function SignInPage(): ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-text">
      <Suspense fallback={<div className="h-64 w-full max-w-sm" />}>
        <SignInCard />
      </Suspense>
    </main>
  );
}
