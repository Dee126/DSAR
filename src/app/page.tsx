import Link from "next/link";

/* ─── Icon Components ────────────────────────────────────────────────────── */

function ShieldIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ClockIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function UsersIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function SearchIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function DocumentIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function LockIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function PlayIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/* ─── Main Landing Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Nav />

      {/* Hero */}
      <HeroSection />

      {/* Why PrivacyPilot */}
      <WhySection />

      {/* Features */}
      <FeaturesSection />

      {/* How it Works */}
      <HowItWorksSection />

      {/* Interactive Demo CTA */}
      <DemoSection />

      {/* Pricing */}
      <PricingSection />

      {/* Compliance */}
      <ComplianceSection />

      {/* CTA */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

/* ─── Navigation ─────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <ShieldIcon className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">PrivacyPilot</span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#why" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Why PrivacyPilot</a>
          <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─── Hero Section ───────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-brand-950 to-gray-900">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left - Text */}
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              GDPR Compliance{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Made Simple
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-300">
              Automate your Data Subject Access Requests with AI-powered workflows.
              Stay compliant, save time, and reduce risk.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-500 transition-colors"
              >
                Start Free Trial
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-600 px-6 py-3 text-sm font-semibold text-white hover:border-gray-400 transition-colors"
              >
                <PlayIcon className="h-4 w-4" />
                Start Interactive Demo
              </Link>
            </div>
            <div className="mt-12">
              <p className="text-sm text-gray-400">Trusted by 500+ companies worldwide</p>
              <div className="mt-4 flex flex-wrap items-center gap-8">
                {["TechCorp", "DataFlow", "SecureNet", "CloudBase", "PrivacyFirst"].map((name) => (
                  <span key={name} className="text-sm font-semibold text-gray-500">{name}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Dashboard Preview */}
          <div className="relative">
            <div className="rounded-xl border border-gray-700/50 bg-gray-800/80 p-4 shadow-2xl backdrop-blur">
              {/* Mini Dashboard Header */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-400">PrivacyPilot Dashboard</span>
              </div>

              {/* Stats Row */}
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-700/50 p-3">
                  <p className="text-xs text-gray-400">Active Cases</p>
                  <p className="text-xl font-bold text-white">24</p>
                  <p className="text-xs text-green-400">+12% this month</p>
                </div>
                <div className="rounded-lg bg-gray-700/50 p-3">
                  <p className="text-xs text-gray-400">Avg. Response</p>
                  <p className="text-xl font-bold text-white">4.2d</p>
                  <p className="text-xs text-green-400">Under SLA</p>
                </div>
                <div className="rounded-lg bg-gray-700/50 p-3">
                  <p className="text-xs text-gray-400">Compliance</p>
                  <p className="text-xl font-bold text-white">99.8%</p>
                  <p className="text-xs text-green-400">On track</p>
                </div>
              </div>

              {/* Mini Table */}
              <div className="rounded-lg bg-gray-700/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300">Recent Cases</span>
                  <span className="text-xs text-brand-400">View all</span>
                </div>
                <div className="space-y-2">
                  {[
                    { id: "DSAR-001", type: "Access", status: "In Progress", statusColor: "bg-blue-400" },
                    { id: "DSAR-002", type: "Erasure", status: "Review", statusColor: "bg-yellow-400" },
                    { id: "DSAR-003", type: "Portability", status: "Complete", statusColor: "bg-green-400" },
                  ].map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded bg-gray-700/40 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-300">{row.id}</span>
                        <span className="text-xs text-gray-400">{row.type}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${row.statusColor}`} />
                        <span className="text-xs text-gray-300">{row.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Why Section ────────────────────────────────────────────────────────── */

function WhySection() {
  const stats = [
    {
      icon: <ClockIcon className="h-8 w-8 text-brand-600" />,
      stat: "85% Faster",
      description: "Reduce DSAR processing time from weeks to hours with automated workflows",
    },
    {
      icon: <ShieldIcon className="h-8 w-8 text-brand-600" />,
      stat: "100% Compliant",
      description: "Built-in compliance checks ensure you never miss a deadline or requirement",
    },
    {
      icon: <ChartIcon className="h-8 w-8 text-brand-600" />,
      stat: "10x ROI",
      description: "Save thousands in manual processing costs and potential GDPR fines",
    },
  ];

  return (
    <section id="why" className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Why Choose PrivacyPilot?
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Managing DSARs manually is time-consuming, error-prone, and risky.
            PrivacyPilot automates the entire process.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {stats.map((item) => (
            <div
              key={item.stat}
              className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
                {item.icon}
              </div>
              <h3 className="mt-6 text-2xl font-bold text-gray-900">{item.stat}</h3>
              <p className="mt-3 text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features Section ───────────────────────────────────────────────────── */

function FeaturesSection() {
  const features = [
    {
      icon: <ShieldIcon className="h-6 w-6 text-brand-600" />,
      title: "Automated Workflows",
      description: "Smart state machine guides cases through every stage from intake to closure automatically.",
    },
    {
      icon: <UsersIcon className="h-6 w-6 text-brand-600" />,
      title: "Role-Based Access",
      description: "Fine-grained permissions with 6 role levels from Super Admin to Read Only.",
    },
    {
      icon: <SearchIcon className="h-6 w-6 text-brand-600" />,
      title: "Data Discovery",
      description: "Automatically locate personal data across all your connected systems and databases.",
    },
    {
      icon: <ClockIcon className="h-6 w-6 text-brand-600" />,
      title: "SLA Tracking",
      description: "Never miss a deadline with automatic SLA calculation and proactive alerts.",
    },
    {
      icon: <DocumentIcon className="h-6 w-6 text-brand-600" />,
      title: "Document Management",
      description: "Secure upload, storage, and versioning of all case-related documents.",
    },
    {
      icon: <LockIcon className="h-6 w-6 text-brand-600" />,
      title: "Audit Trail",
      description: "Complete audit logging of every action for regulatory compliance and reporting.",
    },
  ];

  return (
    <section id="features" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need for DSAR management
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A complete platform that handles every aspect of Data Subject Access Requests
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50">
                {feature.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ───────────────────────────────────────────────────────── */

function HowItWorksSection() {
  const steps = [
    {
      num: 1,
      title: "Receive Request",
      description: "DSAR requests are automatically captured and logged from any channel",
    },
    {
      num: 2,
      title: "Verify & Triage",
      description: "AI-assisted identity verification and request classification",
    },
    {
      num: 3,
      title: "Collect & Review",
      description: "Automated data discovery across connected systems with legal review",
    },
    {
      num: 4,
      title: "Respond & Close",
      description: "Generate compliant responses and maintain complete audit trail",
    },
  ];

  return (
    <section className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Get started in minutes
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Four simple steps to automate your DSAR management
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.num} className="relative text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white">
                {step.num}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Interactive Demo Section ───────────────────────────────────────────── */

function DemoSection() {
  const scenarios = [
    { name: "Access Request", article: "Art. 15", href: "/demo/access" },
    { name: "Erasure Request", article: "Art. 17", href: "/demo/erasure" },
    { name: "Objection", article: "Art. 21", href: "/demo/objection" },
  ];

  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            See it in action — no sign-up needed
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Walk through a real DSAR workflow with synthetic data.
            Experience every step from intake to export in under 5 minutes.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {scenarios.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center shadow-sm transition-all hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 group-hover:bg-brand-100 transition-colors">
                <PlayIcon className="h-5 w-5 text-brand-600" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{s.name}</h3>
              <p className="mt-1 text-sm text-gray-500">GDPR {s.article}</p>
              <span className="mt-4 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
                Start Demo &rarr;
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <PlayIcon className="h-4 w-4" />
            View All Demo Scenarios
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing Section ────────────────────────────────────────────────────── */

function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      period: "",
      description: "Perfect for small teams getting started",
      features: [
        "Up to 10 DSARs/month",
        "2 team members",
        "Basic workflows",
        "Email support",
      ],
      cta: "Get Started",
      highlighted: false,
    },
    {
      name: "Professional",
      price: "$49",
      period: "/month",
      description: "For growing organizations",
      features: [
        "Unlimited DSARs",
        "10 team members",
        "Advanced workflows",
        "Priority support",
        "API access",
        "Custom integrations",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations with complex needs",
      features: [
        "Everything in Professional",
        "Unlimited team members",
        "Custom workflows",
        "Dedicated support",
        "On-premise option",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Start free and scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-brand-600 bg-white shadow-xl ring-1 ring-brand-600"
                  : "border-gray-200 bg-white shadow-sm"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                {plan.period && <span className="ml-1 text-gray-500">{plan.period}</span>}
              </div>
              <p className="mt-2 text-sm text-gray-600">{plan.description}</p>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                    <CheckIcon className="h-4 w-4 flex-shrink-0 text-brand-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`mt-8 block w-full rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Compliance Section ─────────────────────────────────────────────────── */

function ComplianceSection() {
  const regulations = [
    { name: "GDPR", region: "European Union" },
    { name: "CCPA", region: "California, USA" },
    { name: "LGPD", region: "Brazil" },
    { name: "POPIA", region: "South Africa" },
  ];

  return (
    <section className="bg-gray-50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Built for compliance
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            PrivacyPilot supports all major data privacy regulations worldwide
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {regulations.map((reg) => (
            <div
              key={reg.name}
              className="flex flex-col items-center rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                <ShieldIcon className="h-6 w-6 text-brand-600" />
              </div>
              <span className="mt-3 text-lg font-bold text-gray-900">{reg.name}</span>
              <span className="text-xs text-gray-500">{reg.region}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ────────────────────────────────────────────────────────── */

function CTASection() {
  return (
    <section className="bg-gradient-to-r from-brand-600 to-brand-800 py-20">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to simplify your DSAR process?
        </h2>
        <p className="mt-4 text-lg text-brand-100">
          Join hundreds of organizations already using PrivacyPilot to stay compliant.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow hover:bg-gray-50 transition-colors"
          >
            Start Free Trial
          </Link>
          <Link
            href="/demo"
            className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Start Interactive Demo
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-gray-900 py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
                <ShieldIcon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">PrivacyPilot</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              The modern DSAR management platform that helps organizations stay compliant with data privacy regulations worldwide.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white">Product</h4>
            <ul className="mt-4 space-y-2">
              {["Features", "Pricing", "Security", "Integrations"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white">Company</h4>
            <ul className="mt-4 space-y-2">
              {["About", "Blog", "Careers", "Contact"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white">Legal</h4>
            <ul className="mt-4 space-y-2">
              {["Privacy Policy", "Terms of Service", "Cookie Policy", "DPA"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-800 pt-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} PrivacyPilot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
