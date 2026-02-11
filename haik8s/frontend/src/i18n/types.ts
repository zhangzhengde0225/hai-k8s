import 'i18next';
import common from './locales/en/common.json';
import auth from './locales/en/auth.json';
import container from './locales/en/container.json';
import admin from './locales/en/admin.json';
import errors from './locales/en/errors.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      container: typeof container;
      admin: typeof admin;
      errors: typeof errors;
    };
  }
}
