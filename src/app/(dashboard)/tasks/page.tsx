"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/* ── Display helpers ──────────────────────────────────────────────────── */

const TASK_STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  BLOCKED: "bg-red-100 text-red-700",
  DONE: "bg-green-100 text-green-700",
};

const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"];

/* ── Types ────────────────────────────────────────────────────────────── */

interface CaseUser {
  id: string;
  name: string;
  email: string;
}

interface TaskItem {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  createdAt: string;
  assignee: CaseUser | null;
  case?: {
    id: string;
    caseNumber: string;
  };
  system?: {
    id: string;
    name: string;
  } | null;
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<CaseUser[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState<"all" | "overdue" | "due-soon" | "no-date">("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (assigneeFilter) params.set("assignee", assigneeFilter);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTasks(Array.isArray(json) ? json : json.data ?? []);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [statusFilter, assigneeFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          const json = await res.json();
          setUsers(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        /* silently fail */
      }
    }
    fetchUsers();
  }, []);

  async function handleUpdateTaskStatus(task: TaskItem, newStatus: string) {
    try {
      const res = await fetch(
        `/api/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: newStatus } : t
          )
        );
      }
    } catch {
      /* silently fail */
    }
  }

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  function isOverdue(task: TaskItem) {
    return task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < now;
  }

  function isDueSoon(task: TaskItem) {
    if (!task.dueDate || task.status === "DONE") return false;
    const due = new Date(task.dueDate);
    return due >= now && due <= sevenDaysFromNow;
  }

  const filteredTasks = tasks.filter((t) => {
    if (dueDateFilter === "overdue") return isOverdue(t);
    if (dueDateFilter === "due-soon") return isDueSoon(t);
    if (dueDateFilter === "no-date") return !t.dueDate;
    return true;
  });

  // Stats
  const totalTasks = tasks.length;
  const openTasks = tasks.filter((t) => t.status === "OPEN").length;
  const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const blockedTasks = tasks.filter((t) => t.status === "BLOCKED").length;
  const doneTasks = tasks.filter((t) => t.status === "DONE").length;
  const overdueTasks = tasks.filter(isOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and manage all tasks across cases
        </p>
      </div>

      {/* Stats */}
      {!loading && totalTasks > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="card text-center">
            <p className="text-2xl font-bold text-gray-900">{totalTasks}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-blue-600">{openTasks}</p>
            <p className="text-xs text-gray-500">Open</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-600">{inProgressTasks}</p>
            <p className="text-xs text-gray-500">In Progress</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-red-600">{blockedTasks}</p>
            <p className="text-xs text-gray-500">Blocked</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-600">{doneTasks}</p>
            <p className="text-xs text-gray-500">Done</p>
          </div>
          <div className="card text-center">
            <p className={`text-2xl font-bold ${overdueTasks > 0 ? "text-red-600" : "text-gray-400"}`}>
              {overdueTasks}
            </p>
            <p className="text-xs text-gray-500">Overdue</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="task-status-filter" className="label">
              Status
            </label>
            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-full sm:w-44"
            >
              <option value="">All Statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="task-assignee-filter" className="label">
              Assignee
            </label>
            <select
              id="task-assignee-filter"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="input-field w-full sm:w-48"
            >
              <option value="">All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label htmlFor="task-due-filter" className="label">
              Due Date
            </label>
            <select
              id="task-due-filter"
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value as typeof dueDateFilter)}
              className="input-field w-full sm:w-44"
            >
              <option value="all">All</option>
              <option value="overdue">Overdue</option>
              <option value="due-soon">Due Soon (7d)</option>
              <option value="no-date">No Due Date</option>
            </select>
          </div>
          {(statusFilter || assigneeFilter || dueDateFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("");
                setAssigneeFilter("");
                setDueDateFilter("all");
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded bg-gray-100"
              />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {tasks.length === 0
                ? "No tasks found. Tasks are created from individual case pages."
                : "No tasks match the current filters."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Task</th>
                    <th className="px-6 py-3">Case</th>
                    <th className="px-6 py-3">System</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Assignee</th>
                    <th className="px-6 py-3">Due Date</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        isOverdue(task) ? "bg-red-50/50" : ""
                      }`}
                      onClick={() =>
                        setExpandedTaskId(
                          expandedTaskId === task.id ? null : task.id
                        )
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <svg
                            className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                              expandedTaskId === task.id ? "rotate-90" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {task.title}
                            </span>
                            {expandedTaskId === task.id && task.description && (
                              <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">
                                {task.description}
                              </p>
                            )}
                            {expandedTaskId === task.id && !task.description && (
                              <p className="mt-1 text-xs text-gray-400 italic">
                                No description provided.
                              </p>
                            )}
                            {expandedTaskId === task.id && (
                              <div className="mt-2 flex gap-4 text-xs text-gray-400">
                                <span>
                                  Created:{" "}
                                  {new Date(task.createdAt).toLocaleString()}
                                </span>
                                {task.case && (
                                  <Link
                                    href={`/cases/${task.caseId}`}
                                    className="text-brand-600 hover:text-brand-700"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    View Case
                                  </Link>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {task.case ? (
                          <Link
                            href={`/cases/${task.caseId}`}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {task.case.caseNumber}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">--</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {task.system?.name ?? (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            TASK_STATUS_COLORS[task.status] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {task.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                        {task.assignee?.name ?? (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {task.dueDate ? (
                          <span
                            className={
                              isOverdue(task)
                                ? "font-medium text-red-600"
                                : isDueSoon(task)
                                ? "font-medium text-yellow-600"
                                : "text-gray-500"
                            }
                          >
                            {new Date(task.dueDate).toLocaleDateString()}
                            {isOverdue(task) && (
                              <span className="ml-1 text-xs">(overdue)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td
                        className="px-6 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleUpdateTaskStatus(task, e.target.value)
                          }
                          className="rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-gray-200 md:hidden">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    isOverdue(task) ? "bg-red-50/50" : ""
                  }`}
                  onClick={() =>
                    setExpandedTaskId(
                      expandedTaskId === task.id ? null : task.id
                    )
                  }
                >
                  {/* Line 1: Task title */}
                  <div className="flex items-start gap-2">
                    <svg
                      className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform mt-0.5 ${
                        expandedTaskId === task.id ? "rotate-90" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {task.title}
                      </p>
                    </div>
                  </div>

                  {/* Line 2: Case number + System */}
                  <div className="mt-1 ml-6 flex items-center gap-2 text-xs text-gray-500">
                    {task.case ? (
                      <Link
                        href={`/cases/${task.caseId}`}
                        className="font-medium text-brand-600 hover:text-brand-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {task.case.caseNumber}
                      </Link>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                    {task.system?.name && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span>{task.system.name}</span>
                      </>
                    )}
                  </div>

                  {/* Line 3: Status badge + Assignee */}
                  <div className="mt-2 ml-6 flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        TASK_STATUS_COLORS[task.status] ??
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {task.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-gray-500">
                      {task.assignee?.name ?? (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </span>
                  </div>

                  {/* Line 4: Due date */}
                  <div className="mt-2 ml-6 text-xs">
                    {task.dueDate ? (
                      <span
                        className={
                          isOverdue(task)
                            ? "font-medium text-red-600"
                            : isDueSoon(task)
                            ? "font-medium text-yellow-600"
                            : "text-gray-500"
                        }
                      >
                        Due: {new Date(task.dueDate).toLocaleDateString()}
                        {isOverdue(task) && (
                          <span className="ml-1">(overdue)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">No due date</span>
                    )}
                  </div>

                  {/* Expanded view */}
                  {expandedTaskId === task.id && (
                    <div className="mt-3 ml-6 space-y-3">
                      {task.description ? (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">
                          {task.description}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          No description provided.
                        </p>
                      )}
                      <div className="text-xs text-gray-400">
                        Created: {new Date(task.createdAt).toLocaleString()}
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-xs text-gray-500">
                          Change status:
                        </label>
                        <select
                          value={task.status}
                          onChange={(e) =>
                            handleUpdateTaskStatus(task, e.target.value)
                          }
                          className="rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {TASK_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      {task.case && (
                        <Link
                          href={`/cases/${task.caseId}`}
                          className="inline-block text-xs text-brand-600 hover:text-brand-700"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Case →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
