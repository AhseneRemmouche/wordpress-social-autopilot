import { redirect } from "next/navigation";

// Root route → the dashboard. The (dashboard) layout's owner-session guard
// redirects unauthenticated visitors on to /signin, so `/` is the journey entry.
export default function HomePage(): never {
  redirect("/dashboard");
}
