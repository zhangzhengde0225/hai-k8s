// 启动脚本配置组件：管理应用启动脚本分组，支持脚本排序、启用/禁用、编辑、语法高亮（Python/Bash）及分组配置（auto_start、auto_close）。
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import { useState } from 'react';
import { Terminal, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Save, X, FolderPlus, ToggleLeft, ToggleRight } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import Drawer from '../../../../../components/Drawer';

export interface StartupScript {
  id: string;
  group: number;
  name: string;
  command: string;
  language?: 'bash' | 'python';
  run_as?: 'root' | 'ssh_user' | 'frontend';
  enabled?: boolean;
}

export interface GroupConfig {
  name?: string;
  auto_start?: boolean;
  auto_close?: boolean;
  hint?: string;
}

interface Props {
  value?: StartupScript[];
  onChange?: (scripts: StartupScript[]) => void;
  groupConfigs?: Record<string, GroupConfig>;
  onGroupConfigsChange?: (configs: Record<string, GroupConfig>) => void;
  disabled?: boolean;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build the execution command string shown as preview / used at runtime */
export function buildScriptCommand(script: StartupScript): string {
  if (script.language === 'python') {
    const escaped = script.command.replace(/'/g, "'\\''");
    return `python3 -c '${escaped}'`;
  }
  return script.command;
}

function highlight(code: string, lang: 'bash' | 'python') {
  const grammar = lang === 'python' ? Prism.languages.python : Prism.languages.bash;
  if (!grammar) return code;
  return Prism.highlight(code, grammar, lang);
}

const EDITOR_STYLE: React.CSSProperties = {
  fontFamily: '"Fira Code", "Fira Mono", "Consolas", monospace',
  fontSize: 13,
  lineHeight: 1.6,
  minHeight: 220,
};

export default function StartupScriptConfiguration({ value, onChange, groupConfigs = {}, onGroupConfigsChange, disabled = false }: Props) {
  const isControlled = value !== undefined && onChange !== undefined;

  const [internalScripts, setInternalScripts] = useState<StartupScript[]>([]);
  const scripts = isControlled ? value! : internalScripts;
  const setScripts = (updater: StartupScript[] | ((prev: StartupScript[]) => StartupScript[])) => {
    const next = typeof updater === 'function' ? updater(scripts) : updater;
    if (isControlled) onChange!(next);
    else setInternalScripts(next);
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<StartupScript | null>(null);

  // Drawer form state
  const [formGroup, setFormGroup] = useState(1);
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formLanguage, setFormLanguage] = useState<'bash' | 'python'>('bash');
  const [formRunAs, setFormRunAs] = useState<'root' | 'ssh_user' | 'frontend'>('root');

  const groupNums: number[] = [...new Set(scripts.map((s) => s.group))].sort((a, b) => a - b);
  const groupDisplayIdx = new Map<number, number>(groupNums.map((g, i) => [g, i + 1]));
  const scriptsByGroup = (g: number) => scripts.filter((s) => s.group === g);
  const displayNum = (g: number, idxInGroup: number) => `${groupDisplayIdx.get(g)}.${idxInGroup + 1}`;
  const nextGroupNum = () => (groupNums.length > 0 ? Math.max(...groupNums) + 1 : 1);

  const openAddDrawer = (group: number) => {
    if (disabled) return;
    setEditingScript(null);
    setFormGroup(group);
    setFormName('');
    setFormCommand('');
    setFormLanguage('bash');
    setFormRunAs('root');
    setDrawerOpen(true);
  };

  const openEditDrawer = (script: StartupScript) => {
    if (disabled) return;
    setEditingScript(script);
    setFormGroup(script.group);
    setFormName(script.name);
    setFormCommand(script.command);
    setFormLanguage(script.language ?? 'bash');
    setFormRunAs(script.run_as ?? 'root');
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;
    const entry: StartupScript = {
      id: editingScript?.id ?? genId(),
      group: formGroup,
      name: formName,
      command: formCommand,
      language: formLanguage,
      run_as: formRunAs,
    };
    if (editingScript) {
      setScripts((prev) => prev.map((s) => (s.id === editingScript.id ? entry : s)));
    } else {
      setScripts((prev) => [...prev, entry]);
    }
    setDrawerOpen(false);
  };

  const handleDelete = (id: string) => setScripts((prev) => prev.filter((s) => s.id !== id));

  const handleToggleEnabled = (id: string) =>
    setScripts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !(s.enabled ?? true) } : s))
    );

  const handleMove = (group: number, idxInGroup: number, direction: 'up' | 'down') => {
    setScripts((prev) => {
      const next = [...prev];
      const groupIndices = next
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.group === group)
        .map(({ i }) => i);
      const targetIdx = direction === 'up' ? idxInGroup - 1 : idxInGroup + 1;
      if (targetIdx < 0 || targetIdx >= groupIndices.length) return prev;
      const aFlat = groupIndices[idxInGroup];
      const bFlat = groupIndices[targetIdx];
      [next[aFlat], next[bFlat]] = [next[bFlat], next[aFlat]];
      return next;
    });
  };

  const handleDeleteGroup = (group: number) => setScripts((prev) => prev.filter((s) => s.group !== group));

  const toggleGroupConfig = (group: number, key: 'auto_start' | 'auto_close') => {
    const k = String(group);
    const cur = groupConfigs[k] ?? {};
    onGroupConfigsChange?.({ ...groupConfigs, [k]: { ...cur, [key]: !(cur[key] ?? false) } });
  };

  const updateGroupName = (group: number, name: string) => {
    const k = String(group);
    const cur = groupConfigs[k] ?? {};
    onGroupConfigsChange?.({ ...groupConfigs, [k]: { ...cur, name } });
  };

  const updateGroupHint = (group: number, hint: string) => {
    const k = String(group);
    const cur = groupConfigs[k] ?? {};
    onGroupConfigsChange?.({ ...groupConfigs, [k]: { ...cur, hint } });
  };

  return (
    <>
      {/* Prism tomorrow theme — injected as a style tag to avoid global CSS conflicts */}
      <style>{`
        .prism-editor-wrapper { position: relative; }
        .prism-editor-wrapper textarea {
          outline: none !important;
          caret-color: #fff;
        }
        /* tomorrow night palette */
        .token.comment,.token.prolog,.token.doctype,.token.cdata{color:#999}
        .token.punctuation{color:#ccc}
        .token.property,.token.tag,.token.boolean,.token.number,.token.constant,.token.symbol,.token.deleted{color:#f2777a}
        .token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted{color:#99cc99}
        .token.operator,.token.entity,.token.url,.language-css .token.string,.style .token.string{color:#f8f8f2}
        .token.atrule,.token.attr-value,.token.keyword{color:#6699cc}
        .token.function,.token.class-name{color:#f0c674}
        .token.regex,.token.important,.token.variable{color:#f99157}
        .token.important,.token.bold{font-weight:bold}
        .token.italic{font-style:italic}
      `}</style>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">启动脚本配置</h3>
          </div>
          {!disabled && (
            <button
              onClick={() => openAddDrawer(nextGroupNum())}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              新建分组
            </button>
          )}
        </div>

        {groupNums.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">暂无启动脚本</p>
            {!disabled && (
              <p className="text-xs text-gray-400 dark:text-gray-600">
                点击「新建分组」创建，脚本将按{' '}
                <span className="font-mono font-bold">1.1 · 1.2 · 2.1</span> 形式有序排列
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {groupNums.map((g) => {
              const items = scriptsByGroup(g);
              const dispIdx = groupDisplayIdx.get(g)!;

              return (
                <div key={g} className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
                        第 {dispIdx} 组
                      </span>
                      {disabled ? (
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                          {groupConfigs[String(g)]?.name ?? ''}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={groupConfigs[String(g)]?.name ?? ''}
                          onChange={(e) => updateGroupName(g, e.target.value)}
                          placeholder="组名（可选）"
                          className="text-xs font-medium text-gray-800 dark:text-gray-100 bg-transparent border-b border-dashed border-gray-300 dark:border-slate-600 focus:border-blue-400 dark:focus:border-blue-500 outline-none px-0.5 py-0 w-32 placeholder-gray-400 dark:placeholder-slate-500"
                        />
                      )}
                      {/* Group config toggles */}
                      {(['auto_start', 'auto_close'] as const).map((key) => {
                        const cfg = groupConfigs[String(g)] ?? {};
                        const on = cfg[key] ?? false;
                        const label = key === 'auto_start' ? '自动启动' : '启动关闭';
                        return (
                          <button
                            key={key}
                            onClick={() => !disabled && toggleGroupConfig(g, key)}
                            disabled={disabled}
                            title={key === 'auto_start' ? '点击执行命令时自动运行' : '执行成功后自动关闭弹窗'}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                              on
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                            } ${disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {!disabled && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openAddDrawer(g)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          添加脚本
                        </button>
                        {items.length === 0 && (
                          <button
                            onClick={() => handleDeleteGroup(g)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                            title="删除空分组"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Group hint */}
                  {(!disabled || groupConfigs[String(g)]?.hint) && (
                    <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30">
                      {disabled ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
                          {groupConfigs[String(g)]?.hint}
                        </p>
                      ) : (
                        <textarea
                          value={groupConfigs[String(g)]?.hint ?? ''}
                          onChange={(e) => updateGroupHint(g, e.target.value)}
                          placeholder="为此组添加提示词（可选）"
                          rows={2}
                          className="w-full text-xs text-amber-800 dark:text-amber-200 bg-transparent placeholder-amber-400 dark:placeholder-amber-600 outline-none resize-none"
                        />
                      )}
                    </div>
                  )}

                  {/* Scripts */}
                  {items.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-gray-400 dark:text-gray-600 text-center">
                      此分组暂无脚本
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                      {items.map((script, idxInGroup) => {
                        const num = displayNum(g, idxInGroup);
                        const isFirst = idxInGroup === 0;
                        const isLast = idxInGroup === items.length - 1;
                        const lang = script.language ?? 'bash';
                        const previewLine = buildScriptCommand(script).split('\n')[0];

                        const isEnabled = script.enabled ?? true;

                        return (
                          <div
                            key={script.id}
                            className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/60 group transition-colors ${!isEnabled ? 'opacity-50' : ''}`}
                          >
                            {/* Number badge */}
                            <span className="flex-shrink-0 min-w-[2.5rem] text-center text-sm font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                              {num}
                            </span>

                            {/* Name + badges + command preview */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {script.name}
                                </span>
                                {/* Language badge */}
                                <span
                                  className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-mono ${
                                    lang === 'python'
                                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                  }`}
                                >
                                  {lang}
                                </span>
                                {/* run_as badge */}
                                <span
                                  className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-mono ${
                                    (script.run_as ?? 'root') === 'root'
                                      ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                      : (script.run_as ?? 'root') === 'frontend'
                                      ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                  }`}
                                >
                                  {script.run_as ?? 'root'}
                                </span>
                              </div>
                              {script.command && (
                                <div className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
                                  {previewLine}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            {!disabled && (
                              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleMove(g, idxInGroup, 'up')}
                                  disabled={isFirst}
                                  title="上移"
                                  className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMove(g, idxInGroup, 'down')}
                                  disabled={isLast}
                                  title="下移"
                                  className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleEnabled(script.id)}
                                  title={isEnabled ? '禁用' : '启用'}
                                  className={`p-1.5 rounded transition-colors ${isEnabled ? 'text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400' : 'text-yellow-500 dark:text-yellow-400 hover:text-gray-400'}`}
                                >
                                  {isEnabled
                                    ? <ToggleRight className="w-3.5 h-3.5" />
                                    : <ToggleLeft className="w-3.5 h-3.5" />
                                  }
                                </button>
                                <button
                                  onClick={() => openEditDrawer(script)}
                                  title="编辑"
                                  className="p-1.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(script.id)}
                                  title="删除"
                                  className="p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          editingScript
            ? '编辑脚本'
            : `添加脚本到第 ${groupDisplayIdx.get(formGroup) ?? formGroup} 组`
        }
      >
        <div className="space-y-5">
          {/* Group selector (edit only) */}
          {editingScript && groupNums.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                所属分组
              </label>
              <select
                value={formGroup}
                onChange={(e) => setFormGroup(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {groupNums.map((g) => (
                  <option key={g} value={g}>
                    第 {groupDisplayIdx.get(g)} 组
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              脚本名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="如：初始化网关"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Run as */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              运行身份
            </label>
            <div className="flex gap-3">
              {(['root', 'ssh_user', 'frontend'] as const).map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    formRunAs === opt
                      ? opt === 'root'
                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                        : opt === 'frontend'
                        ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="run_as"
                    value={opt}
                    checked={formRunAs === opt}
                    onChange={() => setFormRunAs(opt)}
                    className="sr-only"
                  />
                  <span className="font-mono font-medium">{opt}</span>
                </label>
              ))}
            </div>
            {formRunAs === 'frontend' && (
              <p className="mt-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1.5">
                前端执行：命令在浏览器端运行，不发送给容器。
                以 <span className="font-mono">http://</span> 或 <span className="font-mono">https://</span> 开头的命令会在新标签页打开。
                支持模板变量：<span className="font-mono">{'{{bound_ip}}'}</span>、<span className="font-mono">{'{{instance_id}}'}</span>
              </p>
            )}
          </div>

          {/* Script command editor */}
          <div>
            {/* Language tabs + label row */}
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                脚本内容
              </label>
              <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-slate-600 text-xs">
                {(['bash', 'python'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setFormLanguage(lang)}
                    className={`px-3 py-1 font-mono transition-colors ${
                      formLanguage === lang
                        ? lang === 'python'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-700 text-white'
                        : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Python execution preview */}
            {formLanguage === 'python' && formCommand.trim() && (
              <div className="mb-2 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex-shrink-0 font-medium">执行为:</span>
                <code className="font-mono text-[11px] text-green-700 dark:text-green-400 break-all">
                  python3 -c '<span className="opacity-60">{formCommand.split('\n')[0]}{formCommand.includes('\n') ? '...' : ''}</span>'
                </code>
              </div>
            )}

            {/* Code editor */}
            <div className="prism-editor-wrapper rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600">
              <Editor
                value={formCommand}
                onValueChange={setFormCommand}
                highlight={(code) => highlight(code, formLanguage)}
                padding={12}
                style={EDITOR_STYLE}
                className="bg-[#1e1e2e] text-[#cdd6f4]"
                placeholder={
                  formLanguage === 'python'
                    ? 'import os\nprint("hello from python")'
                    : '#!/bin/bash\necho "hello"'
                }
                readOnly={disabled}
                textareaClassName="focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={!formName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
              取消
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
