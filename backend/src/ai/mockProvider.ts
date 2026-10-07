import type { ExtractionDraft, DraftProject } from './extraction.schema';
import type { AiProvider, DirectoryEntry, ExtractionRequest } from './types';

// Offline stand-in for the real AI, used in tests and when AI_MOCK=true.
//
// It is NOT a language model: it only understands the "final recap" format of the sample
// meeting, e.g.
//   "UrbanCart Website, client UrbanCart Clothing, manager Ayesha, deadline 20 October.
//    Ali owns Product catalog UI: 12 hours, 12 October. ..."
// Because it genuinely parses the transcript (rather than returning a canned answer), edits
// to the recap — changed hours, dates, owners, unknown people — flow through to the result.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const PROJECT_RE = /([^:,.\n]+?),\s*client\s+([^,\n]+?),\s*manager\s+([A-Za-z]+),\s*deadline\s+(\d{1,2}\s+[A-Za-z]+)/gi;
const TASK_RE = /([A-Za-z]+)\s+owns\s+([^:\n]+?):\s*(\d+(?:\.\d+)?)\s*hours?,\s*(\d{1,2}\s+[A-Za-z]+)/gi;

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async extract({ transcript, meetingDate, directory }: ExtractionRequest): Promise<ExtractionDraft> {
    // Join hard line wraps (e.g. text copied from a PDF) so sentences split across lines still match.
    const text = recapSection(transcript).replace(/\s+/g, ' ');
    const year = Number(meetingDate.slice(0, 4));
    const projectMatches = [...text.matchAll(PROJECT_RE)];

    const projects: DraftProject[] = projectMatches.map((m, i) => {
      const segmentEnd = projectMatches[i + 1]?.index ?? text.length;
      const segment = text.slice(m.index! + m[0].length, segmentEnd);
      return {
        name: m[1].trim(),
        clientName: m[2].trim(),
        description: null,
        managerCode: toCode(m[3], directory),
        deadline: toIsoDate(m[4], year),
        tasks: [...segment.matchAll(TASK_RE)].map((t) => ({
          title: t[2].trim(),
          description: null,
          assigneeCode: toCode(t[1], directory),
          deadline: toIsoDate(t[4], year),
          estimatedHours: Number(t[3]),
        })),
      };
    });

    return { projects };
  }
}

// Use the text after the last "final recap" mention, when there is one.
function recapSection(transcript: string): string {
  const matches = [...transcript.matchAll(/final recap/gi)];
  const last = matches.at(-1);
  return last ? transcript.slice(last.index) : transcript;
}

// Match a first name to a directory code; unknown names are passed through unchanged
// (just like a model that ignored instructions) so validation reports them.
function toCode(firstName: string, directory: DirectoryEntry[]): string {
  const wanted = firstName.toLowerCase();
  const match = directory.find((d) => d.name.split(' ')[0].toLowerCase() === wanted);
  return match ? match.code : firstName;
}

function toIsoDate(dayMonth: string, year: number): string | null {
  const [day, monthName] = dayMonth.trim().split(/\s+/);
  const month = MONTHS.indexOf(monthName.toLowerCase());
  if (month < 0) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
}
