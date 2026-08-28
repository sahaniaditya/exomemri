export const FULL_ANSWER =
  "Across your sources, photosynthesis is how plants turn sunlight, water, and carbon dioxide into sugar — and release oxygen. You've covered the light reactions and chloroplasts — but you haven't studied the Calvin cycle yet.";

/**
 * Chrome Web Store listing for the capture extension.
 * Set `NEXT_PUBLIC_CHROME_WEB_STORE_URL` in production once the listing is live.
 */
export const CHROME_WEB_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_WEB_STORE_URL?.trim() ||
  'https://chromewebstore.google.com/detail/exomemri';

export const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Knowledge map', href: '#map' },
  { label: 'Features', href: '#features' },
  { label: 'Why exomemri', href: '#why' },
  { label: 'FAQ', href: '#faq' },
];

export const FEATURES_MAIN = [
  {
    n: 'F1',
    title: 'One-click capture',
    body: 'Save any page, YouTube video, or AI conversation into a topic with a single click. Highlight a passage to keep just what matters — without ever breaking your flow.',
  },
  {
    n: 'F2',
    title: 'Learning Spaces',
    body: 'Start with a goal, not a blank page. Create a space like "Biology," and everything you consume flows into it automatically — organized without manual filing.',
  },
  {
    n: 'F3',
    title: 'Instant AI summaries',
    body: 'Every source becomes a crisp summary the moment you save it: key points, core concepts, and clear takeaways. Useful immediately, not a growing to-read pile.',
  },
  {
    n: 'F4',
    title: 'A map of what you know',
    body: 'As you capture, exomemri pulls out the concepts you studied and draws how your sources connect — so overlapping videos and articles become one map, not a pile of duplicates.',
  },
  {
    n: 'F5',
    title: 'Ask your memory',
    body: "Chat with everything you've ever saved. Get answers drawn from your own sources, with citations that jump you straight back to where a concept was taught — down to the exact moment in a video.",
  },
  {
    n: 'F6',
    title: 'Your notes, on every capture',
    body: 'Add your own note pages beside any source — write, link, and paste images next to the video or article that inspired them. Your words stay with the learning that sparked them.',
  },
];

export const STEPS = [
  {
    n: 1,
    title: 'Capture',
    body: 'See something worth learning? Click once. Videos, articles, AI chats, and PDFs are saved into the right topic — no copy-paste, no lost tabs.',
  },
  {
    n: 2,
    title: 'Understand',
    body: 'exomemri instantly summarizes each source, pulls out the key concepts, and merges what you learn across sources into one clean, connected picture.',
  },
  {
    n: 3,
    title: 'Recall',
    body: 'Ask your memory anything, review with quizzes and flashcards built from your own material, and pick up exactly where you left off — any time.',
  },
];

export const AUDIENCE = [
  { icon: '✦', title: 'Self-learners', body: 'Who use videos, articles, and AI chats as a temporary brain — and want a permanent one.' },
  { icon: '✎', title: 'Students', body: 'Juggling courses, lectures, and readings across dozens of topics.' },
  { icon: '↗', title: 'Career switchers', body: 'Teaching themselves new fields from scattered online sources.' },
  { icon: '⌘', title: 'Lifelong learners', body: 'Curious people who learn for years, not just for the next exam.' },
];

export const FAQS = [
  {
    q: "Isn't this just another note-taking app?",
    a: 'No. Note apps give you a blank page. exomemri captures your sources automatically, understands them, and tracks what you actually know. You can still add your own notes on each capture — but the product works like memory, not a notebook.',
    open: true,
  },
  {
    q: 'How is it different from NotebookLM or Recall?',
    a: 'Those tools store and let you chat with your sources. exomemri adds a model of your understanding: a knowledge map of how concepts connect, coverage and gaps, and "you already know 70% of this" context while you browse — built around learning over months, not single documents.',
  },
  {
    q: 'Do I have to copy-paste anything?',
    a: "Never. Capture is one click, right where you're already learning — in your browser.",
  },
  {
    q: 'What can I save?',
    a: 'YouTube videos, web articles, AI conversations, PDFs, and your own notes and highlights — all into one topic.',
  },
];
