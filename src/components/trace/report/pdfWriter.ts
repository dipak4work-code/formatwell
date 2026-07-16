/**
 * Minimal, dependency-free PDF writer: one full-page JPEG image per page.
 * Image-based pages sidestep font embedding and encoding entirely, so any unicode
 * in transcripts renders exactly as the canvas drew it. Built for the Agent Trace
 * report; everything happens locally.
 */

export interface PdfPageImage {
  /** Raw JPEG bytes (DCTDecode passes them through untouched). */
  data: Uint8Array;
  /** Pixel dimensions of the JPEG. */
  width: number;
  height: number;
}

/** A4 in PDF points. */
const A4_W = 595.28;
const A4_H = 841.89;

export function jpegPagesToPdf(pages: PdfPageImage[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];

  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    offset += bytes.length;
  };
  const beginObj = (num: number) => {
    offsets[num] = offset;
    push(`${num} 0 obj\n`);
  };

  push('%PDF-1.4\n');
  // Binary comment marker (must be raw bytes, not UTF-8 encoded text).
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const n = pages.length;
  beginObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  beginObj(2);
  push(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${n} >>\nendobj\n`,
  );

  pages.forEach((page, i) => {
    const pageObj = 3 + i * 3;
    const contentObj = 4 + i * 3;
    const imageObj = 5 + i * 3;

    beginObj(pageObj);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] ` +
        `/Resources << /XObject << /Im${i} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`,
    );

    const stream = `q ${A4_W} 0 0 ${A4_H} 0 0 cm /Im${i} Do Q`;
    beginObj(contentObj);
    push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

    beginObj(imageObj);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`,
    );
    push(page.data);
    push('\nendstream\nendobj\n');
  });

  const xrefStart = offset;
  const total = 3 + n * 3; // object 0 + catalog + pages + 3 per page
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) {
    xref += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
