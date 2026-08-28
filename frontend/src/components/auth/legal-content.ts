/** Readable legal copy shown in the signup Terms / Privacy modals. */

export type LegalDocKind = 'terms' | 'privacy'

export interface LegalSection {
  heading: string
  paragraphs: string[]
}

export interface LegalDocument {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  updated: 'August 28, 2026',
  intro:
    'These Terms of Service (“Terms”) govern your access to and use of exomemri, including our website, dashboard, and browser extension (together, the “Service”). By creating an account or using the Service, you agree to these Terms.',
  sections: [
    {
      heading: '1. The Service',
      paragraphs: [
        'exomemri helps you capture, organize, and recall what you learn online. Features may include Learning Spaces, source capture via the browser extension, summaries, notes, knowledge maps, and related tools. We may improve, change, or discontinue parts of the Service over time.',
      ],
    },
    {
      heading: '2. Accounts',
      paragraphs: [
        'You must provide accurate account information and keep your credentials secure. You are responsible for activity under your account. Notify us promptly if you suspect unauthorized access.',
        'You must be old enough to form a binding contract in your jurisdiction (and at least 13 years old, or the applicable digital-consent age where you live).',
      ],
    },
    {
      heading: '3. Acceptable use',
      paragraphs: [
        'You agree not to misuse the Service — including attempting to break security, scrape or overload our systems, infringe others’ rights, upload unlawful content, or use the Service to harass or harm others.',
        'Content you capture or create remains yours. You grant us a limited license to host, process, and display that content solely to operate and improve the Service for you.',
      ],
    },
    {
      heading: '4. Credits and plans',
      paragraphs: [
        'Some features may consume credits or be limited by plan. Allowance amounts, reset timing, and pricing may change; we will reflect current limits in the product. Paid plans, if offered, are subject to the pricing and billing terms shown at purchase.',
      ],
    },
    {
      heading: '5. Intellectual property',
      paragraphs: [
        'exomemri, our branding, and the Service software are owned by us or our licensors. These Terms do not grant you ownership of the Service — only a limited right to use it as allowed here.',
      ],
    },
    {
      heading: '6. Disclaimers',
      paragraphs: [
        'The Service is provided “as is.” AI-generated summaries and answers can be incomplete or incorrect — always verify important information against your original sources. To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement.',
      ],
    },
    {
      heading: '7. Limitation of liability',
      paragraphs: [
        'To the fullest extent permitted by law, exomemri and its operators will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the Service.',
      ],
    },
    {
      heading: '8. Termination',
      paragraphs: [
        'You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms or if we need to protect the Service or other users. Provisions that by nature should survive (including IP, disclaimers, and liability limits) will survive termination.',
      ],
    },
    {
      heading: '9. Changes',
      paragraphs: [
        'We may update these Terms. Material changes will be reflected by updating the date above and, where appropriate, by notice in the product. Continued use after changes means you accept the updated Terms.',
      ],
    },
    {
      heading: '10. Contact',
      paragraphs: [
        'Questions about these Terms: support@exomemri.com.',
      ],
    },
  ],
}

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  updated: 'August 28, 2026',
  intro:
    'This Privacy Policy explains how exomemri collects, uses, and shares information when you use our website, dashboard, and browser extension (the “Service”).',
  sections: [
    {
      heading: '1. Information we collect',
      paragraphs: [
        'Account information: email address, name and profile details you provide (such as username and learning preferences), and authentication data from our auth provider.',
        'Learning content: sources you choose to capture (for example page text, transcripts, notes, and related metadata), Learning Spaces, and activity needed to provide features like summaries, maps, and chat.',
        'Usage and device data: approximate logs such as feature usage, errors, browser type, and IP address, used for security and reliability.',
      ],
    },
    {
      heading: '2. How we use information',
      paragraphs: [
        'We use your information to provide and improve the Service — including saving captures, generating summaries and answers, maintaining your Learning Spaces, enforcing credit limits, securing accounts, and communicating about the product.',
        'We do not sell your personal information.',
      ],
    },
    {
      heading: '3. AI processing',
      paragraphs: [
        'Some features send relevant portions of your captured content to third-party AI providers solely to generate summaries, answers, or related insights for you. We configure these providers as processors for Service delivery, not for advertising.',
      ],
    },
    {
      heading: '4. Sharing',
      paragraphs: [
        'We share information with service providers who help us run the Service (hosting, authentication, storage, analytics, and AI inference), under obligations to protect it.',
        'We may share information if required by law, to protect rights and safety, or in connection with a merger or sale of assets — with notice where required.',
        'If you make a profile or share link public, the content you choose to share becomes visible to people with that link.',
      ],
    },
    {
      heading: '5. Retention',
      paragraphs: [
        'We retain account and learning data while your account is active and as needed to provide the Service. You may request deletion of your account; we will delete or anonymize personal data except where we must retain it for legal, security, or operational reasons.',
      ],
    },
    {
      heading: '6. Security',
      paragraphs: [
        'We use industry-standard measures such as encrypted transport and access controls. No method of transmission or storage is perfectly secure; please use a strong unique password and protect your devices.',
      ],
    },
    {
      heading: '7. Your choices',
      paragraphs: [
        'You can update profile information in the app, control public-profile visibility, and stop using the extension at any time. Depending on where you live, you may have rights to access, correct, export, or delete personal data — contact us to exercise them.',
      ],
    },
    {
      heading: '8. Children',
      paragraphs: [
        'The Service is not directed to children under 13 (or the applicable age in your region). We do not knowingly collect personal information from children under that age.',
      ],
    },
    {
      heading: '9. Changes',
      paragraphs: [
        'We may update this Privacy Policy. We will change the date above and, for material updates, provide additional notice in the product when appropriate.',
      ],
    },
    {
      heading: '10. Contact',
      paragraphs: [
        'Privacy questions: support@exomemri.com.',
      ],
    },
  ],
}

export function getLegalDocument(kind: LegalDocKind): LegalDocument {
  return kind === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY
}
