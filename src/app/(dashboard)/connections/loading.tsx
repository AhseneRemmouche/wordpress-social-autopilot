import type { ReactElement } from "react";

import { Skeleton } from "@/components/ui/Skeleton";

/** Loading skeleton for the connections page (card-shaped, one per platform). */
export default function Loading(): ReactElement {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid gap-3">
        {["a", "b", "c", "d", "e", "f"].map((k) => (
          <Skeleton key={k} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
