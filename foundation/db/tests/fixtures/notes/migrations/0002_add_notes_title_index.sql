-- Rollback: DROP INDEX notes.notes_title_idx;
CREATE INDEX notes_title_idx ON notes (title);
