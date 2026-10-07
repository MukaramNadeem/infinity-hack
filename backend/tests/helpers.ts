import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app = createApp();
export const api = () => request(app);

export const SAMPLE_TRANSCRIPT = readFileSync(path.join(__dirname, 'fixtures', 'meeting-transcript.txt'), 'utf8');
export const MEETING_DATE = '2026-10-07';

export type DemoLogin = 'admin' | 'ayesha' | 'bilal' | 'hina' | 'ali' | 'hamza' | 'sara' | 'usman' | 'zain' | 'maryam';

const tokens = new Map<DemoLogin, string>();

export async function tokenFor(name: DemoLogin): Promise<string> {
  const cached = tokens.get(name);
  if (cached) return cached;
  const res = await api().post('/api/auth/login').send({ email: `${name}@novaworks.example`, password: 'Demo123!' });
  if (res.status !== 200) throw new Error(`Login failed for ${name}: ${res.status} ${JSON.stringify(res.body)}`);
  tokens.set(name, res.body.token);
  return res.body.token;
}

export async function auth(name: DemoLogin) {
  return { Authorization: `Bearer ${await tokenFor(name)}` };
}

// Removes generated data; the seeded users are kept.
export async function resetData() {
  await prisma.$transaction([prisma.task.deleteMany(), prisma.project.deleteMany(), prisma.transcript.deleteMany()]);
}

export async function counts() {
  const [projects, tasks, transcripts] = await Promise.all([prisma.project.count(), prisma.task.count(), prisma.transcript.count()]);
  return { projects, tasks, transcripts };
}

// "Create from Transcript" as admin (mock AI).
export async function importTranscript(transcript = SAMPLE_TRANSCRIPT, query = '') {
  return api()
    .post(`/api/transcripts${query}`)
    .set(await auth('admin'))
    .send({ transcript, meetingDate: MEETING_DATE });
}

export async function userIdByCode(code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { code } });
  return user.id;
}

// Replace one exact sentence of the sample transcript, failing loudly if it isn't there.
export function editTranscript(from: string, to: string, transcript = SAMPLE_TRANSCRIPT) {
  if (!transcript.includes(from)) throw new Error(`Transcript does not contain: ${from}`);
  return transcript.replace(from, to);
}

// The organizer answer key (challenge pack, section 9).
export const ANSWER_KEY_PROJECTS = [
  { name: 'UrbanCart Website', clientName: 'UrbanCart Clothing', manager: 'PM01', deadline: '2026-10-20', taskCount: 4, hours: 40 },
  { name: 'QuickServe Mobile App', clientName: 'QuickServe Services', manager: 'PM02', deadline: '2026-10-24', taskCount: 4, hours: 46 },
  { name: 'HelpDeskPro AI Assistant', clientName: 'HelpDeskPro Solutions', manager: 'PM03', deadline: '2026-10-22', taskCount: 4, hours: 38 },
];

export const ANSWER_KEY_TASKS: [project: string, title: string, owner: string, deadline: string, hours: number][] = [
  ['UrbanCart Website', 'Product catalog UI', 'DEV01', '2026-10-12', 12],
  ['UrbanCart Website', 'Demo cart UI', 'DEV01', '2026-10-15', 8],
  ['UrbanCart Website', 'Product and cart APIs', 'DEV02', '2026-10-14', 14],
  ['UrbanCart Website', 'Website integration and testing', 'DEV01', '2026-10-19', 6],
  ['QuickServe Mobile App', 'Login and profile screens', 'DEV03', '2026-10-12', 8],
  ['QuickServe Mobile App', 'Service booking screens', 'DEV03', '2026-10-17', 12],
  ['QuickServe Mobile App', 'Booking and account APIs', 'DEV02', '2026-10-16', 16],
  ['QuickServe Mobile App', 'Mobile integration and testing', 'DEV04', '2026-10-22', 10],
  ['HelpDeskPro AI Assistant', 'FAQ document processing', 'DEV06', '2026-10-13', 10],
  ['HelpDeskPro AI Assistant', 'Assistant answer generation', 'DEV05', '2026-10-17', 14],
  ['HelpDeskPro AI Assistant', 'Human escalation flow', 'DEV05', '2026-10-18', 6],
  ['HelpDeskPro AI Assistant', 'Assistant evaluation and testing', 'DEV06', '2026-10-21', 8],
];
