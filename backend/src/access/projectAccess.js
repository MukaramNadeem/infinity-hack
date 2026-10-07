import {AppError} from '../lib/errors.js';
export function scope(user) {
  if(user.role==='ADMIN') return {project:'$1::text IS NOT NULL',task:'$1::text IS NOT NULL',mine:'FALSE AND $1::text IS NOT NULL'};
  if(user.role==='MANAGER') return {project:'p.manager_id=$1',task:'p.manager_id=$1',mine:'FALSE AND $1::text IS NOT NULL'};
  if(user.role==='AGENT') return {project:'EXISTS (SELECT 1 FROM tasks own WHERE own.project_id=p.id AND own.assignee_id=$1)',task:'t.assignee_id=$1',mine:'t.assignee_id=$1'};
  throw new AppError(403,'FORBIDDEN','Your account cannot access projects.');
}
export async function requireProjectAccess(pool,user,id) {
  const {rows}=await pool.query(`SELECT (${scope(user).project}) AS allowed FROM projects p WHERE p.id=$2`,[user.id,id]);
  if(!rows[0]) throw new AppError(404,'NOT_FOUND','This project does not exist.');
  if(!rows[0].allowed) throw new AppError(403,'FORBIDDEN','You do not have access to this project.');
}
export async function listProjects(pool,user,id) {
  const rules=scope(user);
  const {rows}=await pool.query(`SELECT p.id,p.name,p.client_name AS "clientName",p.description,p.deadline,
    json_build_object('id',m.id,'name',m.name) AS manager,
    COUNT(t.id) AS "taskCount",COALESCE(SUM(t.estimated_hours),0) AS "totalEstimatedHours"
    FROM projects p JOIN users m ON m.id=p.manager_id
    LEFT JOIN tasks t ON t.project_id=p.id AND (${rules.task})
    WHERE (${rules.project}) ${id ? 'AND p.id=$2' : ''}
    GROUP BY p.id,m.id ORDER BY p.deadline,p.name`,id ? [user.id,id] : [user.id]);
  return rows;
}
export async function listTasks(pool,user,{projectId,mine=false}={}) {
  const rule=mine ? scope(user).mine : scope(user).task;
  const {rows}=await pool.query(`SELECT t.id,t.project_id AS "projectId",t.title,t.description,t.deadline,t.estimated_hours AS "estimatedHours",
    json_build_object('id',a.id,'name',a.name,'specialization',a.specialization) AS assignee
    ${mine ? ",json_build_object('id',p.id,'name',p.name,'clientName',p.client_name,'deadline',p.deadline,'manager',json_build_object('id',m.id,'name',m.name)) AS project" : ''}
    FROM tasks t JOIN projects p ON p.id=t.project_id JOIN users a ON a.id=t.assignee_id JOIN users m ON m.id=p.manager_id
    WHERE (${rule}) ${projectId ? 'AND p.id=$2' : ''} ORDER BY t.deadline,t.title`,projectId ? [user.id,projectId] : [user.id]);
  return rows;
}
