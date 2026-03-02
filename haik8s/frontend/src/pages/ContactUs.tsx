import { useTranslation } from 'react-i18next';

export default function ContactUs() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {t('contactUs')}
        </h1>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-4 md:p-6">
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
