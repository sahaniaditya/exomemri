import { Newsreader, Instrument_Sans, IBM_Plex_Mono } from 'next/font/google'

// The Atlas type system: Newsreader for display/serif, Instrument Sans for UI,
// IBM Plex Mono for labels and numerics. Exposed as CSS variables so the
// dashboard stylesheet can reference them without prop drilling.
export const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

export const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument-sans',
  display: 'swap',
})

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

export const atlasFontVars = `${newsreader.variable} ${instrumentSans.variable} ${ibmPlexMono.variable}`
