import { z } from 'zod';
import { dateOnlySchema } from '../../lib/dates';
import { createTaskSchema } from '../tasks/tasks.schemas';

const name = z.string().trim().min(1, 'Name is required').max(200);
const clientName = z.string().trim().min(1, 'Client name is required').max(200);
const description = z.string().trim().max(5000);

export const createProjectSchema = z.strictObject({
  name,
  clientName,
  description: description.default(''),
  managerId: z.string().min(1),
  deadline: dateOnlySchema,
  tasks: z.array(createTaskSchema).max(200).default([]),
});

export const updateProjectSchema = z
  .strictObject({
    name: name.optional(),
    clientName: clientName.optional(),
    description: description.optional(),
    managerId: z.string().min(1).optional(),
    deadline: dateOnlySchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
    when: (payload) => payload.issues.length === 0, // don't add this on top of e.g. an unknown-key error
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
