export type Task = {
  stargate_task_id: string;
  organization_id: number;
  system: string;
  method: string;
  uri: string;
  body: unknown | null;
  headers: Record<string, string> | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};
