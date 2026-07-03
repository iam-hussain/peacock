import { StatusScreen, StatusPrimaryLink } from "@/components/shared/status-screen";

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="Page not found"
      message="This page has flown the coop. Check the link, or head back to your club."
    >
      <StatusPrimaryLink href="/dashboard">Back to dashboard</StatusPrimaryLink>
    </StatusScreen>
  );
}
