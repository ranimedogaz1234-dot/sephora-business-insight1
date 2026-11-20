import { PageSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-[28rem] rounded-xl" />
    </PageSkeleton>
  );
}
