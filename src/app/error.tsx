"use client";

import { StatusScreen, StatusPrimaryLink } from "@/components/shared/status-screen";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusScreen
      code="500"
      title="Something went wrong"
      message="An unexpected error interrupted this page. Try again, or head back to your club."
    >
      <button
        onClick={reset}
        className="rounded-[13px] border border-bd bg-sf px-5 py-3 text-[15px] font-semibold leading-none text-ink transition-colors hover:bg-sf2"
      >
        Try again
      </button>
      <StatusPrimaryLink href="/dashboard">Back to dashboard</StatusPrimaryLink>
    </StatusScreen>
  );
}
