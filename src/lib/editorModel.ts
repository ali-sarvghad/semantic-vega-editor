export type PanelId = 'render' | 'cohort-labels' | 'ssvg-preview';

export interface EditorLog {
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: string;
  lineNumber?: number;
  path?: string;
}

export const initialLogs: EditorLog[] = [
  { level: 'info', message: 'Semantic Vega Editor ready', timestamp: '2:34:11 PM' }
];
