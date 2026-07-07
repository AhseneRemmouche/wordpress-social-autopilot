"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";

import { Button } from "@/components/ui/Button";

const BAD_CREDENTIALS = "Incorrect email or password.";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: BAD_CREDENTIALS,
  AccessDenied: "That account isn't authorized to use this dashboard.",
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

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text " +
  "placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

/**
 * Sign-in card. Shows the shared team email+password form (when enabled) plus
 * the GitHub owner sign-in. `useSearchParams` sits inside a Suspense boundary in
 * the parent server component.
 */
export function SignInCard({
  teamEnabled,
  teamEmail,
}: {
  teamEnabled: boolean;
  teamEmail: string;
}): ReactElement {
  const router = useRouter();
  const errorCode = useSearchParams().get("error");
  const [githubLoading, setGithubLoading] = useState(false);
  const [email, setEmail] = useState(teamEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const urlError = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed. Please try again.")
    : null;
  const errorMessage = formError ?? urlError;

  function handleGitHub(): void {
    setGithubLoading(true);
    void signIn("github", { callbackUrl: "/dashboard" });
  }

  async function handleTeamSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const res = await signIn("team", { email, password, redirect: false });
    if (res?.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setFormError(BAD_CREDENTIALS);
    setSubmitting(false);
  }

  return (
    <div className="w-full max-w-sm motion-safe:animate-fade-in-up">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-text">WordPress Social Autopilot</h1>
        <p className="mt-2 text-sm text-muted">
          {teamEnabled
            ? "Sign in with your team account to manage connections and review generated posts."
            : "Owner access only. Sign in with the authorized GitHub account to manage connections and review generated posts."}
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {errorMessage}
          </div>
        )}

        {teamEnabled && (
          <form onSubmit={handleTeamSubmit} className="mt-6 space-y-3">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-medium text-muted">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </form>
        )}

        {teamEnabled && (
          <div className="my-6 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        <Button
          variant={teamEnabled ? "secondary" : "primary"}
          onClick={handleGitHub}
          loading={githubLoading}
          leftIcon={<GitHubIcon />}
          className={teamEnabled ? "w-full" : "mt-6 w-full"}
        >
          Sign in with GitHub
        </Button>
      </div>
    </div>
  );
}
