"use client";

import Link from "next/link";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demo/fixtures";

const scenarioOrder: DemoScenarioId[] = ["access", "erasure", "objection"];

const scenarioIcons: Record<DemoScenarioId, React.ReactNode> = {
  access: (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  erasure: (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  objection: (
    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
    </svg>
  ),
};

const scenarioColors: Record<DemoScenarioId, { bg: string; text: string; ring: string; badge: string }> = {
  access: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", badge: "bg-blue-100 text-blue-800" },
  erasure: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", badge: "bg-amber-100 text-amber-800" },
  objection: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", badge: "bg-red-100 text-red-800" },
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">PrivacyPilot</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 sm:inline-flex">
              Interactive Demo
            </span>
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-white to-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            See PrivacyPilot in Action
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            Choose a scenario below and walk through a complete DSAR lifecycle — from intake to export.
            All data is synthetic. No account required.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No sign-up needed
            <span className="mx-1 text-gray-300">|</span>
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            100% synthetic data
            <span className="mx-1 text-gray-300">|</span>
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ~5 min each
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {scenarioOrder.map((id) => {
            const scenario = DEMO_SCENARIOS[id];
            const colors = scenarioColors[id];
            const icon = scenarioIcons[id];

            return (
              <Link
                key={id}
                href={`/demo/${id}`}
                className={`group relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ring-1 ${colors.ring} transition-all hover:shadow-lg hover:ring-2`}
              >
                {/* Badge */}
                <span className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${colors.badge}`}>
                  {scenario.caseInfo.type}
                </span>

                {/* Icon */}
                <div className={`mt-4 flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}>
                  {icon}
                </div>

                {/* Content */}
                <h2 className="mt-4 text-xl font-bold text-gray-900">{scenario.title}</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">{scenario.subtitle}</p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600">
                  {scenario.description}
                </p>

                {/* Highlights */}
                <ul className="mt-4 space-y-2">
                  {scenario.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {h}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
                  Start Walkthrough
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Safety Note */}
        <div className="mx-auto mt-12 max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Your Data is Safe</h3>
          <p className="mt-1 text-sm text-gray-500">
            This demo uses 100% synthetic data generated client-side. No real personal data is collected, stored, or processed.
            All names, emails, and identifiers are fictional.
          </p>
        </div>
      </div>
    </div>
  );
}
