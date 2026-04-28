export type WorkerActionState = {
  error: string | null;
  success: string | null;
};

export const initialWorkerActionState: WorkerActionState = {
  error: null,
  success: null,
};
