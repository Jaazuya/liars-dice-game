import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PNG } from 'pngjs';

const pdfPath = process.argv[2] || path.resolve(process.cwd(), '..', 'Tablas-de-Loteria-Moderna.pdf');
const outDir = process.argv[3] || path.resolve(process.cwd(), '..', 'tmp', 'pdf-images');

fs.mkdirSync(outDir, { recursive: true });

const buf = fs.readFileSync(pdfPath);
const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
const pdf = await loadingTask.promise;

console.log(`PDF: ${pdfPath}`);
console.log(`Pages: ${pdf.numPages}`);
console.log(`Out: ${outDir}`);

const OPS = pdfjsLib.OPS;

for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
  const page = await pdf.getPage(pageNum);
  const opList = await page.getOperatorList();

  const seen = new Set();
  let imgCount = 0;

  const getImageSafe = async (name) => {
    try {
      const direct = page.objs.get(name);
      if (direct) return direct;
    } catch {
      // Not resolved yet, fall back to callback-based get
    }

    return await new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(null);
      }, 1000);

      page.objs.get(name, (img) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(img || null);
      });
    });
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintJpegXObject
    ) {
      const name = args?.[0];
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const img = await getImageSafe(name);

      if (!img || !img.data || !img.width || !img.height) continue;

      const png = new PNG({ width: img.width, height: img.height });

      // pdfjs suele entregar RGBA (kind=ImageKind.RGBA_32BPP), pero igual copiamos como RGBA
      png.data = Buffer.from(img.data);

      const file = path.join(outDir, `page-${pageNum}-img-${imgCount + 1}.png`);
      fs.writeFileSync(file, PNG.sync.write(png));
      imgCount++;
      console.log(`page ${pageNum}: wrote ${path.basename(file)} (${img.width}x${img.height})`);
    }
  }

  if (imgCount === 0) {
    console.log(`page ${pageNum}: no images found`);
  }
}


