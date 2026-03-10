-- 添加防火墙相关字段到 application_configs 表
-- Migration: Add firewall configuration fields

-- 添加 enable_firewall 字段（默认启用）
ALTER TABLE application_configs
ADD COLUMN IF NOT EXISTS enable_firewall BOOLEAN DEFAULT TRUE;

-- 添加 firewall_rules 字段（JSON 字符串）
ALTER TABLE application_configs
ADD COLUMN IF NOT EXISTS firewall_rules TEXT;

-- 添加 firewall_default_policy 字段（默认 DROP）
ALTER TABLE application_configs
ADD COLUMN IF NOT EXISTS firewall_default_policy VARCHAR(10) DEFAULT 'DROP';

-- 更新现有记录，设置默认值
UPDATE application_configs
SET enable_firewall = TRUE,
    firewall_default_policy = 'DROP'
WHERE enable_firewall IS NULL;

-- 添加注释
COMMENT ON COLUMN application_configs.enable_firewall IS '是否启用防火墙';
COMMENT ON COLUMN application_configs.firewall_rules IS '防火墙规则列表（JSON格式）';
COMMENT ON COLUMN application_configs.firewall_default_policy IS '默认防火墙策略（DROP/ACCEPT）';
