-- Migration: Add cluster info fields and HepAI API key to users table
-- Date: 2026-03-02
-- Description: 添加集群账号信息字段（cluster_username/uid/gid/home_dir）及 HepAI API key，来源为IHEP SSO用户信息接口
-- Database: SQLite

ALTER TABLE users ADD COLUMN cluster_username VARCHAR;
ALTER TABLE users ADD COLUMN cluster_uid INTEGER;
ALTER TABLE users ADD COLUMN cluster_gid INTEGER;
ALTER TABLE users ADD COLUMN cluster_home_dir VARCHAR;
ALTER TABLE users ADD COLUMN api_key_of_hepai VARCHAR;
CREATE INDEX IF NOT EXISTS ix_users_cluster_username ON users (cluster_username);
