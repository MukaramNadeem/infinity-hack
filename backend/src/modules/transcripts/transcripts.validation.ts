// Turns an AI draft (codes and date strings, any field possibly null) into records that can
// be saved — or a complete list of issues explaining what must be corrected first.
// Nothing is saved unless this returns zero issues.

import type { User } from '@prisma/client';
import { dateOnlySchema } from '../../lib/dates';
import type { Role } from '../../types/roles';
import type { ExtractionDraft } from '../../ai/extraction.schema';
import { checkTaskDeadline, type Issue } from '../projects/projects.rules';

type DirectoryUser = Pick<User, 'id' | 'code' | 'name' | 'role'>;

export interface ResolvedTask {
  title: string;
  description: string;
  assigneeId: string;
  deadline: Date;
  estimatedHours: number;
}

export interface ResolvedProject {
  name: string;
  clientName: string;
  description: string;
  managerId: string;
  deadline: Date;
  tasks: ResolvedTask[];
}

export type DraftValidation =
  | { ok: true; projects: ResolvedProject[] }
  | { ok: false; issues: Issue[] };

// Resolve a person reference: directory code first (what the AI is told to return), then
// full name, then a unique first name — so "PM01", "Ayesha Khan" and "Ayesha" all work.
function resolvePerson(ref: string, users: DirectoryUser[], role: Role): { user?: DirectoryUser; message?: string } {
  const wanted = ref.trim().toLowerCase();
  const byCode = users.filter((u) => u.code.toLowerCase() === wanted);
  const byName = users.filter((u) => u.name.toLowerCase() === wanted);
  const byFirstName = users.filter((u) => u.name.split(' ')[0].toLowerCase() === wanted);
  const candidates = byCode.length ? byCode : byName.length ? byName : byFirstName;

  if (candidates.length === 0) return { message: `"${ref}" is not in the team directory` };
  if (candidates.length > 1) return { message: `"${ref}" matches more than one person; use a directory code` };
  const user = candidates[0];
  if (user.role !== role) return { message: `${user.name} is a ${user.role}, expected a ${role}` };
  return { user };
}

function parseDate(value: string): Date | undefined {
  const result = dateOnlySchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function validateDraft(draft: ExtractionDraft, users: DirectoryUser[]): DraftValidation {
  const issues: Issue[] = [];
  const projects: ResolvedProject[] = [];

  if (draft.projects.length === 0) {
    issues.push({ path: 'projects', message: 'No projects were found in the transcript' });
  }

  draft.projects.forEach((p, pi) => {
    const at = `projects.${pi}`;
    const label = p.name ? `Project "${p.name}"` : `Project #${pi + 1}`;
    const issue = (path: string, message: string) => issues.push({ path: `${at}.${path}`, message: `${label}: ${message}` });

    if (!p.name) issue('name', 'name is missing');
    if (!p.clientName) issue('clientName', 'client name is missing');

    let managerId: string | undefined;
    if (!p.managerCode) {
      issue('managerCode', 'manager could not be determined');
    } else {
      const r = resolvePerson(p.managerCode, users, 'MANAGER');
      if (r.user) managerId = r.user.id;
      else issue('managerCode', r.message!);
    }

    let deadline: Date | undefined;
    if (!p.deadline) issue('deadline', 'deadline is missing');
    else if (!(deadline = parseDate(p.deadline))) issue('deadline', `"${p.deadline}" is not a valid YYYY-MM-DD date`);

    const tasks: ResolvedTask[] = [];
    p.tasks.forEach((t, ti) => {
      const tat = `tasks.${ti}`;
      const taskLabel = t.title ? `task "${t.title}"` : `task #${ti + 1}`;
      const taskIssue = (path: string, message: string) => issue(`${tat}.${path}`, `${taskLabel}: ${message}`);

      if (!t.title) taskIssue('title', 'title is missing');

      let assigneeId: string | undefined;
      if (!t.assigneeCode) {
        taskIssue('assigneeCode', 'owner could not be determined');
      } else {
        const r = resolvePerson(t.assigneeCode, users, 'DEVELOPER');
        if (r.user) assigneeId = r.user.id;
        else taskIssue('assigneeCode', r.message!);
      }

      let taskDeadline: Date | undefined;
      if (!t.deadline) taskIssue('deadline', 'deadline is missing');
      else if (!(taskDeadline = parseDate(t.deadline))) taskIssue('deadline', `"${t.deadline}" is not a valid YYYY-MM-DD date`);
      else if (deadline) {
        for (const d of checkTaskDeadline(taskDeadline, deadline, '')) taskIssue('deadline', d.message.charAt(0).toLowerCase() + d.message.slice(1));
      }

      if (t.estimatedHours === null) taskIssue('estimatedHours', 'estimated hours are missing');
      else if (!(t.estimatedHours > 0)) taskIssue('estimatedHours', 'estimated hours must be greater than 0');

      if (t.title && assigneeId && taskDeadline && t.estimatedHours && t.estimatedHours > 0) {
        tasks.push({
          title: t.title,
          description: t.description ?? '',
          assigneeId,
          deadline: taskDeadline,
          estimatedHours: t.estimatedHours,
        });
      }
    });

    if (p.name && p.clientName && managerId && deadline) {
      projects.push({ name: p.name, clientName: p.clientName, description: p.description ?? '', managerId, deadline, tasks });
    }
  });

  return issues.length ? { ok: false, issues } : { ok: true, projects };
}
