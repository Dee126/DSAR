"use client";

import type { DSARCaseDetail, StateTransition, Comment } from "../types";
import { STATUS_LABELS, STATUS_COLORS } from "../constants";

interface Props {
  caseData: DSARCaseDetail;
}

export function TimelineSection({ caseData }: Props) {
  const timelineItems = [
    ...caseData.stateTransitions.map((t) => ({ id: t.id, date: t.changedAt, type: "transition" as const, data: t })),
    ...caseData.comments.map((c) => ({ id: c.id, date: c.createdAt, type: "comment" as const, data: c })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
      {timelineItems.length === 0 ? <p className="mt-4 text-sm text-gray-500">No activity yet.</p> : (
        <div className="mt-4 space-y-0">
          {timelineItems.map((item, idx) => (
            <div key={item.id} className="relative flex gap-4 pb-6">
              {idx < timelineItems.length - 1 && <div className="absolute left-[15px] top-8 h-full w-px bg-gray-200" />}
              <div className="relative z-10 flex-shrink-0">
                {item.type === "transition" ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100"><svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg></div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100"><svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg></div>
                )}
              </div>
              <div className="flex-1 pt-1">
                {item.type === "transition" ? (
                  <>
                    <p className="text-sm text-gray-900"><span className="font-medium">{(item.data as StateTransition).changedBy.name}</span> changed status from{" "}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[(item.data as StateTransition).fromStatus] ?? "bg-gray-100 text-gray-800"}`}>{STATUS_LABELS[(item.data as StateTransition).fromStatus]}</span>{" "}to{" "}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[(item.data as StateTransition).toStatus] ?? "bg-gray-100 text-gray-800"}`}>{STATUS_LABELS[(item.data as StateTransition).toStatus]}</span>
                    </p>
                    {(item.data as StateTransition).reason && <p className="mt-1 text-sm italic text-gray-600">&ldquo;{(item.data as StateTransition).reason}&rdquo;</p>}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-900"><span className="font-medium">{(item.data as Comment).author.name}</span> commented</p>
                    <div className="mt-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{(item.data as Comment).body}</div>
                  </>
                )}
                <p className="mt-1 text-xs text-gray-400">{new Date(item.date).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
