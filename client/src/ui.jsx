import { Download, File, FileImage, FileSpreadsheet, FileText, Presentation } from 'lucide-react';
import { fmtSize, fmtDate } from './api.js';

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

/** Grid card with a file-type thumbnail. `children` = trailing action(s). */
export function FileCard({ file, children }) {
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
        <h4 className="ftitle" title={file.title}>{file.title}</h4>
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

export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const ErrorMsg = ({ error }) => (error ? <div className="error">{error}</div> : null);
