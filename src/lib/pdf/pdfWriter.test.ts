import { describe, expect, it } from 'vitest';
import { jpegPagesToPdf } from './pdfWriter';

// Dummy "JPEG" payloads — the writer passes bytes through, so content is irrelevant here.
const fakeJpeg = (fill: number) => ({
  data: new Uint8Array(64).fill(fill),
  width: 1588,
  height: 2246,
});

describe('jpegPagesToPdf', () => {
  it('produces a structurally valid single-page PDF', async () => {
    const blob = jpegPagesToPdf([fakeJpeg(1)]);
    expect(blob.type).toBe('application/pdf');
    const text = await blob.text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Count 1');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('emits one page + content + image object per page and a matching xref size', async () => {
    const blob = jpegPagesToPdf([fakeJpeg(1), fakeJpeg(2), fakeJpeg(3)]);
    const text = await blob.text();
    expect(text).toContain('/Count 3');
    expect((text.match(/\/Type \/Page(?![a-z])/g) ?? []).length).toBe(3);
    expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBe(3);
    // objects: 0 free + catalog + pages + 3×3
    expect(text).toContain('/Size 12');
    expect(text).toContain('xref\n0 12');
  });

  it('xref offsets point at the object headers', async () => {
    const blob = jpegPagesToPdf([fakeJpeg(9)]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const ascii = new TextDecoder('latin1').decode(buf);
    // Note: 'startxref' also contains "xref", so anchor on the section header.
    const xref = ascii.slice(ascii.lastIndexOf('xref\n0 '));
    // Lines: "xref", "0 N", free entry for object 0, then objects 1..5.
    const lines = xref.split('\n').slice(3, 3 + 5);
    lines.forEach((line, i) => {
      const off = Number(line.slice(0, 10));
      expect(ascii.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });
});
