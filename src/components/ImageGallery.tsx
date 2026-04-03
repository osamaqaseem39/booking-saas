import { useMemo, useState, type ChangeEvent } from 'react';
import { resolvePublicImageUrl, uploadImageApi } from '../api/saasClient';

type ImageGalleryProps = {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  maxItems?: number;
};

export default function ImageGallery({
  label,
  value,
  onChange,
  maxItems = 8,
}: ImageGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urls = useMemo(() => value ?? [], [value]);
  const canAdd = urls.length < maxItems;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !canAdd) return;

    setUploading(true);
    setError(null);
    try {
      const res = await uploadImageApi(file);
      onChange([...urls, res.url]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function updateItem(index: number, nextUrl: string) {
    const next = [...urls];
    next[index] = nextUrl;
    onChange(next);
  }

  function removeItem(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  return (
    <div className="image-upload">
      <label>{label}</label>
      <div className="image-upload-actions">
        <label className="btn-ghost btn-compact image-upload-btn">
          {uploading ? 'Uploading...' : 'Upload image'}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void handleFileChange(e)}
            disabled={uploading || !canAdd}
            hidden
          />
        </label>
        <span className="muted">{urls.length}/{maxItems}</span>
      </div>
      {error ? <p className="muted image-upload-error">{error}</p> : null}

      <div className="form-grid" style={{ marginTop: '0.35rem' }}>
        {urls.map((url, idx) => (
          <div key={`${idx}-${url}`} className="image-gallery-item">
            <input
              type="url"
              value={url}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder="https://..."
            />
            <button type="button" className="btn-danger btn-compact" onClick={() => removeItem(idx)}>
              Remove
            </button>
            {url ? (
              <img
                src={resolvePublicImageUrl(url)}
                alt={`Gallery ${idx + 1}`}
                className="image-upload-preview"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
