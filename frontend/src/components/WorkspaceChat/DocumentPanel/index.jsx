import { useEffect, useRef, useState } from "react";
import { documentApi } from "../../../api/client";

// Side panel that lists uploaded documents and provides a drag-drop upload zone.
// Shown when the user clicks the "Documents" button in the workspace header.
export default function DocumentPanel({ slug, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { type: "success"|"error", msg }
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Load existing documents when panel opens.
  useEffect(() => {
    (async () => {
      try {
        const { documents: docs } = await documentApi.list(slug);
        setDocuments(docs ?? []);
      } catch {
        setDocuments([]);
      }
    })();
  }, [slug]);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    try {
      const { document: doc } = await documentApi.upload(slug, file);
      setDocuments((prev) => [doc, ...prev]);
      setUploadStatus({
        type: "success",
        msg: `"${doc.title}" uploaded — ${doc.chunkCount} chunks indexed`,
      });
    } catch (err) {
      setUploadStatus({ type: "error", msg: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, title) => {
    if (!confirm(`Remove "${title}" from this workspace?`)) return;
    try {
      await documentApi.remove(slug, docId);
      setDocuments((prev) => prev.filter((d) => d.docId !== docId));
    } catch (err) {
      setUploadStatus({ type: "error", msg: `delete failed: ${err.message}` });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-80 flex flex-col border-l border-slate-700 bg-slate-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <span className="font-semibold text-slate-100">Documents</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Drop zone */}
      <div className="px-4 pt-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragging
              ? "border-sky-400 bg-sky-900/20"
              : "border-slate-600 hover:border-slate-400"
          }`}
        >
          <p className="text-slate-400 text-sm">
            {uploading
              ? "Uploading & indexing…"
              : "Drop PDF / TXT / MD here\nor click to browse"}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* Status message */}
      {uploadStatus && (
        <div
          className={`mx-4 mt-3 px-3 py-2 rounded text-xs ${
            uploadStatus.type === "success"
              ? "bg-emerald-900/40 border border-emerald-700 text-emerald-200"
              : "bg-red-900/40 border border-red-700 text-red-200"
          }`}
        >
          {uploadStatus.msg}
        </div>
      )}

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {documents.length === 0 && (
          <p className="text-slate-500 text-xs text-center mt-6">
            No documents yet. Upload one above to enable RAG.
          </p>
        )}
        {documents.map((doc) => (
          <div
            key={doc.docId}
            className="flex items-start justify-between gap-2 bg-slate-800 rounded px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate" title={doc.title}>
                📄 {doc.title}
              </p>
              <p className="text-xs text-slate-500">
                {doc.chunkCount} chunks · {doc.wordCount} words
              </p>
            </div>
            <button
              onClick={() => handleDelete(doc.docId, doc.title)}
              className="text-slate-500 hover:text-red-400 shrink-0 text-sm mt-0.5"
              title="Remove document"
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
