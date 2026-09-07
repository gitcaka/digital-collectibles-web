import AdminConsole from '@/components/admin-console';

/**
 * 运营控制台唯一入口：/admin 及 /admin/<section>[/new|/<id>] 全部命中本可选 catch-all。
 * 相比「每 section 一个 page.tsx」，任意后台 URL 都渲染同一个 page 组件，
 * 底部导航切换不经过 vinext 路由导航（仅内部 state + 地址栏镜像），
 * AdminConsole 永不因切 tab 重挂载 → loading 不复位、不重复拉取 GET /api/admin、无全屏加载层闪现（#62）。
 * section / detailId / mode 首次挂载时由 AdminConsole 内部 deriveFromPath(location) 推导，
 * 刷新直链、深链（/admin/collections/<id>、/admin/collections/new）行为不变。
 */
export default function AdminConsolePage() {
  return <AdminConsole />;
}
