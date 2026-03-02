-- Migration: Add user sync fields to application_configs table
-- Date: 2026-02-21
-- Description: 添加用户同步配置字段（sync_user, user_uid, user_gid, user_home_dir, enable_sudo）
-- Database: SQLite

-- Add new columns to application_configs table
ALTER TABLE application_configs ADD COLUMN sync_user BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE application_configs ADD COLUMN user_uid INTEGER;
ALTER TABLE application_configs ADD COLUMN user_gid INTEGER;
ALTER TABLE application_configs ADD COLUMN user_home_dir VARCHAR;
ALTER TABLE application_configs ADD COLUMN enable_sudo BOOLEAN NOT NULL DEFAULT 1;
