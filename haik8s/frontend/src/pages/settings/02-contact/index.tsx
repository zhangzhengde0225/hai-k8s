// 关于我们页面：显示系统版本及联系方式
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import client from '../../../api/client';

export default function ContactUs() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    client.get('/version').then((res) => setVersion(res.data.version)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {t('aboutUs', '关于我们')}
        </h1>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4 md:p-6">
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-2">
          <p className="text-sm md:text-base text-gray-700 dark:text-slate-300">
            <span className="font-semibold">应用名称：</span>
            <span className="text-blue-600 dark:text-blue-400">HAI-K8S</span>
          </p>
          <p className="text-sm md:text-base text-gray-700 dark:text-slate-300">
            <span className="font-semibold">开发者：</span>
            <span className="text-blue-600 dark:text-blue-400">高能所计算中心</span>
          </p>
          {version && (
            <p className="text-sm md:text-base text-gray-700 dark:text-slate-300">
              <span className="font-semibold">版本号：</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">v{version}</span>
            </p>
          )}
        </div>

        <p className="text-sm md:text-base text-gray-700 dark:text-slate-300 mb-6 leading-relaxed">
          {t('contactUsDesc')}
        </p>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          {t('contactUsWechat')}
        </p>
        {/* QR code placeholder — replace the div below with <img src="..." alt="WeChat QR" /> */}
        <div
          className="inline-flex items-center justify-center w-[200px] h-[200px] border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-xs text-gray-400 dark:text-slate-500 select-none"
        >
          {t('qrCodePlaceholder')}
        </div>
      </div>
    </div>
  );
}
