const app = document.querySelector('#app');
const state = { user: null, route: 'projects', projects: [], tasks: [], team: [], detail: null, loading: false, busy: false, notice: null, transcript: '', draft: null, issues: [], search: '', email: '', version: 0 };
const paths = {
  logo: '<path d="M5 19V5l14 14V5"/>', projects: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tasks: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V2h6v2M8 11l2 2 5-5M8 17h8"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5-5-5 5 5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
  logout: '<path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4"/>', search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2"/>',
  document: '<path d="M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8"/>', check: '<path d="m5 12 4 4L19 6"/>', trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.projects}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const initials = name => String(name || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const roleName = role => ({ ADMIN: 'Administrator', MANAGER: 'Manager', AGENT: 'Developer' })[role] || role;
function date(value) {
  const [year, month, day] = String(value || '').split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[Number(month) - 1] ? `${Number(day)} ${months[Number(month) - 1]} ${year}` : 'No date';
}
const brand = () => `<div class="brand"><span class="brand-mark">${icon('logo')}</span>NovaWorks<span class="muted">.</span></div>`;
const person = (name, subtitle = '') => `<div class="person"><span class="avatar">${escape(initials(name))}</span><div><strong>${escape(name)}</strong>${subtitle ? `<small>${escape(subtitle)}</small>` : ''}</div></div>`;
const button = (action, label, symbol, type = '') => `<button type="button" class="button ${type}" data-action="${action}" ${state.busy ? 'disabled' : ''}>${symbol ? icon(symbol) : ''}${label}</button>`;
const empty = (title, description, action = '') => `<div class="empty">${icon('projects')}<h2>${escape(title)}</h2><p>${escape(description)}</p>${action}</div>`;
function notice() {
  if (!state.notice) return '<div id="notice" aria-live="polite"></div>';
  return `<div id="notice" class="notice ${state.notice.error ? 'error' : ''}" role="${state.notice.error ? 'alert' : 'status'}"><button data-action="dismiss" aria-label="Dismiss message">×</button>${escape(state.notice.message)}</div>`;
}
function notify(message, error = false) { state.notice = { message, error }; const element = document.querySelector('#notice'); if (element) element.outerHTML = notice(); }
async function api(path, body) {
  let response;
  try { response = await fetch('/api' + path, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  catch { throw new Error('Cannot connect to the server. Check your connection and try again.'); }
  let data;
  try { data = response.status === 204 ? null : await response.json(); }
  catch { throw new Error('The server returned an unreadable response. Please try again.'); }
  if (!response.ok) {
    const error = Object.assign(new Error(data?.error?.message || 'The request failed. Please try again.'), { status: response.status, data });
    if (response.status === 401 && state.user) {
      state.user = null; state.version++; state.busy = false; state.draft = null; state.transcript = '';
      state.notice = { error: true, message: 'Your session has ended. Please sign in again.' }; render();
    }
    throw error;
  }
  return data;
}
function loginPage() {
  return `<div class="login"><section class="login-story">${brand()}<div class="story-copy"><div class="eyebrow">A little clarity. A lot of possibility.</div><h1>Good meetings.<br><em>Great next steps.</em></h1><p>A shared place for your team’s projects, decisions, and the work that comes next.</p><div class="flow-card"><div class="flow-line">${icon('document')}Bring your meeting notes</div><div class="flow-connector"></div><div class="flow-line">${icon('spark')}Turn decisions into a plan</div><div class="flow-connector"></div><div class="flow-line">${icon('check')}Give everyone their next step</div></div></div><div class="story-footer">NOVAWORKS TECHNOLOGIES · LAHORE</div></section><main class="login-form-wrap" id="main-content"><div class="login-content"><div class="eyebrow">Your team, in sync</div><h2>Welcome back.</h2><p>Sign in to see what’s next for you and your team.</p>${notice()}<form id="login-form" class="login-form"><div class="field"><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" placeholder="you@novaworks.example" value="${escape(state.email)}" required></div><div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required></div><button class="button" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner"></span>Signing in…' : `Sign in to workspace ${icon('arrow')}`}</button></form><div class="demo-hint"><strong>Here for the demo?</strong><p>Choose an account, then sign in.</p><div class="demo-shortcuts"><button data-demo="admin">Admin</button><button data-demo="ayesha">Ayesha · Manager</button><button data-demo="ali">Ali · Developer</button><button data-demo="hamza">Hamza · Developer</button></div><p>All demo accounts use <strong>Demo123!</strong></p></div></div></main></div>`;
}
function navLink(route, label, symbol) { return `<a href="#${route}" class="${state.route === route || (route === 'projects' && state.route === 'project') ? 'active' : ''}" ${state.route === route ? 'aria-current="page"' : ''}>${icon(symbol)}${label}</a>`; }
function shell(content) {
  const label = { projects: 'Projects', project: 'Project details', tasks: 'My tasks', team: 'Team directory', create: 'Create from transcript' }[state.route];
  return `<div class="workspace"><aside class="sidebar">${brand()}<div class="nav-label">Workspace</div><nav class="nav" aria-label="Main navigation">${navLink('projects', 'Projects', 'projects')}${state.user.role === 'AGENT' ? navLink('tasks', 'My tasks', 'tasks') : ''}${navLink('team', 'Team directory', 'team')}${state.user.role === 'ADMIN' ? `<div class="nav-divider"></div>${navLink('create', 'Create from transcript', 'spark')}` : ''}</nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>A clear plan starts here.</strong>Keep your team’s decisions and their next steps in one place.</div><div class="sidebar-user">${person(state.user.name, roleName(state.user.role))}<button class="icon-button" data-action="logout" aria-label="Sign out" title="Sign out" ${state.busy ? 'disabled' : ''}>${icon('logout')}</button></div></div></aside><div class="workspace-body"><header class="topbar"><div class="breadcrumb">Workspace <span>/</span><span>${label}</span></div><div class="topbar-right"><span>NovaWorks Technologies</span><span class="pill green"><span class="live-dot"></span>${escape(roleName(state.user.role))}</span></div></header><main class="main" id="main-content">${notice()}${content}</main></div></div>`;
}
function heading(kicker, title, description, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${escape(title)}</h1><p>${escape(description)}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ''}</div>`; }
function projectCards() {
  const term = state.search.toLowerCase();
  const projects = state.projects.filter(p => [p.name, p.clientName, p.manager.name].some(x => x.toLowerCase().includes(term)));
  if (!projects.length) return empty(state.search ? 'No matching projects' : 'Room for your next big idea.', state.search ? 'Try another project, client, or manager name.' : state.user.role === 'ADMIN' ? 'Bring in a meeting transcript to create your first projects and assign the work.' : 'Your assigned projects will appear here when they’re ready.', !state.search && state.user.role === 'ADMIN' ? button('create', 'Create from transcript', 'spark') : '');
  return `<div class="project-grid">${projects.map(p => `<a class="project-card" href="#project/${encodeURIComponent(p.id)}"><div class="card-top"><span class="project-monogram">${escape(initials(p.name).slice(0, 1))}</span><span class="card-arrow">${icon('arrow')}</span></div><div class="client">${escape(p.clientName)}</div><h3>${escape(p.name)}</h3><p class="description">${escape(p.description)}</p><div class="card-bottom">${person(p.manager.name, 'Project manager')}<div class="card-meta"><span>${icon('tasks')}${p.taskCount} tasks</span><span>${icon('clock')}${p.totalEstimatedHours} h</span></div><div class="card-meta"><span>${icon('calendar')}Due ${date(p.deadline)}</span></div></div></a>`).join('')}</div>`;
}
function projectsPage() {
  return heading('Make room for good work', state.user.role === 'ADMIN' ? 'A little clarity for every project.' : 'Your projects, all together.', state.user.role === 'AGENT' ? 'The projects you’re part of, with only your assigned work.' : state.user.role === 'MANAGER' ? 'A clear view of the projects you lead and the work ahead.' : 'From the first conversation to everyone’s next step.', state.user.role === 'ADMIN' ? button('create', 'Create from transcript', 'plus') : button('refresh', 'Refresh', 'refresh', 'secondary')) + `<div class="section-toolbar"><div class="section-label">${state.user.role === 'ADMIN' ? 'All projects' : 'Assigned projects'}<span>${state.projects.length} projects</span></div><label class="search">${icon('search')}<input id="project-search" type="search" placeholder="Find a project…" aria-label="Search projects" value="${escape(state.search)}"></label></div><div id="project-results">${projectCards()}</div><div class="page-footnote">${icon('lock')}You’re seeing the work available to your account.</div>`;
}
function taskTable(tasks, mine = false) {
  if (!tasks.length) return empty('Nothing on your list yet.', 'Assigned tasks will appear here with their deadline and estimated effort.');
  return `<div class="table-wrap"><table class="task-table"><thead><tr><th scope="col">Task & scope</th><th scope="col">Assigned to</th><th scope="col">Deadline</th><th scope="col">Estimate</th></tr></thead><tbody>${tasks.map(t => `<tr><td><span class="task-name">${escape(t.title)}</span><p class="task-description">${escape(t.description)}</p>${mine ? `<a class="project-link" href="#project/${encodeURIComponent(t.projectId)}">${escape(t.project.name)} ↗</a>` : ''}</td><td>${person(t.assignee.name, t.assignee.specialization)}</td><td>${date(t.deadline)}</td><td><span class="hours">${t.estimatedHours} h</span></td></tr>`).join('')}</tbody></table></div>`;
}
function projectPage() {
  const { project: p, tasks } = state.detail;
  return `<a class="button text small" href="#projects">${icon('back')}All projects</a>` + heading(escape(p.clientName), p.name, 'A shared plan. Clear ownership. All the details in one place.') + `<section class="project-intro"><div><p>${escape(p.description)}</p><dl class="detail-facts"><div><dt>Project manager</dt><dd>${escape(p.manager.name)}</dd></div><div><dt>Delivery date</dt><dd>${date(p.deadline)}</dd></div><div><dt>${state.user.role === 'AGENT' ? 'Your estimated effort' : 'Estimated effort'}</dt><dd>${p.totalEstimatedHours} hours</dd></div></dl></div><span class="pill green">${p.taskCount} ${state.user.role === 'AGENT' ? 'assigned ' : ''}tasks</span></section><div class="section-toolbar"><div class="section-label">${state.user.role === 'AGENT' ? 'Your tasks' : 'Project tasks'}<span>${tasks.length} tasks</span></div></div>${taskTable(tasks)}`;
}
function teamPage() { return heading('People behind the work', 'Good work starts with a team.', 'Meet the people turning ideas into something real.') + `<div class="section-toolbar"><div class="section-label">Team directory<span>${state.team.length} people</span></div><span class="pill">Read only</span></div><div class="team-grid">${state.team.map(u => `<article class="team-card">${person(u.name, u.specialization)}<span class="pill ${u.role === 'MANAGER' ? 'green' : ''}">${escape(roleName(u.role))}</span><div class="skills">${u.skills.map(s => `<span>${escape(s)}</span>`).join('')}</div></article>`).join('')}</div>`; }
function createPage() {
  return heading('Less admin. More momentum.', state.draft ? 'A few details need your input.' : 'Start with a conversation.', state.draft ? 'Review the highlighted fields, then save your corrected plan.' : 'Turn your meeting transcript into projects and assigned tasks.') + (state.draft ? correctionPage() : `<div class="create-layout"><section class="panel"><form id="transcript-form"><div class="panel-heading"><h2>Meeting transcript</h2>${button('load-demo', 'Load demo transcript', 'document', 'secondary small')}</div><div class="field"><label class="muted" for="transcript">Include the meeting date and the final agreed decisions.</label><textarea class="transcript-input" id="transcript" name="transcript" maxlength="60000" required placeholder="Paste your meeting transcript here…" ${state.busy ? 'disabled' : ''}>${escape(state.transcript)}</textarea></div>${state.busy ? '<div class="busy-note" role="status"><span class="spinner"></span><span>Finding the projects, owners, and next steps…<br><small>This can take a minute. Keep this page open.</small></span></div>' : ''}<div class="form-footer"><small><span id="char-count">${state.transcript.length.toLocaleString()}</span> / 60,000 characters</small><button class="button" type="submit" ${state.busy ? 'disabled' : ''}>${icon('spark')}${state.busy ? 'Creating your plan…' : 'Create projects & tasks'}</button></div></form></section><aside class="create-aside"><div class="aside-panel">${icon('spark')}<h3>From conversation to clarity.</h3><ol><li><strong>Bring the whole conversation.</strong><br>Include names, estimates, and deadlines.</li><li><strong>We find the final decisions.</strong><br>Projects and tasks are assigned to your existing team.</li><li><strong>Your plan is saved together.</strong><br>If anything is unclear, you can correct it first.</li></ol></div><p class="aside-note">Only administrators can create projects from a transcript. Saved work is shared according to each person’s role.</p></aside></div>`);
}
function editField(path, label, value, type = 'text', options = null, wide = false) {
  const issue = state.issues.filter(e => e.path === path).map(e => e.message).join(' ');
  const id = path.replace(/[^a-zA-Z0-9]/g, '-');
  const attrs = `id="${id}" data-field="${path}" ${state.busy ? 'disabled' : ''} ${issue ? `aria-invalid="true" aria-describedby="${id}-error"` : ''}`;
  const control = options ? `<select ${attrs}><option value="">Choose a person…</option>${options.map(u => `<option value="${escape(u.id)}" ${value === u.id ? 'selected' : ''}>${escape(u.name)}</option>`).join('')}${value && !options.some(u => u.id === value) ? `<option value="${escape(value)}" selected>Unknown: ${escape(value)}</option>` : ''}</select>` : type === 'textarea' ? `<textarea ${attrs} rows="2">${escape(value)}</textarea>` : `<input ${attrs} type="${type}" value="${escape(value)}" ${type === 'number' ? 'min="0.01" max="1000" step="0.01"' : ''}>`;
  return `<div class="field ${wide ? 'wide' : ''}"><label for="${id}">${label}</label>${control}${issue ? `<span id="${id}-error" class="field-error">${escape(issue)}</span>` : ''}</div>`;
}
function correctionPage() {
  const managers = state.team.filter(u => u.role === 'MANAGER'), agents = state.team.filter(u => u.role === 'AGENT');
  return `<p class="correction-intro">Nothing has been saved yet. Check the plan below and resolve the missing or invalid details.</p>${state.issues.length ? `<div class="notice error" role="alert"><strong>Review these details</strong><ul>${state.issues.map(e => `<li>${escape(e.path)}: ${escape(e.message)}</li>`).join('')}</ul></div>` : ''}<form id="correction-form">${state.draft.projects.map((p, i) => `<section class="edit-project"><div class="panel-heading"><h2>Project ${i + 1}</h2><button type="button" class="button danger small" data-remove-project="${i}" ${state.busy ? 'disabled' : ''}>${icon('trash')}Remove</button></div><div class="edit-grid">${editField(`projects[${i}].name`, 'Project name', p.name)}${editField(`projects[${i}].clientName`, 'Client', p.clientName)}${editField(`projects[${i}].managerId`, 'Project manager', p.managerId, 'text', managers)}${editField(`projects[${i}].deadline`, 'Project deadline', p.deadline, 'date')}${editField(`projects[${i}].description`, 'Scope', p.description, 'textarea', null, true)}</div>${p.tasks.map((t, j) => `<div class="edit-task"><div class="panel-heading"><h3>Task ${j + 1}</h3><button type="button" class="icon-button" data-remove-task="${i},${j}" aria-label="Remove task ${j + 1}" ${state.busy ? 'disabled' : ''}>${icon('trash')}</button></div><div class="edit-grid">${editField(`projects[${i}].tasks[${j}].title`, 'Task title', t.title, 'text', null, true)}${editField(`projects[${i}].tasks[${j}].assigneeId`, 'Assigned to', t.assigneeId, 'text', agents)}${editField(`projects[${i}].tasks[${j}].estimatedHours`, 'Estimated hours', t.estimatedHours, 'number')}${editField(`projects[${i}].tasks[${j}].deadline`, 'Task deadline', t.deadline, 'date')}${editField(`projects[${i}].tasks[${j}].description`, 'Task description', t.description, 'textarea', null, true)}</div></div>`).join('')}<button type="button" class="button secondary small" data-add-task="${i}" ${state.busy ? 'disabled' : ''}>${icon('plus')}Add task</button></section>`).join('')}<div class="correction-actions"><div>${button('add-project', 'Add project', 'plus', 'secondary')} ${button('edit-transcript', 'Back to transcript', 'back', 'text')}</div><button type="submit" class="button" ${state.busy ? 'disabled' : ''}>${state.busy ? '<span class="spinner"></span>Saving…' : `${icon('check')}Save corrected plan`}</button></div></form>`;
}
function render() {
  if (!state.user) { app.innerHTML = loginPage(); return; }
  let content;
  if (state.loading) content = '<div class="loading" role="status"><span class="spinner"></span>Loading your workspace…</div>';
  else if (state.loadError) content = empty('Couldn’t load this view.', state.loadError, button('refresh', 'Try again', 'refresh', 'secondary'));
  else content = { projects: projectsPage, project: projectPage, team: teamPage, create: createPage, tasks: () => heading('A clear next step', 'Your work, at a glance.', 'Every task assigned to you, across your projects.', button('refresh', 'Refresh', 'refresh', 'secondary')) + taskTable(state.tasks, true) }[state.route]();
  app.innerHTML = shell(content);
  document.title = `NovaWorks — ${state.route === 'project' ? state.detail?.project.name || 'Project' : { projects: 'Projects', team: 'Team', tasks: 'My tasks', create: 'Create from transcript' }[state.route]}`;
}
async function loadView() {
  if (!state.user || state.busy) return;
  const [candidate, projectId] = location.hash.slice(1).split('/');
  state.route = ['projects', 'project', 'tasks', 'team', 'create'].includes(candidate) ? candidate : state.user.role === 'AGENT' ? 'tasks' : 'projects';
  // A hand-edited or truncated project URL should return to the safe list view
  // instead of requesting `/projects/` and trying to render a non-project payload.
  if (state.route === 'project' && !projectId) state.route = 'projects';
  if ((state.route === 'create' && state.user.role !== 'ADMIN') || (state.route === 'tasks' && state.user.role !== 'AGENT')) state.route = 'projects';
  const hash = '#' + state.route + (state.route === 'project' && projectId ? '/' + projectId : '');
  history.replaceState(null, '', hash);
  const version = ++state.version;
  state.loading = true; state.loadError = null; state.search = ''; render();
  try {
    let data;
    if (state.route === 'projects') data = await api('/projects');
    else if (state.route === 'project') data = await api('/projects/' + encodeURIComponent(projectId || ''));
    else if (state.route === 'tasks') data = await api('/tasks/mine');
    else data = await api('/team');
    if (version !== state.version || !state.user) return;
    if (state.route === 'project') state.detail = data;
    else if (data.projects) state.projects = data.projects;
    else if (data.tasks) state.tasks = data.tasks;
    else if (data.team) state.team = data.team;
  } catch (error) { if (version === state.version) state.loadError = error.message; }
  finally { if (version === state.version) { state.loading = false; render(); } }
}
async function submitPlan(endpoint, body) {
  state.busy = true; state.notice = null; render();
  try {
    const { result } = await api('/transcript/' + endpoint, body);
    state.draft = null; state.issues = []; state.transcript = '';
    state.notice = { message: `${result.projectCount} projects and ${result.taskCount} tasks created. Your team’s next steps are ready.` };
    state.busy = false; history.replaceState(null, '', '#projects'); await loadView();
  } catch (error) {
    if (error.status === 422 && error.data.draft) { state.draft = error.data.draft; state.issues = error.data.error.details || []; }
    state.busy = false;
    if (state.user) { state.notice = { error: true, message: error.message }; render(); }
  }
}
app.addEventListener('submit', async event => {
  event.preventDefault();
  if (state.busy) return;
  if (event.target.id === 'login-form') {
    const form = new FormData(event.target); state.email = form.get('email'); state.busy = true; state.notice = null;
    const password = form.get('password'); render();
    try {
      const { user } = await api('/auth/login', { email: state.email, password }); state.user = user; state.busy = false; state.notice = null;
      history.replaceState(null, '', user.role === 'AGENT' ? '#tasks' : '#projects'); await loadView();
    } catch (error) { state.busy = false; state.notice = { error: true, message: error.message }; render(); }
  } else if (event.target.id === 'transcript-form') {
    if (!state.transcript.trim()) { notify('Paste a meeting transcript to continue.', true); return; }
    await submitPlan('create', { transcript: state.transcript });
  } else if (event.target.id === 'correction-form') await submitPlan('commit', { draft: state.draft });
});
app.addEventListener('input', event => {
  const target = event.target;
  if (target.id === 'transcript') { state.transcript = target.value; document.querySelector('#char-count').textContent = target.value.length.toLocaleString(); }
  if (target.id === 'project-search') { state.search = target.value; document.querySelector('#project-results').innerHTML = projectCards(); }
  if (target.dataset.field && state.draft) {
    const keys = target.dataset.field.replace(/\[(\d+)\]/g, '.$1').split('.');
    let item = state.draft; for (const key of keys.slice(0, -1)) item = item[key];
    item[keys.at(-1)] = target.type === 'number' ? target.value === '' ? null : Number(target.value) : target.value;
  }
});
const newTask = () => ({ title: '', description: '', assigneeId: null, deadline: null, estimatedHours: null });
app.addEventListener('click', async event => {
  const target = event.target.closest('button, a'); if (!target) return;
  if (state.busy) { event.preventDefault(); return; }
  if (target.dataset.demo) {
    state.email = target.dataset.demo + '@novaworks.example';
    document.querySelector('#email').value = state.email; document.querySelector('#password').value = 'Demo123!'; document.querySelector('#email').focus(); return;
  }
  if (target.dataset.removeProject !== undefined) { state.draft.projects.splice(Number(target.dataset.removeProject), 1); state.issues = []; render(); return; }
  if (target.dataset.removeTask) { const [i, j] = target.dataset.removeTask.split(',').map(Number); state.draft.projects[i].tasks.splice(j, 1); state.issues = []; render(); return; }
  if (target.dataset.addTask !== undefined) { state.draft.projects[Number(target.dataset.addTask)].tasks.push(newTask()); render(); return; }
  const action = target.dataset.action;
  if (action === 'dismiss') { state.notice = null; document.querySelector('#notice').outerHTML = notice(); }
  if (action === 'create') location.hash = 'create';
  if (action === 'refresh') await loadView();
  if (action === 'edit-transcript') { state.draft = null; state.issues = []; state.notice = null; render(); }
  if (action === 'add-project') { state.draft.projects.push({ name: '', clientName: '', description: '', managerId: null, deadline: null, tasks: [newTask()] }); render(); }
  if (action === 'load-demo') {
    try { const response = await fetch('/transcript.txt'); if (!response.ok) throw new Error('Could not load the demo transcript.'); state.transcript = await response.text(); render(); }
    catch (error) { notify(error.message, true); }
  }
  if (action === 'logout') {
    state.busy = true;
    try { await api('/auth/logout', {}); state.user = null; state.version++; state.draft = null; state.transcript = ''; state.notice = null; state.busy = false; history.replaceState(null, '', location.pathname); render(); }
    catch (error) { state.busy = false; notify(error.message, true); }
  }
});
window.addEventListener('hashchange', loadView);
window.addEventListener('beforeunload', event => { if (state.busy && state.user) event.preventDefault(); });
try { const data = await api('/auth/me'); state.user = data.user; await loadView(); }
catch (error) { if (error.status !== 401) state.notice = { error: true, message: error.message }; render(); }
