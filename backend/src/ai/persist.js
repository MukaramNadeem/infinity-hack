import {randomUUID} from 'node:crypto';
export async function persistDraft(pool,draft) {
  const client=await pool.connect(),result={projectCount:0,taskCount:0,projects:[]};
  try {
    await client.query('BEGIN');
    for(const p of draft.projects) {
      const id=randomUUID();
      await client.query('INSERT INTO projects(id,name,client_name,description,manager_id,deadline) VALUES($1,$2,$3,$4,$5,$6)',[id,p.name,p.clientName,p.description,p.managerId,p.deadline]);
      for(const t of p.tasks) await client.query('INSERT INTO tasks(id,project_id,title,description,assignee_id,deadline,estimated_hours) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,t.title,t.description,t.assigneeId,t.deadline,t.estimatedHours]);
      result.projects.push({id,name:p.name,clientName:p.clientName,managerId:p.managerId,deadline:p.deadline,taskCount:p.tasks.length});
      result.projectCount++;result.taskCount+=p.tasks.length;
    }
    await client.query('COMMIT');return result;
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
