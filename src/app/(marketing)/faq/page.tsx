import type { Metadata } from 'next'
import Link from 'next/link'
import { brand } from '@/config/brand'
import { formatMoneyCompact, membership } from '@/config/pricing'

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: `How ${brand.name} works, what it costs, and how we handle your information.`,
}

const SECTIONS = [
  {
    title: 'The basics',
    questions: [
      {
        q: `What is ${brand.name}?`,
        a: 'A travel discovery service that starts by understanding how you like to travel, then matches you to trips — and to other travellers — that actually fit. We do not sell travel; we help you find it.',
      },
      {
        q: 'Do you book my trip?',
        a: 'No. When you find something you want, we send you to the travel provider. They take the booking, set the price and handle the terms. Your contract is with them.',
      },
      {
        q: 'Where do the deals come from?',
        a: 'From travel providers — tour operators, vacation package companies, cruise lines, agencies and flash-sale sites. We normalise their very different listings into one consistent format so you can genuinely compare them.',
      },
      {
        q: 'Which countries can I travel from?',
        a: 'We have launched in Canada, focused on the major gateways: Toronto, Vancouver, Calgary, Edmonton, Winnipeg, Ottawa, Montréal, Halifax and St. John’s. Nothing in the product is hardcoded to Canada — other origin markets are a data change, not a rebuild.',
      },
    ],
  },
  {
    title: 'Matching',
    questions: [
      {
        q: 'How does the match score work?',
        a: 'Your quiz answers become a preference profile. Each trip is scored against it across nine weighted components — interests, activities, social style, accommodation, travel style, budget, departure airport, dates and trip length. Hard limits like your maximum budget remove options entirely; everything else changes the order. Every score comes with the specific reasons that produced it.',
      },
      {
        q: 'Is it AI?',
        a: 'The matching is not. It is a deterministic calculation you could do on paper, which is why we can always show our working. We use AI in a narrow way — to summarise providers’ listings and write your travel personality description — and it is never allowed to invent a fact about a trip.',
      },
      {
        q: 'What if I say I hate something?',
        a: 'It genuinely counts against a trip. Rating partying 1 does not just stop us recommending party trips — it actively pushes trips built around partying down your list. That is the difference between a preference and an absence of one.',
      },
      {
        q: 'Is the travel personality a psychological test?',
        a: 'No, and we would never present it as one. It describes how you like to travel, from answers you gave us, and nothing else. We never infer anything about who you are.',
      },
    ],
  },
  {
    title: 'Deals and pricing',
    questions: [
      {
        q: 'How current are the prices?',
        a: 'Every trip shows when we last checked it. Travel inventory moves fast, so we tell you how fresh our information is rather than implying it is live. The final price always comes from the provider.',
      },
      {
        q: 'Are the discounts real?',
        a: 'We only count a discount as verified when we have independently observed the higher price ourselves. Otherwise we say it is a price stated by the provider. We never manufacture a saving.',
      },
      {
        q: 'What does "Not specified" mean?',
        a: 'That the provider did not tell us. We would rather show a gap than guess and be wrong about something that matters, like whether flights are included.',
      },
    ],
  },
  {
    title: 'People and safety',
    questions: [
      {
        q: 'Do I have to use the social side?',
        a: 'Not at all. Trip recommendations work perfectly with zero connections. The social features are there when you want them.',
      },
      {
        q: 'How do you match people?',
        a: 'On travel characteristics only: pace, budget, trip length, interests, social style and when you can travel. We never infer anything about your gender, sexuality, ethnicity, religion, health or anything else, and we never use your photo for anything but showing it.',
      },
      {
        q: 'Is it safe?',
        a: 'It is 18+ only. Blocking and reporting are on every profile and every message, blocking is mutual and silent, profiles are private by default, and your upcoming travel is never public unless you choose. Reports go to a human moderator. We do not verify anyone’s identity, and we never claim to.',
      },
      {
        q: 'Who can see my profile?',
        a: 'Whatever you decide, field by field, in Settings → Privacy. The default is your connections only.',
      },
    ],
  },
  {
    title: 'Membership',
    questions: [
      {
        q: 'What does it cost?',
        a: `${formatMoneyCompact(membership.priceCents)} a year. The quiz and your travel personality are free, permanently.`,
      },
      {
        q: 'Can I cancel?',
        a: 'Yes, any time, from your settings, with no notice period. You keep access until the end of the period you have paid for.',
      },
      {
        q: 'How do you make money?',
        a: 'Mainly the membership. Some providers also pay a commission when you book after clicking through, which costs you nothing extra and never affects your match score. Any sponsored placement is always labelled.',
      },
    ],
  },
  {
    title: 'Your information',
    questions: [
      {
        q: 'Can I get my data?',
        a: 'Yes — Settings → Account → Download my data gives you everything we hold about you as a file.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes, permanently, from Settings → Account. Your profile, preferences, saved trips and connections are removed. Messages you sent stay in other people’s conversations but are redacted and no longer attributed to you.',
      },
      {
        q: 'Do you sell my information?',
        a: 'No.',
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="container-prose py-16 sm:py-24">
      <h1 className="text-display-lg text-balance">Questions</h1>
      <p className="mt-3 text-lg text-ink-600 text-pretty">
        If something is not answered here, write to us at {brand.supportEmail}.
      </p>

      <div className="mt-12 space-y-12">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <dl className="mt-4 divide-y divide-ink-200 border-t border-ink-200">
              {section.questions.map((item) => (
                <div key={item.q} className="py-5">
                  <dt className="font-semibold text-ink-900">{item.q}</dt>
                  <dd className="mt-2 leading-relaxed text-ink-600 text-pretty">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-14 text-sm text-ink-600">
        See also the{' '}
        <Link href="/legal/privacy" className="font-medium text-terracotta-600 underline underline-offset-4">
          privacy policy
        </Link>
        ,{' '}
        <Link href="/legal/terms" className="font-medium text-terracotta-600 underline underline-offset-4">
          terms of service
        </Link>{' '}
        and{' '}
        <Link href="/legal/community" className="font-medium text-terracotta-600 underline underline-offset-4">
          community guidelines
        </Link>
        .
      </p>
    </div>
  )
}
