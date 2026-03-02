-- Migration: Add volume_mounts field to application_configs table
-- Date: 2026-02-21
-- Description: 添加 volume_mounts 字段用于存储挂载点列表（JSON格式）
-- Database: SQLite

-- Add new column to application_configs table
ALTER TABLE application_configs ADD COLUMN volume_mounts VARCHAR;
