-- Cap objects in the private capture bucket (PDF / note-image signed PUTs
-- never pass through the FastAPI body limit). 25 MiB stops 100MB bombs
-- without breaking typical academic papers. No-ops if the dashboard-created
-- bucket is missing in a local project.
UPDATE storage.buckets
SET file_size_limit = 26214400
WHERE id = 'atlas-artifacts';
