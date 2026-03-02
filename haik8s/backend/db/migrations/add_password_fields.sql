-- Add root_password and user_password fields to application_configs
-- root_password: NULL means auto-generate at launch time
-- user_password: NULL means use the same password as root (whether stored or auto-generated)
ALTER TABLE application_configs ADD COLUMN root_password TEXT;
ALTER TABLE application_configs ADD COLUMN user_password TEXT;
