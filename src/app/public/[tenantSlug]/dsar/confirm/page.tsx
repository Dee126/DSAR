"use client";

import { useSearchParams } from "next/navigation";

export default function IntakeConfirmation() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("ref") || "---";

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Request Submitted</h1>
      <p className="mt-2 text-gray-600">
        Your request has been received and will be processed shortly.
      </p>

      <div className="mt-6 rounded-lg bg-white p-6 shadow">
        <p className="text-sm text-gray-500">Your reference number</p>
        <p className="mt-1 text-2xl font-mono font-bold text-blue-600">{reference}</p>
        <p className="mt-4 text-sm text-gray-500">
          Please save this reference number. You may use it to inquire about the status of your request.
        </p>
      </div>

      <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium">What happens next?</p>
        <ul className="mt-2 space-y-1 text-left">
          <li>1. Your request will be reviewed by our privacy team</li>
          <li>2. We may contact you if additional information is needed</li>
          <li>3. Your request will be processed within the legally required timeframe</li>
        </ul>
      </div>
    </div>
  );
}
