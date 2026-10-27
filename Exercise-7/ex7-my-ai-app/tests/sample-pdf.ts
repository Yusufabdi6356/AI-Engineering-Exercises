import { PDFDocument, StandardFonts } from 'pdf-lib';

export const samplePages = [
  [
    'How Honeybees Choose a New Home',
    'Every spring a large honeybee colony splits in two. The old queen leaves with about ten thousand workers and the swarm hangs from a tree branch while it decides where to live next.',
    'Only a few hundred older bees, called scouts, search for a new home. They fly up to five kilometres away and inspect hollow trees, wall cavities and old nest boxes.',
  ],
  [
    'The Waggle Dance Debate',
    'When a scout finds a promising cavity, she returns to the swarm and performs a waggle dance. The angle of the dance points to the site and the length of the waggle tells the distance.',
    'Scouts dance longer and with more energy for better sites. A good cavity holds about forty litres, has a small entrance near the bottom and sits several metres above the ground.',
  ],
  [
    'Reaching a Decision',
    'Other scouts visit the advertised sites and join the dance for the ones they like. Support for weaker sites fades because their dancers stop dancing after a few rounds.',
    'When about fifteen bees gather at one site at the same time, the scouts there signal the swarm to warm up and leave. The whole process usually takes one to three days.',
  ],
];

export async function buildPdf(pages: string[][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const maxWidth = 500;

  for (const paragraphs of pages) {
    const page = pdf.addPage([595, 842]);
    let y = 780;

    for (const paragraph of paragraphs) {
      let line = '';

      for (const word of paragraph.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, fontSize) > maxWidth) {
          page.drawText(line, { x: 48, y, size: fontSize, font });
          y -= 18;
          line = word;
        } else {
          line = next;
        }
      }

      if (line) {
        page.drawText(line, { x: 48, y, size: fontSize, font });
        y -= 30;
      }
    }
  }

  return pdf.save();
}

export function buildSamplePdf(): Promise<Uint8Array> {
  return buildPdf(samplePages);
}
