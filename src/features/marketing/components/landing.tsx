import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingFooter } from "./landing-footer";
import { LandingMobile } from "./landing-mobile";
import { WhatsAppCard } from "@/components/shared/whatsapp-card";

export function Landing() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden min-h-screen flex-col bg-bg md:flex">
        <LandingHeader />
        <LandingHero />
        <div className="mx-auto w-full max-w-[1100px] px-7 pb-12">
          <div className="max-w-130">
            <WhatsAppCard />
          </div>
        </div>
        <LandingFooter />
      </div>
      {/* Mobile */}
      <LandingMobile />
    </>
  );
}
