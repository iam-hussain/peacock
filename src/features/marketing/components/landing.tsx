import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingFooter } from "./landing-footer";
import { LandingMobile } from "./landing-mobile";

export function Landing() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden min-h-screen flex-col bg-bg md:flex">
        <LandingHeader />
        <LandingHero />
        <LandingFooter />
      </div>
      {/* Mobile */}
      <LandingMobile />
    </>
  );
}
