const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

function apiBaseUrl() {
  if (CONFIGURED_API_BASE_URL) {
    return CONFIGURED_API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.port === '3000' ? 'http://localhost:8080' : window.location.origin;
  }
  return 'http://localhost:8080';
}

export type ApiPayload<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: unknown;
};

export async function callApi<T = unknown>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const payload = (await response.json()) as ApiPayload<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '操作失败，请稍后重试');
  }
  return payload;
}

/** 管理端 CSV 导出类型（与 /api/admin/export 的 type 参数一致）。 */
export type CsvExportType = 'users' | 'redeems' | 'transfers';

/**
 * 触发浏览器下载管理端 CSV。后端以 Content-Disposition: attachment 响应，
 * 直接导航到导出地址即可下载，页面不会发生跳转。
 */
export function downloadCsv(type: CsvExportType) {
  window.location.assign(`${apiBaseUrl()}/api/admin/export?type=${encodeURIComponent(type)}`);
}
