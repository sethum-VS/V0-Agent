"use client";

import { WorkerCard, type WorkerStatus } from "@/components/worker-card";

interface Worker {
  id: string;
  name: string;
  task: string;
  status: WorkerStatus;
}

const mockWorkers: Worker[] = [
  {
    id: "1",
    name: "Worker Alpha",
    task: "Analyzing customer feedback data and generating sentiment reports",
    status: "Thinking",
  },
  {
    id: "2",
    name: "Worker Beta",
    task: "Processing invoice documents and extracting key financial data",
    status: "Completed",
  },
  {
    id: "3",
    name: "Worker Gamma",
    task: "Awaiting new task assignment",
    status: "Idle",
  },
  {
    id: "4",
    name: "Worker Delta",
    task: "Generating automated email responses based on incoming queries",
    status: "Thinking",
  },
  {
    id: "5",
    name: "Worker Epsilon",
    task: "Code review completed for repository pull requests",
    status: "Completed",
  },
  {
    id: "6",
    name: "Worker Zeta",
    task: "Standing by for document classification tasks",
    status: "Idle",
  },
];

export function WorkerGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mockWorkers.map((worker) => (
        <WorkerCard
          key={worker.id}
          name={worker.name}
          task={worker.task}
          status={worker.status}
        />
      ))}
    </div>
  );
}
