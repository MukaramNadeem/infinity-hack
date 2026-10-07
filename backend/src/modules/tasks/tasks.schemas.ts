import { z } from 'zod';
import { dateOnlySchema } from '../../lib/dates';
import { TASK_STATUSES } from '../../types/roles';

const title = z.string().trim().min(1, 'Title is required').max(200);
const description = z.string().trim().max(5000);
const estimatedHours = z.number().positive('Estimated hours must be greater than 0').max(10000);
const status = z.enum(TASK_STATUSES);

// Unknown keys are rejected (strictObject) so frontend typos fail loudly instead of being ignored.
export const createTaskSchema = z.strictObject({
  title,
  description: description.default(''),
  assigneeId: z.string().min(1),
  deadline: dateOnlySchema,
  estimatedHours,
  status: status.default('TODO'),
});

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    assigneeId: z.string().min(1).optional(),
    deadline: dateOnlySchema.optional(),
    estimatedHours: estimatedHours.optional(),
    status: status.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
    when: (payload) => payload.issues.length === 0, // don't add this on top of e.g. an unknown-key error
  });

export const taskListQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  status: status.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
