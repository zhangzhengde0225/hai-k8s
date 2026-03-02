-- Migration: Add bound_ip field to application_configs table
-- Date: 2026-02-21
-- Description: 添加 bound_ip 字段用于存储绑定的IP地址
-- Database: SQLite

-- Add new column to application_configs table
ALTER TABLE application_configs ADD COLUMN bound_ip VARCHAR;
