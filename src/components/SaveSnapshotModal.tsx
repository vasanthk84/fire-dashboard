import { Save, X } from 'lucide-react';

interface SaveSnapshotModalProps {
  open: boolean;
  snapshotLabel: string;
  snapshotNotes: string;
  snapshotTags: string[];
  currentWealth: string;
  progressToFire: number;
  yearsToFI: number | null;
  onClose: () => void;
  onSave: () => void;
  onLabelChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function SaveSnapshotModal(props: SaveSnapshotModalProps) {
  const {
    open,
    snapshotLabel,
    snapshotNotes,
    snapshotTags,
    currentWealth,
    progressToFire,
    yearsToFI,
    onClose,
    onSave,
    onLabelChange,
    onNotesChange,
    onAddTag,
    onRemoveTag
  } = props;

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title"><Save size={18} /> Save Snapshot</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-group">
          <label className="form-label">Label (optional)</label>
          <input className="form-input" type="text" placeholder="e.g., Dec 2025 - Year End Review" value={snapshotLabel} onChange={(event) => onLabelChange(event.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Tags (optional)</label>
          <div className="tag-input-wrapper">
            {snapshotTags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
                <button className="tag-remove" onClick={() => onRemoveTag(tag)} type="button">×</button>
              </span>
            ))}
            <input
              className="form-input"
              type="text"
              placeholder="Add tag and press Enter"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const value = event.currentTarget.value.trim();
                  if (value) {
                    onAddTag(value);
                    event.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea className="form-input" placeholder="e.g., Received year-end bonus, increased SIP by 20%" value={snapshotNotes} onChange={(event) => onNotesChange(event.target.value)} rows={3} />
        </div>

        <div className="modal-summary">
          <div className="modal-summary-title">Snapshot Summary</div>
          <div className="modal-summary-lines">
            <div>Total Wealth: {currentWealth}</div>
            <div>FIRE Progress: {progressToFire.toFixed(1)}%</div>
            {yearsToFI !== null && <div>Years to FIRE: {yearsToFI}y</div>}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-snapshot secondary" onClick={onClose}>Cancel</button>
          <button className="btn-snapshot" onClick={onSave}><Save size={16} /> Save Snapshot</button>
        </div>
      </div>
    </div>
  );
}
