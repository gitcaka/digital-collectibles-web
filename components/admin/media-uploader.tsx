'use client';

import { useRef, useState } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';

export async function uploadCollectionImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const base =
    typeof window !== 'undefined' && window.location.port === '3000'
      ? 'http://localhost:8080'
      : process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin;
  const response = await fetch(`${base.replace(/\/$/, '')}/api/admin/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  const payload = (await response.json()) as {
    success?: boolean;
    message?: string;
    url?: string;
    data?: { url?: string };
  };
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '上传失败');
  }
  // 后端把 url 直接放在响应顶层，data.url 仅作为兼容字段保留。
  return payload.url || payload.data?.url || '';
}

export function MediaUploader({
  imageUrl,
  onPicked,
}: {
  imageUrl: string | null;
  onPicked: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pickFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadCollectionImage(file);
      if (url) onPicked(url);
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : '上传失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="ops-media-uploader">
      <input
        ref={fileRef}
        type="file"
        accept="image/gif,image/png,image/jpeg,image/webp"
        hidden
        aria-label="上传藏品图片"
        onChange={(event) => void pickFile(event.target.files?.[0])}
      />
      <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <LoaderCircle className="spin" /> : <ImagePlus />}
        {busy ? '上传中…' : imageUrl ? '更换图片' : '上传图片'}
      </button>
    </div>
  );
}
