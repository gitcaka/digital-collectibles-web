/**
 * 用户端（mobile）共享类型、常量与格式化工具。
 * 各视图组件复用同一套 AppState 结构，避免重复声明。
 */

export type View = 'home' | 'store' | 'redeem' | 'vault' | 'profile' | 'checkin';
export type PrimaryView = Exclude<View, 'checkin'>;
export type Notice = { tone: 'success' | 'error' | 'info'; message: string } | null;

export type RedeemMode = 'both' | 'yuanbao' | 'points' | 'none';

export type PricedItem = {
  price: number;
  pointsPrice: number;
  redeemMode: RedeemMode;
};

export type CollectionItem = PricedItem & {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  rarity: string;
  total: number;
  sold: number;
  transferable: boolean;
  imageUrl: string | null;
  status: string;
};

export type InventoryItem = PricedItem & {
  id: string;
  collectionId: string;
  serialNo: number;
  source: string;
  status: string;
  acquiredAt: string;
  name: string;
  subtitle: string;
  description: string;
  rarity: string;
  total: number;
  sold: number;
  transferable: boolean;
  imageUrl: string | null;
};

export type TransferItem = {
  id: string;
  senderUserId: string;
  recipientUserId: string | null;
  recipientUsername: string;
  userCollectionId: string;
  collectionId: string;
  price: number;
  fee: number;
  status: string;
  createdAt: string;
  name: string;
  rarity: string;
  imageUrl: string | null;
  senderUsername: string;
  senderDisplayName: string;
};

export type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
};

export type RankingEntry = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  value: number;
  isMe: boolean;
};

export type RankingBoard = {
  entries: RankingEntry[];
  me: { rank: number; value: number } | null;
  total: number;
};

export type CurrencyNames = { yuanbao: string; points: string };

export type AppState = {
  user: { id: string; username: string; displayName: string; role: 'user' | 'admin' };
  wallet: { yuanbao: number };
  points: { total: number; streak: number; lastCheckinDate: string | null; signedToday: boolean };
  collections: CollectionItem[];
  inventory: InventoryItem[];
  redeemRecords: Array<{ code: string; reward: string; createdAt: string }>;
  transfers: TransferItem[];
  banners: Banner[];
  rankings: {
    collections: RankingBoard;
    yuanbao: RankingBoard;
    points: RankingBoard;
    rarity: RankingBoard;
  };
  settings: CurrencyNames;
};

export type RankingKey = 'collections' | 'yuanbao' | 'points' | 'rarity';

export type PerformResult = { success?: boolean; message: string };

/** 统一执行一次写操作并刷新数据的回调（由 App 壳注入）。 */
export type PerformFn = (
  key: string,
  url: string,
  body?: unknown,
  method?: 'POST' | 'PATCH',
) => Promise<PerformResult>;

/** 客户端切换到另一主视图（tab 视图切换，同步地址栏但不整页加载）。 */
export type NavigateFn = (view: PrimaryView) => void;
