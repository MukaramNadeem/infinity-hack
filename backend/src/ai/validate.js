const object=value=>value && typeof value==='object' && !Array.isArray(value) ? value : {};
const text=value=>typeof value==='string' ? value.trim() : '';
const id=value=>text(value).toUpperCase() || null;
export function validDate(value,year) {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0,4)!==year) return false;
  const parsed=new Date(value+'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
}
export function validateDraft(raw,users,meetingDate) {
  const errors=[],draft={projects:[]},directory=new Map((Array.isArray(users) ? users : []).map(u=>[u.id,u]));
  const add=(path,message)=>errors.push({path,message});
  const year=String(meetingDate).slice(0,4);
  const checkOwner=(value,role,path,label)=>{
    if(!value) add(path,`${label} could not be determined from the transcript.`);
    else if(!directory.has(value)) add(path,`${label} is not in the team directory.`);
    else if(directory.get(value).role!==role) add(path,`${label} must have the ${role} role.`);
  };
  const projects=object(raw).projects;
  if(!Array.isArray(projects) || !projects.length) add('projects','Include at least one project.');
  const names=new Set();
  for(const [i,entry] of (Array.isArray(projects) ? projects : []).entries()) {
    const p=object(entry),path=`projects[${i}]`;
    const normalized={name:text(p.name),clientName:text(p.clientName),description:text(p.description),managerId:id(p.managerId),deadline:text(p.deadline)||null,tasks:[]};
    draft.projects.push(normalized);
    for(const field of ['name','clientName']) if(!normalized[field]) add(`${path}.${field}`,field==='name' ? 'Enter the project name.' : 'Enter the client name.');
    checkOwner(normalized.managerId,'MANAGER',`${path}.managerId`,'Manager');
    const projectDateOK=validDate(normalized.deadline,year);
    if(!projectDateOK) add(`${path}.deadline`,`Enter a valid project deadline in ${year} using YYYY-MM-DD.`);
    const key=JSON.stringify([normalized.name.toLowerCase(),normalized.clientName.toLowerCase()]);
    if(names.has(key)) add(`${path}.name`,'This project and client appear more than once.');names.add(key);
    if(!Array.isArray(p.tasks) || !p.tasks.length) add(`${path}.tasks`,'Include at least one task for this project.');
    for(const [j,task] of (Array.isArray(p.tasks) ? p.tasks : []).entries()) {
      const t=object(task),taskPath=`${path}.tasks[${j}]`;
      const hours=typeof t.estimatedHours==='number' ? t.estimatedHours : typeof t.estimatedHours==='string' && t.estimatedHours.trim() ? Number(t.estimatedHours) : NaN;
      const item={title:text(t.title),description:text(t.description),assigneeId:id(t.assigneeId),deadline:text(t.deadline)||null,estimatedHours:Number.isFinite(hours) ? hours : null};
      normalized.tasks.push(item);
      if(!item.title) add(`${taskPath}.title`,'Enter the task title.');
      checkOwner(item.assigneeId,'AGENT',`${taskPath}.assigneeId`,'Assignee');
      if(!validDate(item.deadline,year)) add(`${taskPath}.deadline`,`Enter a valid task deadline in ${year} using YYYY-MM-DD.`);
      else if(projectDateOK && item.deadline>normalized.deadline) add(`${taskPath}.deadline`,`Task deadline ${item.deadline} is after the project deadline ${normalized.deadline}.`);
      if(!Number.isFinite(hours) || hours<=0 || hours>1000) add(`${taskPath}.estimatedHours`,'Estimated hours must be a number greater than 0 and no more than 1000.');
    }
  }
  return {ok:errors.length===0,errors,draft};
}
