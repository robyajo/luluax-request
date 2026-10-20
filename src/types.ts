export interface RequestParamHeader {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface RequestItem {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: RequestParamHeader[];
  params: RequestParamHeader[];
  bodyType: 'none' | 'json' | 'urlencoded' | 'raw';
  bodyContent: string;
  authType: 'none' | 'bearer' | 'basic' | 'apikey';
  authConfig?: Record<string, unknown>;
  collectionId?: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  description?: string;
  items: RequestItem[];
  createdAt?: number;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface EnvironmentItem {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  isDefault?: boolean;
}

export interface HistoryItem {
  id?: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
  responseSize: number;
  executedAt: number;
}

export interface MockItem {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  statusCode: number;
  delayMs: number;
  responseBody: string;
  enabled: boolean;
  createdAt?: number;
}

export interface RuleItem {
  id: string;
  name: string;
  ruleType: 'redirect' | 'modify_headers' | 'modify_response' | 'delay';
  sourceUrlPattern: string;
  targetUrl?: string;
  headersToModify?: Array<{ key: string; value: string; action: 'set' | 'remove' }>;
  statusCode?: number;
  responseBody?: string;
  delayMs?: number;
  enabled: boolean;
  createdAt?: number;
}

export interface SettingsData {
  cloudApiUrl?: string;
  cloudSyncKey?: string;
  timeoutMs?: number;
  followRedirects?: boolean;
  verifySsl?: boolean;
}
