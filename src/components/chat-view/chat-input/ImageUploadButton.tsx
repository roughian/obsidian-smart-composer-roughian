import { ImageIcon } from 'lucide-react'

import { SUPPORTED_IMAGE_MIME_TYPES } from '../../../utils/llm/image-preprocess'

export function ImageUploadButton({
  onUpload,
}: {
  onUpload: (files: File[]) => void
}) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      onUpload(files)
    }
  }

  return (
    <label className="smtcmp-chat-user-input-submit-button">
      <input
        type="file"
        accept={SUPPORTED_IMAGE_MIME_TYPES.join(',')}
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className="smtcmp-chat-user-input-submit-button-icons">
        <ImageIcon size={12} />
      </div>
      <div>Image</div>
    </label>
  )
}
