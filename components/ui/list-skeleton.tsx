/**
 * 列表加载骨架屏：用于异步列表（审计页、使用记录等）加载期间的占位，
 * 视觉与 .ops-audit-row / .ops-mini-table 等行高一致，减少内容跳动。
 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="ui-skel-list" role="status" aria-label="列表加载中">
      {Array.from({ length: rows }, (_, index) => (
        <div className="ui-skel-row" key={index} aria-hidden="true">
          <span className="ui-skel-thumb" />
          <span className="ui-skel-lines">
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  );
}
