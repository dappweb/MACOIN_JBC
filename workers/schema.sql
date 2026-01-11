DROP TABLE IF EXISTS announcements;
CREATE TABLE announcements (
    language TEXT PRIMARY KEY,
    content TEXT,
    updated_at INTEGER
);

-- 等级覆盖表：管理员可以手动设置用户显示的等级
DROP TABLE IF EXISTS level_overrides;
CREATE TABLE level_overrides (
    address TEXT PRIMARY KEY,
    level INTEGER NOT NULL,
    updated_at INTEGER
);
