import { useEffect, useId, useRef, useState } from "react";
import { postLostFoundItem } from "../../api/lostFoundAPI";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

const ItemForm = ({ postedBy, onCreated, onError }) => {
  const fileInputId = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("lost");
  const [locationName, setLocationName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const previewRevokeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewRevokeRef.current) {
        URL.revokeObjectURL(previewRevokeRef.current);
      }
    };
  }, []);

  const clearPhoto = () => {
    if (previewRevokeRef.current) {
      URL.revokeObjectURL(previewRevokeRef.current);
      previewRevokeRef.current = null;
    }
    setPreviewUrl("");
    setPhoto(null);
  };

  const onPhotoChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError?.("Please choose an image file (JPG, PNG, WebP, or GIF).");
      return;
    }
    if (file.size > MAX_BYTES) {
      onError?.("Image must be 5 MB or smaller.");
      return;
    }
    clearPhoto();
    previewRevokeRef.current = URL.createObjectURL(file);
    setPreviewUrl(previewRevokeRef.current);
    setPhoto(file);
    onError?.("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!postedBy) {
      onError?.("You must be signed in to post.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("status", status);
      if (locationName.trim()) {
        fd.append("locationName", locationName.trim());
      }
      fd.append("postedBy", String(postedBy));
      if (photo) {
        fd.append("image", photo);
      }

      const { data } = await postLostFoundItem(fd);
      onCreated?.(data);
      setTitle("");
      setDescription("");
      setLocationName("");
      setStatus("lost");
      clearPhoto();
    } catch (err) {
      onError?.(
        err.response?.data?.message || "Could not post item. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="lf-form panel-card" onSubmit={handleSubmit}>
      <h2>Report an item</h2>
      <label>
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
        />
      </label>
      <label>
        Status
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="lost">Lost</option>
          <option value="found">Found</option>
        </select>
      </label>
      <label>
        Location hint
        <input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="Where it was seen or lost"
        />
      </label>

      <div className="lf-photo-field">
        <span className="lf-photo-label">Photo (optional)</span>
        <p className="lf-photo-hint">
          JPG, PNG, WebP, or GIF · up to 5 MB. Shown on the listing when upload
          succeeds (requires Cloudinary in <code>backend/.env</code>).
        </p>
        <div className="lf-photo-row">
          <label className="lf-photo-file-btn" htmlFor={fileInputId}>
            {photo ? "Change photo" : "Add photo"}
          </label>
          <input
            id={fileInputId}
            className="lf-photo-input-native"
            type="file"
            accept={ACCEPT}
            onChange={onPhotoChange}
          />
          {photo ? (
            <button
              type="button"
              className="lf-photo-remove"
              onClick={clearPhoto}
            >
              Remove
            </button>
          ) : null}
        </div>
        {previewUrl ? (
          <div className="lf-photo-preview">
            <img src={previewUrl} alt="" />
          </div>
        ) : null}
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? "Posting…" : "Submit"}
      </button>
    </form>
  );
};

export default ItemForm;
