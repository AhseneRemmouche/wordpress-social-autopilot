import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/Skeleton";

/** Default loading skeleton for dashboard pages (list-shaped). */
export default function Loading(): ReactElement {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="space-y-2">
        {["a", "b", "c", "d", "e"].map((k) => (
          <Skeleton key={k} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
