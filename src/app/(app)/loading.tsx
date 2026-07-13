import { BrandLoader } from "@/components/shared/brand-loader";

// Route-group loading boundary: covers every app route while its chunk/RSC payload loads, so slow
// navigations show the brand loader instead of a frozen screen. Data-fetch loading states stay
// inside each page (React Query + BrandLoader).
export default function AppLoading() {
  return <BrandLoader />;
}
