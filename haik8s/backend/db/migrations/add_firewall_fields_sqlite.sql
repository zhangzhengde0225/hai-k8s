-- SQLite 迁移脚本：添加防火墙相关字段到 application_configs 表
-- Migration: Add firewall configuration fields (SQLite version)

-- SQLite 不支持 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 在一条语句中
-- 需要逐条执行，并且要处理已存在的情况

-- 添加 enable_firewall 字段（默认启用）
ALTER TABLE application_configs ADD COLUMN enable_firewall BOOLEAN DEFAULT 1;

-- 添加 firewall_rules 字段（JSON 字符串）
ALTER TABLE application_configs ADD COLUMN firewall_rules TEXT;

-- 添加 firewall_default_policy 字段（默认 DROP）
ALTER TABLE application_configs ADD COLUMN firewall_default_policy VARCHAR(10) DEFAULT 'DROP';

-- 更新现有记录，设置默认值（SQLite 中 TRUE = 1）
UPDATE application_configs
SET enable_firewall = 1,
    firewall_default_policy = 'DROP'
WHERE enable_firewall IS NULL;
