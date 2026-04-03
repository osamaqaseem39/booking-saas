import { useMemo, useState, type ChangeEvent } from 'react';
import { resolvePublicImageUrl, uploadImageApi } from '../api/saasClient';

type ImageUploadProps = {
  label: string;
  value?: string;
  onChange: (url: string) => void;
};

export default function ImageUpload({ label, value, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => resolvePublicImageUrl(value ?? ''), [value]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const res = await uploadImageApi(file);
      onChange(res.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="image-upload">
      <label>{label}</label>
      <input
        type="url"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
      />
      <div className="image-upload-actions">
        <label className="btn-ghost btn-compact image-upload-btn">
          {uploading ? 'Uploading...' : 'Upload image'}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void handleFileChange(e)}
            disabled={uploading}
            hidden
          />
        </label>
        {value ? (
          <button type="button" className="btn-ghost btn-compact" onClick={() => onChange('')}>
            Clear
          </button>
        ) : null}
      </div>
      {error ? <p className="muted image-upload-error">{error}</p> : null}
      {previewUrl ? (
        <img src={previewUrl} alt={label} className="image-upload-preview image-upload-preview--single" />
      ) : null}
    </div>
  );
}
