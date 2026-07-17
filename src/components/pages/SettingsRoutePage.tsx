"use client";

import type React from 'react';
import { SettingsPage } from '@/components/Settings/SettingsPage';

export type SettingsRoutePageProps = React.ComponentProps<typeof SettingsPage>;

export function SettingsRoutePage(props: SettingsRoutePageProps) {
  return <SettingsPage {...props} />;
}
