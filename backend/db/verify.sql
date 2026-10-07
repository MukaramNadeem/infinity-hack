-- Read-only checks for the configured development database.
SHOW port;
SELECT id, name, role FROM users ORDER BY id;
SELECT count(*) AS user_count FROM users;
SELECT p.name, p.deadline, count(t.id) AS task_count,
       coalesce(sum(t.estimated_hours), 0) AS total_estimated_hours
FROM projects p LEFT JOIN tasks t ON t.project_id = p.id
GROUP BY p.id ORDER BY p.name;
SELECT p.name AS project, t.title, u.name AS assignee,
       t.deadline, t.estimated_hours
FROM tasks t JOIN projects p ON p.id = t.project_id
JOIN users u ON u.id = t.assignee_id
ORDER BY p.name, t.deadline, t.title;
