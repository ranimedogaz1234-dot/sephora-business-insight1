import { PageSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
      <Skeleton className="h-[26rem] rounded-xl" />
      <Skeleton className="h-[32rem] rounded-xl" />
    </PageSkeleton>
  );
}
