/**
 * LEGAL PLACEHOLDERS
 *
 * ⚠️  NONE OF THIS IS LEGAL ADVICE, AND NONE OF IT HAS BEEN REVIEWED BY A
 *     LAWYER. It is a structured starting point written so that a Canadian
 *     lawyer can review and correct it quickly, rather than starting from a
 *     blank page. Every document must be professionally reviewed before the
 *     product is opened to the public.
 *
 * The Canadian issues that specifically need professional review are listed
 * against each document below, and collected in SECURITY.md.
 */

export interface LegalDocument {
  slug: string
  title: string
  summary: string
  lastUpdated: string
  reviewNeeded: string[]
  sections: { heading: string; body: string[] }[]
}

export const REVIEW_BANNER =
  'This document is an unreviewed placeholder. It must be replaced with professionally drafted terms before launch.'

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    summary: 'The agreement between you and Voyaj.',
    lastUpdated: '2026-01-01',
    reviewNeeded: [
      'Consumer protection legislation in each province, particularly Ontario and Quebec',
      'Quebec French-language requirements (Charter of the French Language) for consumer contracts',
      'Limitation of liability clauses, which are constrained differently in Quebec',
      'Whether Voyaj requires registration under provincial travel industry legislation (for example TICO in Ontario, or the BC Travel Regulation) given that it refers rather than sells travel',
    ],
    sections: [
      {
        heading: 'What Voyaj is',
        body: [
          'Voyaj is a travel discovery and social matching service. We help you find travel offers and other travellers. We do not sell travel, we do not act as a travel agent, and we do not take bookings.',
          'Every booking is made directly with the travel provider, on their website, under their terms. The price, availability, inclusions and cancellation terms are set by them, not by us.',
        ],
      },
      {
        heading: 'Eligibility',
        body: [
          'You must be at least 18 years old to use Voyaj. The social features of this service are for adults.',
          'You must provide accurate information about yourself and keep your account secure.',
        ],
      },
      {
        heading: 'Accuracy of travel information',
        body: [
          'We collect travel offers from many providers and present them in a consistent format. We show when we last checked each offer. Travel inventory changes quickly and information may be out of date or incomplete.',
          'We do not guarantee that any price, date or inclusion shown on Voyaj is currently available. Always confirm with the provider before booking.',
        ],
      },
      {
        heading: 'Your conduct',
        body: [
          'You agree not to harass, abuse, defraud or impersonate anyone, not to use Voyaj to send spam or solicit money, and not to scrape or republish our content.',
          'We may suspend or remove accounts that breach these terms or our community guidelines.',
        ],
      },
      {
        heading: 'Meeting other people',
        body: [
          'Voyaj lets you connect with people you do not know. We do not verify anyone’s identity unless we explicitly say a profile is verified. You are responsible for your own safety, and we strongly recommend meeting in public and telling someone where you are going.',
        ],
      },
      {
        heading: 'Membership and payment',
        body: [
          'Membership is billed annually in advance. Payment is processed by Stripe; we never see or store your card details.',
          'See the Subscription Terms and Cancellation Policy for details.',
        ],
      },
      {
        heading: 'Limitation of liability',
        body: [
          'PLACEHOLDER — requires professional drafting. Liability limits are treated differently across Canadian provinces, and some limits are unenforceable in Quebec.',
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'What we collect, why, and what you can do about it.',
    lastUpdated: '2026-01-01',
    reviewNeeded: [
      'PIPEDA compliance, including consent, access and correction rights',
      'Quebec Law 25 — privacy officer, privacy impact assessments, consent for profiling, and data portability',
      'Whether our recommendation engine constitutes automated decision-making requiring disclosure under Quebec Law 25',
      'Cross-border data transfer disclosure if hosting or AI processing happens outside Canada',
      'Breach notification obligations and record-keeping',
    ],
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Account information: your email address, first name, and a password stored only as a cryptographic hash.',
          'Travel preferences: the answers you give in the travel quiz, your budget, dates, trip length and departure airports.',
          'Profile information you choose to add: a photo, a bio, your home city, an age range, and a wishlist.',
          'Activity: which trips you view, save, share and click through to, so we can improve your recommendations.',
          'Technical information: a hashed version of your IP address and your browser type, used for security and abuse prevention.',
        ],
      },
      {
        heading: 'What we never do',
        body: [
          'We never infer your gender, sexual orientation, ethnicity, religion, health, disability or any other sensitive characteristic — not from your name, your photo, or your behaviour.',
          'We never use your profile photo for anything except displaying it as your avatar.',
          'We never sell your personal information.',
          'Any community space relating to a personal characteristic is something you opt into yourself, and it is never shown on your public profile.',
        ],
      },
      {
        heading: 'How we use it',
        body: [
          'To match you with travel offers and other travellers, using the deterministic scoring described in our documentation.',
          'To operate your account, take payment, and provide support.',
          'To detect and prevent abuse.',
          'To understand which parts of the product are used, in aggregate.',
        ],
      },
      {
        heading: 'Automated recommendations',
        body: [
          'Your trip and traveller recommendations are produced by an algorithm that scores your stated preferences against each trip. It is not a machine-learning model trained on other people, and it does not make any decision that has a legal or similarly significant effect on you.',
          'Every match score on Voyaj is shown with the specific reasons that produced it.',
        ],
      },
      {
        heading: 'Artificial intelligence',
        body: [
          'We use AI in a limited way: to summarise providers’ own listings, to classify trips, and to write your travel personality description. AI is never used to decide what you are recommended.',
          'AI is explicitly prevented from inventing facts about a travel offer. Where information is missing we show “Not specified”.',
          'If we send content to a third-party AI provider, that provider is named here. [PLACEHOLDER — complete before launch.]',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can access everything we hold about you by downloading your data from Settings → Account.',
          'You can correct your information at any time in Settings.',
          'You can delete your account permanently from Settings → Account. Your personal information is removed; messages you sent remain in other people’s conversations but are redacted.',
          'You can withdraw consent for analytics and personalisation in Settings → Privacy.',
        ],
      },
      {
        heading: 'Contact',
        body: ['Privacy questions go to our privacy officer. [PLACEHOLDER — appoint and name before launch.]'],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    summary: 'The small number of cookies we use.',
    lastUpdated: '2026-01-01',
    reviewNeeded: ['Consent requirements for analytics under Quebec Law 25'],
    sections: [
      {
        heading: 'Essential cookies',
        body: [
          'We set one cookie, voyaj_session, which keeps you signed in. It contains a random token and nothing else — no personal information is stored in it. It is httpOnly, so scripts cannot read it, and it is marked Secure in production.',
          'This cookie is strictly necessary for the service to work and cannot be turned off.',
        ],
      },
      {
        heading: 'Analytics',
        body: [
          'Product analytics are recorded in our own database against your account, not through a third-party cookie. You can turn this off in Settings → Privacy.',
        ],
      },
      { heading: 'Advertising', body: ['We do not use advertising cookies and we do not run third-party ad trackers.'] },
    ],
  },
  {
    slug: 'community',
    title: 'Community Guidelines',
    summary: 'How to behave on Voyaj.',
    lastUpdated: '2026-01-01',
    reviewNeeded: ['Alignment with the Terms of Service and with moderation practice'],
    sections: [
      { heading: 'The short version', body: ['Be the kind of person other people would actually want to travel with.'] },
      {
        heading: 'What we expect',
        body: [
          'Be honest about who you are and how you travel.',
          'Respect a no. If someone does not reply or declines a connection, leave it there.',
          'Keep conversations on Voyaj until you genuinely trust someone.',
          'Meet in public the first time, and tell someone where you are going.',
        ],
      },
      {
        heading: 'What gets you removed',
        body: [
          'Harassment, threats, hate speech or discrimination of any kind.',
          'Sexual content, or sexual advances towards someone who has not invited them.',
          'Asking other members for money, or any kind of financial solicitation.',
          'Impersonating someone else, or creating a fake profile.',
          'Commercial spam.',
          'Any attempt to use Voyaj to contact or meet a minor.',
        ],
      },
      {
        heading: 'Reporting',
        body: [
          'Every profile and every message can be reported. Reports go to a human moderator. You can also block anyone instantly — blocking is mutual and the other person is never told.',
        ],
      },
    ],
  },
  {
    slug: 'affiliate',
    title: 'Affiliate Disclosure',
    summary: 'How Voyaj makes money.',
    lastUpdated: '2026-01-01',
    reviewNeeded: [
      'Competition Bureau guidance on disclosure of material connections',
      'Whether disclosure placement is sufficiently prominent',
    ],
    sections: [
      { heading: 'Membership', body: ['Our main source of revenue is the annual membership fee. That is what pays for the product.'] },
      {
        heading: 'Affiliate commissions',
        body: [
          'When you click through to some travel providers and go on to book, Voyaj may receive a commission from that provider. It costs you nothing extra.',
          'We do not receive a commission from every provider, and several providers in our marketplace have no affiliate arrangement at all.',
        ],
      },
      {
        heading: 'What commission does NOT affect',
        body: [
          'Your match score. Personality matching is a deterministic calculation from your preferences and a trip’s attributes. Commission is not an input to it, and it never will be.',
          'Our deal value rating, which is calculated from inclusions, price per night and verified discounts.',
          'Any sponsored placement will always be labelled “Sponsored” wherever it appears.',
        ],
      },
    ],
  },
  {
    slug: 'subscription',
    title: 'Subscription Terms',
    summary: 'What you are paying for, and how billing works.',
    lastUpdated: '2026-01-01',
    reviewNeeded: [
      'Provincial rules on automatically renewing consumer contracts, especially Ontario and Quebec',
      'Required pre-renewal notice periods',
      'Refund and cooling-off obligations',
    ],
    sections: [
      {
        heading: 'What membership includes',
        body: [
          'Access to the full marketplace of travel offers, ranked for you, with the full reasoning behind every match.',
          'Saving, sharing and tracking trips.',
          'Traveller matching, connections, circles, group trips and messaging.',
        ],
      },
      {
        heading: 'Price and billing',
        body: [
          'Membership is billed annually in advance in Canadian dollars. The current price is shown at checkout before you pay.',
          'Payment is processed by Stripe. Voyaj never sees or stores your card number.',
          'Your membership renews automatically each year unless you cancel.',
        ],
      },
      {
        heading: 'Failed payments',
        body: [
          'If a payment fails we will tell you and retry. Your access continues during the retry period. If payment cannot be taken, membership ends and your account reverts to a free account — your travel personality and preferences are kept.',
        ],
      },
      {
        heading: 'Price changes',
        body: ['We will give you notice before any price change takes effect. [PLACEHOLDER — notice period to be set on legal advice.]'],
      },
    ],
  },
  {
    slug: 'cancellation',
    title: 'Cancellation Policy',
    summary: 'How to cancel, and what happens when you do.',
    lastUpdated: '2026-01-01',
    reviewNeeded: ['Provincial cooling-off periods and refund entitlements for consumer subscriptions'],
    sections: [
      {
        heading: 'Cancelling your membership',
        body: [
          'Cancel any time from Settings → Membership. There is no notice period and you do not have to contact anyone.',
          'You keep full access until the end of the period you have already paid for.',
        ],
      },
      {
        heading: 'Refunds',
        body: ['PLACEHOLDER — refund policy to be set on legal advice, taking provincial cooling-off periods into account.'],
      },
      {
        heading: 'Cancelling a trip',
        body: [
          'Voyaj does not book travel, so we cannot cancel a trip for you. Cancellations and refunds for any trip are handled entirely by the travel provider you booked with, under their own terms.',
        ],
      },
    ],
  },
  {
    slug: 'deal-disclaimer',
    title: 'Travel Deal Disclaimer',
    summary: 'The limits of the travel information we show.',
    lastUpdated: '2026-01-01',
    reviewNeeded: [
      'Competition Bureau rules on advertised pricing, including drip pricing and was/now price claims',
      'Substantiation requirements for any discount or savings claim',
    ],
    sections: [
      {
        heading: 'We are not the seller',
        body: [
          'Voyaj is a discovery service. Every trip shown is sold and operated by the travel provider named on the listing. Your contract is with them.',
        ],
      },
      {
        heading: 'Prices and availability change',
        body: [
          'We show when we last checked each offer. Between that moment and your booking, the price or availability may change. Final pricing always comes from the provider.',
        ],
      },
      {
        heading: 'Discounts',
        body: [
          'Where a listing shows a saving, we say whether that original price is one we have independently observed or one stated by the provider. We do not treat an unverified “was” price as a confirmed saving.',
        ],
      },
      {
        heading: 'Incomplete information',
        body: [
          'Where a provider has not told us something, we show “Not specified” rather than guessing. Check the provider’s own page before booking.',
        ],
      },
      {
        heading: 'Demonstration content',
        body: [
          'Any listing labelled “Demonstration listing” is sample content created for development and product demonstrations. It is not a real offer and cannot be booked.',
        ],
      },
    ],
  },
]

export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.slug === slug)
}
