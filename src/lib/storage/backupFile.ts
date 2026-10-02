import type { Project } from "$lib/model";

export type BackupFile = {
  kind: "pensieve-backup";
  savedAt: string;
  project: Project;
  notes: unknown[];
  tasks: unknown[];
};

export function backupFile(project: Project, notes: unknown[], tasks: unknown[], savedAt: string): BackupFile {
  return {
    kind: "pensieve-backup",
    savedAt,
    project,
    notes,
    tasks,
  };
}
