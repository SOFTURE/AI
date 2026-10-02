-- Rollback: DROP TABLE tags.tags;
CREATE TABLE tags (
  id serial PRIMARY KEY,
  note_id integer NOT NULL REFERENCES notes.notes (id) ON DELETE CASCADE,
  label text NOT NULL,
  CONSTRAINT tags_note_label_unique UNIQUE (note_id, label)
);
