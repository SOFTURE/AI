import type { IntegrationNote } from "./note.js";

/** A test name as one contract line: line breaks would start a line the reader takes for another field. */
function toLineValue(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ");
}

/**
 * The stdout lines `wt-integration.sh` of the SOFTURE skills reads: `integration:`, `counts:`, `run:`, one `red:`
 * per failed test and one `new-red:` per failed test the main branch's latest result does not have red. Without a
 * main-branch result (`main` null) no `new-red:` line is printed, which the contract reads as "every red is new".
 */
export function formatContractLines(note: IntegrationNote, main: IntegrationNote | null): string {
  const lines = [`integration: ${note.result}`];
  if (note.passed !== null && note.total !== null) lines.push(`counts: ${String(note.passed)}/${String(note.total)}`);
  if (note.run !== null) lines.push(`run: ${note.run}`);
  for (const name of note.red) lines.push(`red: ${toLineValue(name)}`);
  if (main !== null) {
    const mainRed = new Set(main.red);
    for (const name of note.red.filter((test) => !mainRed.has(test))) lines.push(`new-red: ${toLineValue(name)}`);
  }
  return `${lines.join("\n")}\n`;
}
