import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/Skeleton";

/** Loading skeleton for the post review detail (header + platform card grid). */
export default function Loading(): ReactElement {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-6 w-72" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
