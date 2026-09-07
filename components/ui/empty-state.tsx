import type { LucideIcon } from 'lucide-react';

/**
 * 统一空态：持有空 / 搜索空 / 记录空共用一个视觉组件，
 * 上层通过 icon/title/hint 语义化表达，className 负责所处网格的位置。
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`ui-empty${className ? ` ${className}` : ''}`}>
      <span className="ui-empty-ic" aria-hidden="true">
        <Icon />
      </span>
      <strong>{title}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}
