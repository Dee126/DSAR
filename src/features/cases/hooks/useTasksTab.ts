"use client";

import { useState, FormEvent } from "react";
import * as caseRepo from "../repositories";

/**
 * Hook for Tasks tab: create task, update task status.
 */
export function useTasksTab(caseId: string, onRefresh: () => Promise<void>) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setAddingTask(true);
    try {
      await caseRepo.createTask(caseId, {
        title: taskTitle,
        description: taskDescription || undefined,
        assigneeUserId: taskAssignee || undefined,
        dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
      });
      setShowAddTask(false);
      setTaskTitle(""); setTaskDescription(""); setTaskAssignee(""); setTaskDueDate("");
      await onRefresh();
    } catch { /* silently fail */ }
    finally { setAddingTask(false); }
  }

  async function handleUpdateTaskStatus(taskId: string, status: string) {
    await caseRepo.updateTaskStatus(taskId, status);
    await onRefresh();
  }

  return {
    showAddTask, setShowAddTask,
    taskTitle, setTaskTitle,
    taskDescription, setTaskDescription,
    taskAssignee, setTaskAssignee,
    taskDueDate, setTaskDueDate,
    addingTask, handleAddTask, handleUpdateTaskStatus,
  };
}
