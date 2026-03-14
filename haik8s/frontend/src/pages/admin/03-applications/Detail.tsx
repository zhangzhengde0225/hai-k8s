// 管理员-应用配置编辑页面：编辑指定应用的完整配置，含基本信息配置（BasicConfig）和启动脚本配置（StartupConfig）两个标签页，支持未保存离开拦截。
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Loader2,
  Settings2,
  Terminal,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import client from '../../../api/client';
import type { ApplicationDefinition } from '../../../types';
import BasicConfig from './BasicConfig';
import StartupConfig from './StartupConfig';

interface Props {
  isEditing?: boolean;
}

export default function AdminApplicationDetail({ isEditing = true }: Props) {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [application, setApplication] = useState<ApplicationDefinition | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const savedDataRef = useRef<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'startup'>(
    (searchParams.get('tab') as 'basic' | 'startup') || 'basic'
  );

  // Unsaved changes dialog state
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const pendingNavRef = useRef<string | null>(null);

  const isDirty = JSON.stringify(editData) !== savedDataRef.current;

  // Wrap navigate to intercept when dirty
  const safeNavigate = useCallback(
    (to: string) => {
      if (isEditing && isDirty) {
        pendingNavRef.current = to;
        setLeaveDialogOpen(true);
      } else {
        navigate(to);
      }
    },
    [isEditing, isDirty, navigate]
  );

  // Browser back/forward button
  useEffect(() => {
    if (!isEditing) return;
    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState(null, '', window.location.href);
        setLeaveDialogOpen(true);
        pendingNavRef.current = null;
      }
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditing, isDirty]);

  // Browser tab close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isEditing && isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditing, isDirty]);

  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (activeTab === 'basic') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', activeTab);
    }
    setSearchParams(newParams, { replace: true });
  }, [activeTab]);

  useEffect(() => {
    if (appId) {
      loadApplication();
    }
  }, [appId]);

  const loadApplication = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const res = await client.get(`/admin/applications/${appId}`);
      setApplication(res.data);
      const data = {
        app_id: res.data.app_id,
        name: res.data.name,
        description: res.data.description || '',
        version: res.data.version,
        image_prefix: res.data.image_prefix,
        default_replicas: res.data.default_replicas,
        is_visible: res.data.is_visible,
        recommended_cpu: res.data.recommended_cpu,
        recommended_memory: res.data.recommended_memory,
        recommended_gpu: res.data.recommended_gpu,
        default_firewall_rules: res.data.default_firewall_rules || [],
        startup_scripts_config: res.data.startup_scripts_config || {},
        models_config_template: res.data.models_config_template || {},
        available_images: res.data.available_images || [],
      };
      setEditData(data);
      savedDataRef.current = JSON.stringify(data);
    } catch (err) {
      toast.error('加载应用配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!appId || saving || !isDirty) return;
    setSaving(true);
    try {
      await client.put(`/admin/applications/${appId}`, editData);
      toast.success('应用配置已保存');
      await loadApplication();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmLeave = () => {
    setLeaveDialogOpen(false);
    if (pendingNavRef.current) {
      navigate(pendingNavRef.current);
    }
    pendingNavRef.current = null;
  };

  const handleCancelLeave = () => {
    setLeaveDialogOpen(false);
    pendingNavRef.current = null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-slate-400">
        应用不存在
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => safeNavigate('/admin/applications')}
                className="p-1.5 rounded-lg text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
              >
                <ArrowLeft size={18} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-400 dark:bg-clip-text dark:text-transparent truncate">
                {editData.name || application.name} {isEditing ? '配置编辑' : '配置详情'}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  保存
                </button>
              )}
              <button
                onClick={() => loadApplication()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 bg-gray-200 dark:bg-slate-800 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                刷新
              </button>
            </div>
          </div>
        </div>

        {/* Main content card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl">
          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-4 border-b border-gray-200 dark:border-slate-700/50 overflow-x-auto">
            <button
              onClick={() => setActiveTab('basic')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Settings2 size={13} />
              基本配置
            </button>
            <button
              onClick={() => setActiveTab('startup')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'startup'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <Terminal size={13} />
              启动配置
            </button>
          </div>

          {/* Tab content */}
          <div className="p-4">
            {activeTab === 'basic' && (
              <BasicConfig
                application={application}
                editData={editData}
                setEditData={setEditData}
                isEditing={isEditing}
              />
            )}
            {activeTab === 'startup' && (
              <StartupConfig
                application={application}
                editData={editData}
                setEditData={setEditData}
                isEditing={isEditing}
              />
            )}
          </div>
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {leaveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">有未保存的更改</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  离开此页面将丢失所有未保存的更改，确定要离开吗？
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmLeave}
                className="flex-1 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                离开
              </button>
              <button
                onClick={handleCancelLeave}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                留下
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
