/**
 * 管理端共享类型与工具。
 * 数据模型与后端 /api/admin 返回结构对应，避免 admin-console 各 section 重复声明。
 */

export type RedeemMode = 'both' | 'yuanbao' | 'points' | 'none';

export type AdminCollection = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  rarity: string;
  price: number;
  pointsPrice: number;
  redeemMode: RedeemMode;
  total: number;
  sold: number;
  transferable: boolean;
  imageUrl: string;
  status: 'on_sale' | 'off_sale' | 'archived';
};

export type AdminCode = {
  id: string;
  code: string;
  title: string;
  kind: 'general' | 'once';
  status: string;
  maxTotal: number;
  usedCount: number;
  rewards: string;
  createdAt: string;
};

export type AdminBanner = {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
  sortOrder: number;
  status: string;
};

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  yuanbao: number;
  points: number;
  holdingCount: number;
};

export type AdminTransferRow = {
  id: string;
  status: string;
  price: number;
  fee: number;
  createdAt: string;
  name: string;
  senderUsername: string;
  recipientUsername: string;
};

export type AdminData = {
  metrics: {
    userCount: number;
    holdingCount: number;
    redemptionCount: number;
    pendingTransferCount: number;
    yuanbaoTotal: number;
  };
  collections: AdminCollection[];
  codes: AdminCode[];
  users: AdminUserRow[];
  transfers: AdminTransferRow[];
  banners: AdminBanner[];
  settings: { yuanbao: string; points: string };
};

export type AdminAuditLogRow = {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
};

export type AdminStatsPoint = { date: string; full: string; value: number };
export type AdminStatsSeries = { key: string; name: string; total: number; points: AdminStatsPoint[] };
export type AdminStats = { days: 7 | 30; series: AdminStatsSeries[] };

/** 审计 action 中文名（未知 key 回退原文）。 */
export const auditActionText: Record<string, string> = {
  'collection.update': '编辑藏品',
  'collection.create': '新增藏品',
  'settings.update': '修改货币名称',
  'banner.create': '新增横幅',
  'banner.update': '编辑横幅',
  'banner.delete': '删除横幅',
  'code.create': '创建兑换码',
  'code.generate': '批量生成兑换码',
  'code.toggle': '启停兑换码',
  'code.delete': '删除兑换码',
  'wallet.adjust': '调整用户资产',
  'user.toggle': '启停用户账号',
  'collection.batch': '批量调整藏品',
  'user.batch': '批量调整用户',
};

export type AdminUserDetail = {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    status: string;
    createdAt: string;
  };
  assets: { yuanbao: number; points: number };
  holdings: Array<{
    id: string;
    collectionId: string;
    serialNo: number;
    source: string;
    status: string;
    acquiredAt: string;
    name: string;
    rarity: string;
    imageUrl: string | null;
    transferable: boolean;
  }>;
  redeemRecords: Array<{ code: string; reward: string; createdAt: string }>;
  transfers: Array<{
    id: string;
    senderUserId: string;
    recipientUserId: string | null;
    recipientUsername: string;
    price: number;
    fee: number;
    status: string;
    createdAt: string;
    name: string;
    rarity: string;
    imageUrl: string | null;
    senderUsername: string;
    senderDisplayName: string;
  }>;
};

export type AdminTransferDetail = {
  id: string;
  status: string;
  price: number;
  fee: number;
  createdAt: string;
  completedAt: string | null;
  serialNo: number;
  source: string;
  collection: {
    id: string;
    name: string;
    rarity: string;
    imageUrl: string | null;
    transferable: boolean;
  };
  sender: { id: string; username: string; displayName: string };
  recipient: { id: string | null; username: string; displayName: string };
  isSender: boolean;
  isRecipient: boolean;
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  names: { yuanbao: string; points: string };
};

export const collectionRarityOrder = ['全部', '传说', '史诗', '稀有', '普通'] as const;
export const adminRarities = ['传说', '史诗', '稀有', '普通'] as const;

export type Section = 'dashboard' | 'collections' | 'codes' | 'users' | 'transfers' | 'banners' | 'audit' | 'settings';

export const sectionMeta: Record<Section, { eyebrow: string; title: string; note: string }> = {
  dashboard: { eyebrow: 'OPERATIONS', title: '运营总览', note: '查看平台关键指标和当前待办。' },
  collections: { eyebrow: 'CATALOG', title: '藏品管理', note: '控制元宝价、积分价、兑换方式、上下架状态和转让权限。' },
  codes: { eyebrow: 'CAMPAIGNS', title: '兑换码', note: '创建通用兑换码或批量生成一次性随机码。' },
  users: { eyebrow: 'MEMBERS', title: '用户与资产', note: '查询用户并调整元宝、积分或账号状态。' },
  transfers: { eyebrow: 'ORDERS', title: '转让记录', note: '集中查看平台全部转让订单。' },
  banners: { eyebrow: 'FRONT PAGE', title: '首页横幅', note: '管理首页自动轮播的图片与跳转。' },
  audit: { eyebrow: 'AUDIT', title: '审计日志', note: '记录管理员在后台的每一次关键写操作。' },
  settings: { eyebrow: 'SYSTEM', title: '系统设置', note: '定义平台内的元宝与积分名称，全站实时生效。' },
};

export const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export const statusText = (status: string) =>
  status === 'pending'
    ? '待确认'
    : status === 'completed'
      ? '已完成'
      : status === 'rejected'
        ? '已拒绝'
        : '已关闭';

/** 管理端操作成功的响应载荷（部分操作会带回生成的一次性码）。 */
export type AdminActionResponse = {
  success?: boolean;
  message?: string;
  codes?: string[];
};

/**
 * 壳内全局轻提示：text 文案，tone 决定 ok(绿)/error(红) 呈现。
 */
export type AdminNotice = { text: string; tone?: 'ok' | 'error' };

/**
 * 管理端壳与各 section 之间的最小交互面：
 * data 由壳统一拉取并透传，操作与反馈经 action/setNotice 收敛到壳。
 */
export type AdminSectionProps = {
  data: AdminData;
  /** 当前正在执行的异步操作 key（由壳统一管理 busy 态） */
  busy: string;
  /** 执行一次后台写操作（action 已随 payload 附带），成功后壳自动 reload */
  action: (key: string, payload: Record<string, unknown>) => Promise<AdminActionResponse | null>;
  /** 提示：传字符串默认 ok(绿)；传对象可指定 error(红)。失败类提示请用 { text, tone: 'error' } */
  setNotice: (message: string | AdminNotice) => void;
  /** 主动重新拉取一次后台数据（编辑器保存等不走 action 的场景） */
  reload: () => Promise<void>;
  openSection: (next: Section) => void;
};
