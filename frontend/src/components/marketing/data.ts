export const FULL_ANSWER =
  "Across your sources, caching stores frequently-accessed data closer to where it's used to cut latency. You've covered cache-aside and write-through — but you haven't studied cache invalidation yet.";

export const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Why Atlas', href: '#why' },
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
    body: 'Start with a goal, not a blank page. Create a space like "System Design," and everything you consume flows into it automatically — organized without manual filing.',
  },
  {
    n: 'F3',
    title: 'Instant AI summaries',
    body: 'Every source becomes a crisp summary the moment you save it: key points, core concepts, examples, and interview-ready takeaways. Useful immediately, not a growing to-read pile.',
  },
  {
    n: 'F4',
    title: 'Knowledge that merges itself',
    body: "When three videos and an article all explain load balancers, Atlas combines them into one clear, connected note — with references back to every source. Real understanding, not duplicate clutter.",
  },
  {
    n: 'F5',
    title: 'Ask your memory',
    body: "Chat with everything you've ever saved. Get answers drawn from your own sources, with citations that jump you straight back to where a concept was taught — down to the exact moment in a video.",
  },
  {
    n: 'F6',
    title: 'Know what you know',
    body: "Atlas tracks what you've actually learned versus what you've merely saved. See your coverage on a topic, spot weak areas, and get told exactly what to study next — like a tutor, not a filing cabinet.",
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
    body: 'Atlas instantly summarizes each source, pulls out the key concepts, and merges what you learn across sources into one clean, connected picture.',
  },
  {
    n: 3,
    title: 'Recall',
    body: 'Ask your memory anything, review with quizzes and flashcards built from your own material, and pick up exactly where you left off — any time.',
  },
];

export const AUDIENCE = [
  { icon: '⌘', title: 'Developers', body: "Preparing for technical interviews who can't afford to forget what they studied." },
  { icon: '✎', title: 'Students', body: 'Juggling courses, videos, and articles across dozens of topics.' },
  { icon: '✦', title: 'Self-learners', body: 'Who use AI chats as a temporary brain and want a permanent one.' },
  { icon: '↗', title: 'Career switchers', body: 'Teaching themselves new fields from scattered online sources.' },
];

export const FAQS = [
  {
    q: "Isn't this just another note-taking app?",
    a: 'No. Note apps give you a blank page. Atlas captures your sources automatically, understands them, and tracks what you actually know — so it works like memory, not a notebook.',
    open: true,
  },
  {
    q: 'How is it different from NotebookLM or Recall?',
    a: 'Those tools store and let you chat with your sources. Atlas adds a model of your understanding: coverage, gaps, and "you already know 70% of this" context while you browse — built around learning over months, not single documents.',
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
