import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enContainer from './locales/en/container.json';
import enAdmin from './locales/en/admin.json';
import enErrors from './locales/en/errors.json';

import zhCommon from './locales/zh/common.json';
import zhAuth from './locales/zh/auth.json';
import zhContainer from './locales/zh/container.json';
import zhAdmin from './locales/zh/admin.json';
import zhErrors from './locales/zh/errors.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        container: enContainer,
        admin: enAdmin,
        errors: enErrors
      },
      zh: {
        common: zhCommon,
        auth: zhAuth,
        container: zhContainer,
        admin: zhAdmin,
        errors: zhErrors
      }
    },
    lng: localStorage.getItem('language') || 'zh',
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
