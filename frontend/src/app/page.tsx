import {
  IBM_Plex_Mono,
  Instrument_Sans,
  Newsreader,
} from 'next/font/google';
import { Audience } from '@/components/marketing/Audience';
import { DemoVideo } from '@/components/marketing/DemoVideo';
import { Faq } from '@/components/marketing/Faq';
import { Features } from '@/components/marketing/Features';
import { FinalCta } from '@/components/marketing/FinalCta';
import { Footer } from '@/components/marketing/Footer';
import { Hero } from '@/components/marketing/Hero';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { KnowledgeMapShowcase } from '@/components/marketing/KnowledgeMapShowcase';
import { Nav } from '@/components/marketing/Nav';
import { NotesShowcase } from '@/components/marketing/NotesShowcase';
import { Problem } from '@/components/marketing/Problem';
import { Proof } from '@/components/marketing/Proof';
import { Solution } from '@/components/marketing/Solution';
import { WhyDifferent } from '@/components/marketing/WhyDifferent';
import styles from '@/components/marketing/marketing.module.css';
import { getTopReviews } from '@/lib/reviews';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-marketing-sans',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-marketing-serif',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-marketing-mono',
  display: 'swap',
});

export default async function Home() {
  const reviews = await getTopReviews()

  return (
    <div
      className={`${styles.page} ${instrumentSans.variable} ${newsreader.variable} ${ibmPlexMono.variable}`}
    >
      <Nav />
      <Hero />
      <DemoVideo />
      <Problem />
      <Solution />
      <HowItWorks />
      <KnowledgeMapShowcase />
      <NotesShowcase />
      <Features />
      <WhyDifferent />
      <Audience />
      <Proof reviews={reviews} />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}
