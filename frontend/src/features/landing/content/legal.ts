export type LegalSection = {
  heading: string
  paragraphs: Array<string>
}

export type LegalDocument = {
  title: string
  lastUpdated: string
  intro: string
  sections: Array<LegalSection>
}

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: 'July 24, 2026',
  intro:
    'This Privacy Policy explains how Sohizi Lab (“Sohizi,” “we,” “us,” or “our”) collects, uses, and shares information when you use our website and AI video workspace. This is a starter policy for product clarity and is not a substitute for legal advice.',
  sections: [
    {
      heading: 'Information we collect',
      paragraphs: [
        'Account information: when you create an account we collect details such as your name, email address, and authentication data from our sign-in providers.',
        'Project and content data: scripts, prompts, storyboards, media you upload or generate, timeline edits, and related project metadata needed to run the workspace.',
        'Usage and technical data: product interactions, feature usage, device and browser information, IP address, approximate location derived from IP, and diagnostic logs that help us operate and improve the service.',
        'Billing data: subscription plan, credit balances, and payment-related records processed by our payment providers. We do not store full payment card numbers on our servers.',
      ],
    },
    {
      heading: 'How we use information',
      paragraphs: [
        'We use your information to provide and maintain the Sohizi Lab service, including generating media, running the editor, managing credits, and supporting your account.',
        'We also use data to secure the platform, prevent abuse, improve product quality, communicate service updates, and comply with legal obligations.',
      ],
    },
    {
      heading: 'AI processing and third-party providers',
      paragraphs: [
        'To deliver AI features, we send prompts, project context, and related inputs to third-party model and media providers under contract with us. Those providers process data only to fulfill the requested generation or analysis and are not permitted to use your content to train their public models where our agreements disallow it.',
        'You should not submit sensitive personal information or confidential third-party data unless you have a lawful basis and the right to do so.',
      ],
    },
    {
      heading: 'Cookies and similar technologies',
      paragraphs: [
        'We use necessary cookies and similar technologies for authentication, session security, and core product functionality. We may also use analytics tools to understand aggregate product usage and improve the experience.',
        'You can control cookies through your browser settings, but disabling certain cookies may affect sign-in or product features.',
      ],
    },
    {
      heading: 'How we share information',
      paragraphs: [
        'We share information with service providers that help us operate the product (hosting, authentication, payments, analytics, AI/media generation, and customer support) under appropriate confidentiality and data-processing terms.',
        'We may disclose information if required by law, to protect the rights and safety of Sohizi or our users, or in connection with a merger, acquisition, or asset sale, subject to applicable privacy protections.',
        'We do not sell your personal information.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'We retain account, project, and billing records for as long as needed to provide the service and for legitimate business, legal, and security purposes. You may request deletion of your account; some records may be retained where we are legally required to keep them.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Depending on where you live, you may have rights to access, correct, delete, or export personal information, or to object to or restrict certain processing. To exercise these rights, contact us at hello@sohizi.com.',
        'If you are in the EEA, UK, or a similar jurisdiction, you may also have the right to lodge a complaint with your local supervisory authority.',
      ],
    },
    {
      heading: 'International transfers',
      paragraphs: [
        'Sohizi may process and store information in countries other than where you live. When we transfer personal data internationally, we use appropriate safeguards consistent with applicable law.',
      ],
    },
    {
      heading: 'Children',
      paragraphs: [
        'Sohizi Lab is not directed to children under 16, and we do not knowingly collect personal information from children under 16. If you believe a child has provided us information, contact us and we will take appropriate steps to delete it.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update this Privacy Policy from time to time. We will post the updated version with a revised “Last updated” date. Material changes may be communicated through the product or by email when appropriate.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions about this Privacy Policy or your data can be sent to hello@sohizi.com.',
      ],
    },
  ],
}

