import type { FC } from 'react';
import type { AppDetailsProps } from '../types';
import OpenClawDetails from './tab2_OpenClawDetails';

export const APP_DETAILS_COMPONENTS: Record<string, FC<AppDetailsProps>> = {
  openclaw: OpenClawDetails,
  // Future applications can be added here:
  // opendrsai: OpenDrSaiDetails,
};

export function getAppDetailsComponent(appId: string): FC<AppDetailsProps> | null {
  return APP_DETAILS_COMPONENTS[appId] || null;
}
