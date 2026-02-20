"use client";

import type { DSARCaseDetail, CaseUser } from "../types";
import { TASK_STATUS_COLORS, TASK_STATUSES } from "../constants";

interface Props {
  caseData: DSARCaseDetail;
  users: CaseUser[];
  canManage: boolean;
  // eslint-disable-next-line
  tt: any;
}

export function TasksTab({ caseData, users, canManage, tt }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Tasks ({caseData.tasks.length})</h2>
        {canManage && <button onClick={() => tt.setShowAddTask(!tt.showAddTask)} className="text-sm font-medium text-brand-600 hover:text-brand-700">{tt.showAddTask ? "Cancel" : "+ Add Task"}</button>}
      </div>
      {tt.showAddTask && (
        <form onSubmit={tt.handleAddTask} className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div><label className="label">Title <span className="text-red-500">*</span></label><input type="text" value={tt.taskTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => tt.setTaskTitle(e.target.value)} className="input-field" required /></div>
          <div><label className="label">Description</label><textarea value={tt.taskDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => tt.setTaskDescription(e.target.value)} rows={2} className="input-field resize-y" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Assignee</label><select value={tt.taskAssignee} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => tt.setTaskAssignee(e.target.value)} className="input-field"><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div><label className="label">Due Date</label><input type="date" value={tt.taskDueDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => tt.setTaskDueDate(e.target.value)} className="input-field" /></div>
          </div>
          <div className="flex justify-end"><button type="submit" disabled={tt.addingTask} className="btn-primary text-sm">{tt.addingTask ? "Adding..." : "Add Task"}</button></div>
        </form>
      )}
      {caseData.tasks.length === 0 ? <p className="mt-4 text-sm text-gray-500">No tasks yet.</p> : (
        <div className="mt-4 space-y-2">
          {caseData.tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-gray-900">{task.title}</p><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_COLORS[task.status] ?? "bg-gray-100 text-gray-700"}`}>{task.status.replace(/_/g, " ")}</span></div>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">{task.assignee && <span>Assigned to {task.assignee.name}</span>}{task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}</div>
                {task.description && <p className="mt-1 text-xs text-gray-600">{task.description}</p>}
              </div>
              {canManage && <select value={task.status} onChange={(e) => tt.handleUpdateTaskStatus(task.id, e.target.value)} className="ml-4 rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">{TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
