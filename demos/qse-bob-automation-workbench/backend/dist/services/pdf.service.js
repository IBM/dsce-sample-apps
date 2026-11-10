import PDFDocument from 'pdfkit';
/** Renders report Markdown to a simple, readable PDF (headings, lists, code, tables as text). */
export function markdownToPdf(markdown, title) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 54, info: { Title: title, Producer: 'QSE Automation Workbench' } });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        const strip = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');
        let fence = false;
        for (const raw of markdown.split(/\r?\n/)) {
            const line = raw.replace(/\t/g, '    ');
            if (/^\s*(```|~~~)/.test(line)) {
                fence = !fence;
                doc.moveDown(0.2);
                continue;
            }
            if (fence) {
                doc.font('Courier').fontSize(8.5).fillColor('#222222').text(line || ' ', { lineGap: 1 });
                continue;
            }
            const h = /^(#{1,6})\s+(.*)$/.exec(line);
            if (h) {
                const size = [20, 16, 13.5, 12, 11, 10][h[1].length - 1];
                doc.moveDown(0.6).font('Helvetica-Bold').fontSize(size).fillColor('#161616').text(strip(h[2]));
                doc.moveDown(0.2);
                continue;
            }
            if (/^\s*[-*+]\s+/.test(line)) {
                doc.font('Helvetica').fontSize(10).fillColor('#161616').text(`•  ${strip(line.replace(/^\s*[-*+]\s+/, ''))}`, { indent: 10 });
                continue;
            }
            if (/^\s*\|?\s*:?-{3,}/.test(line))
                continue;
            if (line.trim().startsWith('|')) {
                const cells = line.split('|').slice(1, -1).map((c) => strip(c.trim()));
                doc.font('Helvetica').fontSize(9).fillColor('#161616').text(cells.join('   |   '));
                continue;
            }
            if (/^>\s?/.test(line)) {
                doc.font('Helvetica-Oblique').fontSize(10).fillColor('#525252').text(strip(line.replace(/^>\s?/, '')), { indent: 12 });
                continue;
            }
            if (/^---+$/.test(line.trim())) {
                doc.moveDown(0.4);
                continue;
            }
            if (!line.trim()) {
                doc.moveDown(0.3);
                continue;
            }
            doc.font('Helvetica').fontSize(10).fillColor('#161616').text(strip(line));
        }
        doc.end();
    });
}
//# sourceMappingURL=pdf.service.js.map