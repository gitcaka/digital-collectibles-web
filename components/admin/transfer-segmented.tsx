import { Check, X } from 'lucide-react';

/**
 * 转让权限的显式二态按钮（取代不可见的 base-ui Switch）：
 * 用整段文字按钮 + 高亮底色表达“允许 / 禁止”，保证任何主题下都清晰可见。
 */
export function TransferSegmented({
  value,
  name,
  busy = false,
  onChange,
}: {
  value: boolean;
  name: string;
  busy?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <fieldset
      className="ops-transfer-seg"
      aria-label={`${name}是否允许转让`}
      disabled={busy}
    >
      <button
        type="button"
        className={!value ? 'is-active is-no' : ''}
        aria-pressed={!value}
        disabled={busy}
        onClick={() => {
          if (value && !busy) onChange(false);
        }}
      >
        {!value ? <X /> : null}
        禁止转让
      </button>
      <button
        type="button"
        className={value ? 'is-active is-yes' : ''}
        aria-pressed={value}
        disabled={busy}
        onClick={() => {
          if (!value && !busy) onChange(true);
        }}
      >
        {value ? <Check /> : null}
        允许转让
      </button>
    </fieldset>
  );
}
