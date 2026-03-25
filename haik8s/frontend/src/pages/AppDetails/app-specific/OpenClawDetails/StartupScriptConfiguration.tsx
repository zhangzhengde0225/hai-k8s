import { useState } from 'react';
import { Terminal, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Save, X } from 'lucide-react';
import Drawer from '../../../../components/Drawer';

interface StartupScript {
  id: string;
  group: number;
  name: string;
  command: string;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function StartupScriptConfiguration() {
  const [scripts, setScripts] = useState<StartupScript[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<StartupScript | null>(null);

  // Drawer form state
  const [formGroup, setFormGroup] = useState(1);
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');

  // Build grouped display: Map<groupNum, {script, idxInGroup}[]>, sorted by group
  const groupedDisplay: [number, { script: StartupScript; idxInGroup: number }[]][] = (() => {
    const map = new Map<number, StartupScript[]>();
    scripts.forEach((s) => {
      if (!map.has(s.group)) map.set(s.group, []);
      map.get(s.group)!.push(s);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([g, items], _gIdx) => [
        g,
        items.map((script, idxInGroup) => ({ script, idxInGroup })),
      ]);
  })();

  const openAddDrawer = () => {
    setEditingScript(null);
    const maxGroup = scripts.length > 0 ? Math.max(...scripts.map((s) => s.group)) : 1;
    setFormGroup(maxGroup);
    setFormName('');
    setFormCommand('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (script: StartupScript) => {
    setEditingScript(script);
    setFormGroup(script.group);
    setFormName(script.name);
    setFormCommand(script.command);
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;
    if (editingScript) {
      setScripts((prev) =>
        prev.map((s) =>
          s.id === editingScript.id
            ? { ...s, group: formGroup, name: formName, command: formCommand }
            : s,
        ),
      );
    } else {
      setScripts((prev) => [
        ...prev,
        { id: genId(), group: formGroup, name: formName, command: formCommand },
      ]);
    }
    setDrawerOpen(false);
  };

  const handleDelete = (id: string) => {
    setScripts((prev) => prev.filter((s) => s.id !== id));
  };

  // Move within the same group (swaps in underlying flat array)
  const handleMove = (group: number, idxInGroup: number, direction: 'up' | 'down') => {
    setScripts((prev) => {
      const next = [...prev];
      // indices of this group in the flat array
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

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">启动脚本配置</h3>
          </div>
          <button
            onClick={openAddDrawer}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加脚本
          </button>
        </div>

        {scripts.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            暂无启动脚本，点击「添加脚本」创建
          </div>
        ) : (
          <div className="space-y-2">
            {groupedDisplay.map(([groupNum, items], gIdx) => (
              <div key={groupNum}>
                {/* Group separator (skip first) */}
                {gIdx > 0 && (
                  <div className="border-t border-dashed border-gray-200 dark:border-slate-700 my-2" />
                )}

                <div className="space-y-1">
                  {items.map(({ script, idxInGroup }) => {
                    const displayNum = `${groupNum}.${idxInGroup + 1}`;
                    const isFirst = idxInGroup === 0;
                    const isLast = idxInGroup === items.length - 1;

                    return (
                      <div
                        key={script.id}
                        className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg group hover:bg-gray-100 dark:hover:bg-slate-750 transition-colors"
                      >
                        {/* Number badge */}
                        <span className="w-9 flex-shrink-0 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                          {displayNum}
                        </span>

                        {/* Name + command preview */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {script.name}
                          </div>
                          {script.command && (
                            <div className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
                              {script.command.split('\n')[0]}
                            </div>
                          )}
                        </div>

                        {/* Action buttons (always visible on mobile, hover on desktop) */}
                        <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleMove(groupNum, idxInGroup, 'up')}
                            disabled={isFirst}
                            title="上移"
                            className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMove(groupNum, idxInGroup, 'down')}
                            disabled={isLast}
                            title="下移"
                            className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingScript ? '编辑脚本' : '添加脚本'}
      >
        <div className="space-y-5">
          {/* Group number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              分组编号
            </label>
            <input
              type="number"
              min={1}
              value={formGroup}
              onChange={(e) => setFormGroup(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              同一分组内的脚本按顺序执行，显示为 1.x、2.x 等
            </p>
          </div>

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
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Command */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              脚本命令
            </label>
            <textarea
              value={formCommand}
              onChange={(e) => setFormCommand(e.target.value)}
              placeholder="输入 shell 命令..."
              rows={10}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
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
