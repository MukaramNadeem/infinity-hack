// The ten fictional demo accounts supplied in the challenge pack (section 3).
// All share the demo password below; it is hashed before storing.

export const DEMO_PASSWORD = 'Demo123!';

export type Role = 'ADMIN' | 'MANAGER' | 'DEVELOPER';

export interface DemoUser {
  code: string;
  name: string;
  email: string;
  role: Role;
  specialization: string;
  skills: string[];
}

export const DEMO_USERS: DemoUser[] = [
  { code: 'ADMIN', name: 'Admin', email: 'admin@novaworks.example', role: 'ADMIN', specialization: 'Administrator', skills: ['Company overview', 'Transcript creation'] },
  { code: 'PM01', name: 'Ayesha Khan', email: 'ayesha@novaworks.example', role: 'MANAGER', specialization: 'Web PM', skills: ['Web projects', 'Client coordination'] },
  { code: 'PM02', name: 'Bilal Ahmed', email: 'bilal@novaworks.example', role: 'MANAGER', specialization: 'Mobile PM', skills: ['Mobile projects', 'Delivery planning'] },
  { code: 'PM03', name: 'Hina Malik', email: 'hina@novaworks.example', role: 'MANAGER', specialization: 'AI PM', skills: ['AI projects', 'Requirement review'] },
  { code: 'DEV01', name: 'Ali Raza', email: 'ali@novaworks.example', role: 'DEVELOPER', specialization: 'Full-Stack', skills: ['React', 'Frontend integration'] },
  { code: 'DEV02', name: 'Hamza Shah', email: 'hamza@novaworks.example', role: 'DEVELOPER', specialization: 'Full-Stack', skills: ['Node.js', 'Databases', 'APIs'] },
  { code: 'DEV03', name: 'Sara Noor', email: 'sara@novaworks.example', role: 'DEVELOPER', specialization: 'App Developer', skills: ['Flutter', 'Mobile UI'] },
  { code: 'DEV04', name: 'Usman Tariq', email: 'usman@novaworks.example', role: 'DEVELOPER', specialization: 'App Developer', skills: ['Flutter', 'Integration', 'Testing'] },
  { code: 'DEV05', name: 'Zain Abbas', email: 'zain@novaworks.example', role: 'DEVELOPER', specialization: 'AI Developer', skills: ['LLMs', 'Extraction', 'Prompts'] },
  { code: 'DEV06', name: 'Maryam Asif', email: 'maryam@novaworks.example', role: 'DEVELOPER', specialization: 'AI Developer', skills: ['Retrieval', 'Document processing'] },
];
