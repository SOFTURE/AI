// A fictional PDF built in the test, never a real document: `pageCount` empty A4 pages, each with one line of text, and
// a correct cross-reference table, so pdf.js reads it without repairing it.
export function buildFictionalPdf(pageCount: number): Uint8Array {
  const objects: string[] = [];
  const pageIds = Array.from({ length: pageCount }, (_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(" ")}] /Count ${String(pageCount)} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pageIds.forEach((id, index) => {
    const text = `BT /F1 24 Tf 72 760 Td (Fictional page ${String(index + 1)}) Tj ET`;
    objects[id] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${String(id + 1)} 0 R >>`;
    objects[id + 1] = `<< /Length ${String(text.length)} >>\nstream\n${text}\nendstream`;
  });
  let body = "%PDF-1.7\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${String(id)} 0 obj\n${objects[id] ?? ""}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${String(objects.length)}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) body += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${String(objects.length)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