export const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: 'July 24, 2026',
  intro:
    'These Terms of Service (“Terms”) govern your access to and use of Sohizi Lab. By creating an account or using the service, you agree to these Terms. This is starter product language and is not a substitute for legal advice.',
  sections: [
    {
      heading: 'The service',
      paragraphs: [
        'Sohizi Lab is an AI-assisted workspace for writing scripts, generating media, storyboarding, and editing video. Features may change over time as we improve the product.',
        'We may offer free credit, paid subscriptions, and top-up credit packs. Availability of models, tools, and capacity can vary.',
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'You must provide accurate account information and keep your credentials secure. You are responsible for activity under your account.',
        'You must be at least 16 years old, or the age of digital consent in your jurisdiction, to use the service.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You agree not to misuse Sohizi Lab. Prohibited uses include attempting to disrupt or reverse engineer the service, bypassing usage limits or security controls, generating illegal or harmful content, infringing others’ intellectual property or privacy rights, or using the service to spam, scam, or harass.',
        'We may suspend or terminate access if we reasonably believe these Terms have been violated.',
      ],
    },
    {
      heading: 'Credits and billing',
      paragraphs: [
        'Paid plans include a monthly allotment of credits that power generation and related AI usage. Included subscription credits typically expire at the end of each billing period and do not roll over unless we expressly say otherwise.',
        'Top-up credits, if offered, may follow different expiration rules as described at purchase. Credit burn rates can vary by model and modality and may change as provider costs change.',
        'Fees are charged in advance for subscriptions unless otherwise stated. Taxes may apply. Except where required by law, payments are non-refundable once credits or plan time have been consumed, though we may refund credits for technical failures at our discretion.',
      ],
    },
    {
      heading: 'Your content and ownership',
      paragraphs: [
        'You retain ownership of the content you create and upload to Sohizi Lab, including scripts, assets, and final edits, subject to the rights of third parties and applicable law.',
        'You grant Sohizi a limited license to host, process, transmit, and display your content solely as needed to operate and improve the service you use.',
        'You are responsible for ensuring you have the rights to the materials you upload and the prompts you submit.',
      ],
    },
    {
      heading: 'AI outputs',
      paragraphs: [
        'AI-generated text, images, video, voice, music, and related outputs may be inaccurate, incomplete, or similar to content generated for others. You are responsible for reviewing outputs before publishing or commercially relying on them.',
        'To the extent permitted by law, and subject to the rights of model providers and third parties, we assign to you any rights we have in the outputs generated for you from your prompts in the course of using the service.',
      ],
    },
    {
      heading: 'Intellectual property',
      paragraphs: [
        'Sohizi Lab, including its software, branding, UI, and documentation, is owned by Sohizi and its licensors. These Terms do not grant you rights to our trademarks or underlying platform code beyond the limited right to use the service.',
      ],
    },
    {
      heading: 'Third-party services',
      paragraphs: [
        'The service relies on third-party providers for hosting, authentication, payments, and AI/media generation. Your use of those providers through Sohizi may be subject to their terms. We are not responsible for third-party outages beyond our reasonable control.',
      ],
    },
    {
      heading: 'Disclaimer of warranties',
      paragraphs: [
        'The service is provided “as is” and “as available.” To the maximum extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee uninterrupted or error-free operation, or that outputs will meet your requirements.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'To the maximum extent permitted by law, Sohizi and its affiliates will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost revenue, or lost data, arising from your use of the service.',
        'Our aggregate liability for claims relating to the service will not exceed the amounts you paid us for the service in the twelve (12) months before the claim, or one hundred US dollars (US $100) if you have not paid us.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You may stop using Sohizi Lab at any time. We may suspend or terminate access if you breach these Terms, if required for security or legal reasons, or if we discontinue the service.',
        'Upon termination, your right to access the service ends. Provisions that by their nature should survive (including ownership, disclaimers, and limitations of liability) will survive.',
      ],
    },
    {
      heading: 'Changes to the Terms',
      paragraphs: [
        'We may update these Terms from time to time. Continued use of the service after changes become effective constitutes acceptance of the updated Terms. If you do not agree, you should stop using the service.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Questions about these Terms can be sent to hello@sohizi.com.',
      ],
    },
  ],
}
