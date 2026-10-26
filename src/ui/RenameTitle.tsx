import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';

/** A page title with a small pencil button to rename the thing it names. */
export function RenameTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  if (!editing)
    return (
      <h1 className="rename-title">
        {title}
        <button
          className="rename-button"
          title="Rename"
          aria-label="Rename"
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
        >
          <Pencil />
        </button>
      </h1>
    );
  const commit = () => {
    if (draft.trim() && draft.trim() !== title) onRename(draft);
    setEditing(false);
  };
  return (
    <form
      className="rename-form"
      onSubmit={e => {
        e.preventDefault();
        commit();
      }}
    >
      <input autoFocus value={draft} maxLength={60} onChange={e => setDraft(e.target.value)} />
      <button type="submit" aria-label="Save name">
        <Check />
      </button>
      <button type="button" aria-label="Cancel" onClick={() => setEditing(false)}>
        <X />
      </button>
    </form>
  );
}
