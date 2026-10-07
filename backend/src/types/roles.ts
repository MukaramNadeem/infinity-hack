export const ROLES = ['ADMIN', 'MANAGER', 'DEVELOPER'] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Authenticated user attached to req.user by middleware/authenticate.ts.
// Never contains the password hash.
export interface AuthUser {
  id: string;
  code: string;
  name: string;
  email: string;
  role: Role;
  specialization: string;
  skills: string[];
}
