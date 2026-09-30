import { useState } from 'react';
import { Copy, Download, X } from 'lucide-react';

export default function ExportDialog({ file, onClose, onDownload }: { file: { name: string; content: string }; onClose: () => void; onDownload: () => void }) {
  const [copyState, setCopyState] = useState('复制内容');
  const copy = async () => {
    try { await navigator.clipboard.writeText(file.content); setCopyState('已复制'); }
    catch { setCopyState('请选择下方内容复制'); }
  };
  return <div className="dialog-backdrop" onClick={onClose}>
    <section className="edit-dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onClick={e => e.stopPropagation()}>
      <div className="dialog-heading"><h2 id="export-title">把共识带走</h2><button className="icon-button" aria-label="关闭导出" onClick={onClose}><X size={19} /></button></div>
      <p className="export-description">{file.name}<br />包含主板、下层细节与讨论记录。</p>
      <textarea aria-label="导出内容" value={file.content} readOnly onFocus={e => e.target.select()} />
      <div className="dialog-actions"><button onClick={copy}><Copy size={15} />{copyState}</button><button className="primary-button" onClick={onDownload}><Download size={15} />下载文件</button></div>
    </section>
  </div>;
}
