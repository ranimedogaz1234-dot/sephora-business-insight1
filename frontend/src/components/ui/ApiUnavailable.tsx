import { config } from "@/lib/config";
import { PageHeader } from "@/components/layout/PageHeader";

interface ApiUnavailableProps {
  eyebrow: string;
  title: string;
  description: string;
  error: unknown;
}

/** Whole-page state when the analytics API cannot be reached. Never shows placeholder figures. */
export function ApiUnavailable({ eyebrow, title, description, error }: ApiUnavailableProps) {
  const reason = error instanceof Error ? error.message : String(error);
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
        <div role="alert" className="max-w-xl rounded-xl border border-line p-6">
          <p className="text-sm font-semibold text-charcoal">The analytics API is not available</p>
          <p className="mt-1 text-sm text-ink-2">
            Cannot reach the API at {config.apiBaseUrl} ({reason}).
          </p>
          <p className="mt-3 text-xs text-ink-3">
            Start the backend (see README) and make sure SBI_DATA_DIR points to the CSV files. No figures are shown
            until real data is available.
          </p>
        </div>
      </main>
    </>
  );
}
