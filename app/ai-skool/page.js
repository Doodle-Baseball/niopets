import './ai-skool.css';

export const metadata = {
  title: 'AI Mastery Community | Learn AI, Build Faster, Grow Together',
  description:
    'Join AI Mastery Community on Skool — live workshops, a private network of builders, and step-by-step paths to ship real AI projects.',
};

const SKOOL_URL = 'https://www.skool.com/ai-mastery-community';

const stats = [
  { value: '2,400+', label: 'Members' },
  { value: '120+', label: 'Lessons & workshops' },
  { value: '4.9/5', label: 'Average rating' },
  { value: '30+', label: 'Countries represented' },
];

const features = [
  {
    title: 'Live weekly workshops',
    desc: 'Hands-on sessions building real AI products, tools, and automations — recorded if you miss one.',
    icon: '🎥',
  },
  {
    title: 'Structured learning paths',
    desc: 'Go from "curious beginner" to "shipping AI products" with a clear, ordered curriculum.',
    icon: '🗺️',
  },
  {
    title: 'Private member network',
    desc: 'Ask questions, share wins, and get feedback from builders who are further along than you.',
    icon: '🤝',
  },
  {
    title: 'Project templates & prompts',
    desc: 'Skip the blank-page problem with ready-to-use templates, prompt packs, and starter code.',
    icon: '🧰',
  },
  {
    title: 'Accountability & challenges',
    desc: 'Monthly build challenges and leaderboards to keep you actually shipping, not just watching.',
    icon: '🏆',
  },
  {
    title: 'Direct access to the owner',
    desc: 'Office hours and Q&A sessions where you can ask about your specific project or roadblock.',
    icon: '💬',
  },
];

const testimonials = [
  {
    quote:
      "I went from never touching an API to shipping my first AI-powered app in six weeks. The community pushed me way more than any course I've bought.",
    name: 'Amara O.',
    role: 'Indie hacker',
  },
  {
    quote:
      'The weekly workshops alone are worth it. Real builds, real questions answered live, no fluff.',
    name: 'Devon K.',
    role: 'Product designer',
  },
  {
    quote:
      "Best community I've joined for AI. It's small enough to get real feedback, big enough to always have someone active.",
    name: 'Priya S.',
    role: 'Freelance developer',
  },
];

const faqs = [
  {
    q: 'Do I need coding experience to join?',
    a: 'No. We have members ranging from complete beginners to professional engineers. Learning paths are structured so you can start wherever you are.',
  },
  {
    q: 'What platform does the community run on?',
    a: 'Everything happens inside Skool — one place for discussions, courses, calendar, and challenges. No juggling five different apps.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes, new members can preview the community and public discussions before upgrading to full access.',
  },
  {
    q: 'How much time do I need each week?',
    a: 'Most members get real value from 2-4 hours a week: one workshop plus a bit of practice. You can go faster or slower — it is entirely self-paced outside of live calls.',
  },
];

function CTAButton({ children, className = '' }) {
  return (
    <a
      href={SKOOL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`cta-button ${className}`}
    >
      {children}
    </a>
  );
}

export default function AiSkoolPage() {
  return (
    <div className="skool-page">
      <header className="nav">
        <div className="nav-inner">
          <div className="brand">
            <span className="brand-mark">AI</span>
            <span className="brand-name">Mastery Community</span>
          </div>
          <CTAButton className="nav-cta">Join on Skool</CTAButton>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-inner">
            <p className="eyebrow">A community for people who build with AI</p>
            <h1>
              Learn AI. Build faster.
              <br />
              Grow with people who get it.
            </h1>
            <p className="hero-sub">
              Join a private community of founders, developers, and creators
              using AI to ship real projects — with live workshops, guided
              paths, and an owner who actually shows up.
            </p>
            <div className="hero-actions">
              <CTAButton>Join the Community →</CTAButton>
              <a href="#features" className="secondary-link">
                See what's inside
              </a>
            </div>
          </div>
        </section>

        <section className="stats">
          <div className="stats-inner">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="features" id="features">
          <div className="section-inner">
            <p className="eyebrow center">What you get</p>
            <h2 className="center">Everything you need to actually ship</h2>
            <div className="feature-grid">
              {features.map((f) => (
                <div className="feature-card" key={f.title}>
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="testimonials">
          <div className="section-inner">
            <p className="eyebrow center">Member stories</p>
            <h2 className="center">Real people, real progress</h2>
            <div className="testimonial-grid">
              {testimonials.map((t) => (
                <blockquote className="testimonial-card" key={t.name}>
                  <p>&ldquo;{t.quote}&rdquo;</p>
                  <footer>
                    <span className="testimonial-name">{t.name}</span>
                    <span className="testimonial-role">{t.role}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        <section className="pricing">
          <div className="section-inner narrow">
            <p className="eyebrow center">Membership</p>
            <h2 className="center">Simple, one-tier access</h2>
            <div className="pricing-card">
              <h3>Full Community Access</h3>
              <ul className="pricing-list">
                <li>Live weekly workshops + recordings</li>
                <li>All learning paths and project templates</li>
                <li>Private member network &amp; direct owner access</li>
                <li>Monthly build challenges</li>
              </ul>
              <CTAButton className="pricing-cta">Join on Skool</CTAButton>
              <p className="pricing-note">Cancel anytime, right from Skool.</p>
            </div>
          </div>
        </section>

        <section className="faq">
          <div className="section-inner narrow">
            <p className="eyebrow center">FAQ</p>
            <h2 className="center">Good questions</h2>
            <div className="faq-list">
              {faqs.map((f) => (
                <details className="faq-item" key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="section-inner narrow center">
            <h2>Ready to build with people who push you forward?</h2>
            <p>Join AI Mastery Community on Skool today.</p>
            <CTAButton>Join the Community →</CTAButton>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} AI Mastery Community. All rights reserved.</p>
      </footer>
    </div>
  );
}
