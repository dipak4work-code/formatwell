/** Request/response envelope shared by the main thread and every parser worker. */

export interface WorkerRequest<T = unknown> {
  id: number;
  payload: T;
}

export interface WorkerResponse<R = unknown> {
  id: number;
  result?: R;
  error?: string;
}
