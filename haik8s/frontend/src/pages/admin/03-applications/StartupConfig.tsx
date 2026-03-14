// 应用启动脚本配置子组件：为 claw 类应用配置有序启动脚本分组（含组名、auto_start、auto_close及脚本列表），数据写入 startup_scripts_config 字段。
import type { ApplicationDefinition } from '../../../types';
import StartupScriptConfiguration, {
  type StartupScript,
  type GroupConfig,
} from './StartupScriptConfiguration';

interface Props {
  application: ApplicationDefinition;
  editData: Record<string, any>;
  setEditData: (data: Record<string, any>) => void;
  isEditing: boolean;
}

export default function StartupConfig({ application, editData, setEditData, isEditing }: Props) {
  const scripts: StartupScript[] = editData.startup_scripts_config?.scripts || [];
  const groupConfigs: Record<string, GroupConfig> = editData.startup_scripts_config?.group_configs ?? {};

  const handleScriptsChange = (next: StartupScript[]) => {
    setEditData({
      ...editData,
      startup_scripts_config: { ...editData.startup_scripts_config, scripts: next },
    });
  };

  const handleGroupConfigsChange = (next: Record<string, GroupConfig>) => {
    setEditData({
      ...editData,
      startup_scripts_config: { ...editData.startup_scripts_config, group_configs: next },
    });
  };

  const isClawApp = (application.app_id || '').toLowerCase().includes('claw');

  return (
    <div className="space-y-6">
      {isClawApp && (
        <StartupScriptConfiguration
          value={scripts}
          onChange={handleScriptsChange}
          groupConfigs={groupConfigs}
          onGroupConfigsChange={handleGroupConfigsChange}
          disabled={!isEditing}
        />
      )}
    </div>
  );
}
