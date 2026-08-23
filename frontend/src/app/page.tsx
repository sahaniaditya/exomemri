/* ---------------------------------------------------------------
   exomemri — "Never lose anything you learn online again."
   "Start free" -> /signup, "Log in" -> /login
----------------------------------------------------------------- */
import { Audience } from '@/components/marketing/Audience';
import { Faq } from '@/components/marketing/Faq';
import { Features } from '@/components/marketing/Features';
import { FinalCta } from '@/components/marketing/FinalCta';
import { Footer } from '@/components/marketing/Footer';
import { Hero } from '@/components/marketing/Hero';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { MarketingStyles } from '@/components/marketing/MarketingStyles';
import { Nav } from '@/components/marketing/Nav';
import { Problem } from '@/components/marketing/Problem';
import { Proof } from '@/components/marketing/Proof';
import { Solution } from '@/components/marketing/Solution';
import { WhyDifferent } from '@/components/marketing/WhyDifferent';

export default function Home() {
  return (
    <>
      <MarketingStyles />
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Features />
      <WhyDifferent />
      <Audience />
      <Proof />
      <Faq />
      <FinalCta />
      <Footer />
    </>
  );
}
