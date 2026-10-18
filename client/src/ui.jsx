import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CircleAlert, CircleCheck, Download, File, FileImage, FileSpreadsheet, FileText,
  Inbox, Info, Presentation, X,
} from 'lucide-react';
import { API, fmtSize, fmtDate } from './api.js';

export const extOf = (name = '') => {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toUpperCase() : 'FILE';
};

const KIND_EXT = {
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'txt', 'rtf', 'odt', 'md'],
  sheet: ['xls', 'xlsx', 'csv', 'ods'],
  slide: ['ppt', 'pptx', 'key', 'odp'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
};

const KIND_ICON = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation,
  image: FileImage,
  other: File,
};

export const kindOf = (name) => {
  const e = extOf(name).toLowerCase();
  for (const [k, list] of Object.entries(KIND_EXT)) if (list.includes(e)) return k;
  return 'other';
};

export const Badge = ({ status }) => (
  <span className={`badge ${status}`}>{status[0].toUpperCase() + status.slice(1)}</span>
);

export const DownloadIcon = () => <Download size={18} strokeWidth={2.4} aria-hidden="true" />;

/* ---------- toasts ---------- */

const ToastCtx = createContext(() => {});
/** const toast = useToast(); toast('Saved', 'success' | 'error' | 'info') */
export const useToast = () => useContext(ToastCtx);

const TOAST_ICON = { success: CircleCheck, error: CircleAlert, info: Info };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message, type = 'info') => {
      const id = ++nextId.current;
      setItems((l) => [...l.slice(-2), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts">
        {items.map((t) => {
          const Icon = TOAST_ICON[t.type] || Info;
          return (
            <div key={t.id} className={`toast ${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <Icon size={20} aria-hidden="true" />
              <p>{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- skeletons ---------- */

export const FileCardSkeleton = () => (
  <div className="fcard skel" aria-hidden="true">
    <div className="thumb shimmer" />
    <div className="fbody">
      <div className="line shimmer w80" />
      <div className="line sm shimmer w50" />
      <div className="line sm shimmer w65" />
    </div>
  </div>
);

export const FileRowSkeleton = () => (
  <div className="row skel" aria-hidden="true">
    <div className="ext shimmer" />
    <div className="info">
      <div className="line shimmer w50" />
      <div className="line sm shimmer w35" />
    </div>
  </div>
);

/* ---------- file views ---------- */

/** Grid card with a file-type thumbnail. `children` = trailing action(s). `onOpen` opens the detail view. */
export function FileCard({ file, onOpen, children }) {
  const who = file.uploader || '?';
  const kind = kindOf(file.original_name);
  const Icon = KIND_ICON[kind];
  return (
    <article className={`fcard k-${kind}`}>
      <div className="thumb">
        <div className="page">
          <Icon size={30} strokeWidth={1.8} aria-hidden="true" />
          <span>{extOf(file.original_name)}</span>
        </div>
      </div>
      <div className="fbody">
        <h4 className="ftitle" title={file.title}>
          {onOpen ? (
            <button type="button" className="ftitle-btn" onClick={() => onOpen(file)}>
              {file.title}
            </button>
          ) : (
            file.title
          )}
        </h4>
        <div className="by">
          <span className="avatar">{who[0].toUpperCase()}</span>
          <span>{who}</span>
          <span className="sep">·</span>
          <span>{fmtDate(file.created_at)}</span>
        </div>
        <div className="foot">
          <span className="fstats">{fmtSize(Number(file.size))}  ·  {file.downloads} downloads</span>
          <div className="actions">{children}</div>
        </div>
      </div>
    </article>
  );
}

/** Wide row for lists (my uploads, admin queue). */
export function FileRow({ file, meta, children }) {
  const kind = kindOf(file.original_name);
  const Icon = KIND_ICON[kind];
  return (
    <div className={`row k-${kind}`}>
      <div className="ext"><Icon size={22} strokeWidth={1.9} aria-hidden="true" /></div>
      <div className="info">
        <div className="title" title={file.title}>{file.title}</div>
        <div className="meta">
          {meta ??
            `Uploaded by ${file.uploader}  ·  ${fmtDate(file.created_at)}  ·  ${file.downloads} downloads`}
        </div>
      </div>
      <div className="size">{extOf(file.original_name)}  ·  {fmtSize(Number(file.size))}</div>
      <div className="actions">{children}</div>
    </div>
  );
}

/** Detail dialog: esc / overlay click / close button to dismiss; focus is trapped while open. */
export function FileModal({ file, onClose }) {
  const dialog = useRef(null);
  const closeBtn = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const open = !!file;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') return onCloseRef.current();
      if (e.key !== 'Tab' || !dialog.current) return undefined;
      const items = dialog.current.querySelectorAll('a[href], button:not([disabled])');
      if (!items.length) return undefined;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      return undefined;
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!file) return null;
  const kind = kindOf(file.original_name);
  const Icon = KIND_ICON[kind];
  const who = file.uploader || '?';

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} className={`modal k-${kind}`} role="dialog" aria-modal="true" aria-labelledby="file-modal-title">
        <div className="thumb">
          <div className="page">
            <Icon size={30} strokeWidth={1.8} aria-hidden="true" />
            <span>{extOf(file.original_name)}</span>
          </div>
        </div>
        <button ref={closeBtn} type="button" className="icon-ghost modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="modal-body">
          <h3 id="file-modal-title">{file.title}</h3>

          <div className="by">
            <span className="avatar">{who[0].toUpperCase()}</span>
            <span>{who}</span>
            <span className="sep">·</span>
            <span>{fmtDate(file.created_at)}</span>
          </div>

          <div className="facts">
            <div className="fact"><small>Type</small><b>{extOf(file.original_name)}</b></div>
            <div className="fact"><small>Size</small><b>{fmtSize(Number(file.size))}</b></div>
            <div className="fact"><small>Downloads</small><b>{file.downloads}</b></div>
          </div>

          {file.description?.trim() ? (
            <p className="desc">{file.description}</p>
          ) : (
            <p className="desc none">No description provided.</p>
          )}

          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Close</button>
            <a className="btn" href={`${API}/files/${file.id}/download`}>
              <Download size={16} strokeWidth={2.4} aria-hidden="true" /> Download
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const Empty = ({ children, icon = true }) => (
  <div className="empty">
    {icon && <Inbox size={36} strokeWidth={1.5} aria-hidden="true" />}
    <div>{children}</div>
  </div>
);
export const ErrorMsg = ({ error }) => (error ? <div className="error" role="alert">{error}</div> : null);
