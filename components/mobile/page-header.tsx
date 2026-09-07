import { ArrowLeft, Gem, Menu } from 'lucide-react';

/** 手机端通用页头：返回 / 品牌图标 + 标题 + 更多菜单占位。 */
export function PageHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <header className="view-header">
      {onBack ? (
        <button type="button" aria-label="返回" onClick={onBack}>
          <ArrowLeft />
        </button>
      ) : (
        <span className="brand-gem">
          <Gem />
        </span>
      )}
      <h1>{title}</h1>
      <button type="button" className="header-menu" aria-label="更多">
        <Menu />
      </button>
    </header>
  );
}
