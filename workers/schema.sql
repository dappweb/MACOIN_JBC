DROP TABLE IF EXISTS announcements;
CREATE TABLE announcements (
    language TEXT PRIMARY KEY,
    content TEXT,
    updated_at INTEGER
);
