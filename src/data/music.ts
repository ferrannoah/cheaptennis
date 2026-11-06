/** Original chiptune songs. Each token = one 16th-note row. '.' sustains, '-' rests.
 * Chords are written as "C4+E4+G4" and played as fast arpeggios. */
export interface Channel {
  inst: 'lead' | 'harm' | 'bass' | 'pad' | 'drums';
  notes: string[];
  vol?: number;
}
export interface Song {
  bpm: number;
  rows: number;
  loopRow?: number;
  channels: Channel[];
}

const t = (...bars: string[]) => bars.join(' ').trim().split(/\s+/);
const hold = (tok: string, n = 16) => [tok, ...Array(n - 1).fill('.')].join(' ');
const bass = (r: string, f: string) => `${r} . ${r} . ${f} . ${r} . ${r} . ${r} . ${f} . ${r} .`;
const bassWalk = (a: string, b: string, c: string, d: string) => `${a} . . . ${b} . . . ${c} . . . ${d} . . .`;
const DR = 'K . H . S . H . K . K . S . H H';
const DR2 = 'K . H H S . H . K . H K S . H .';
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');

function song(bpm: number, chans: Channel[], loopRow = 0): Song {
  const rows = Math.max(...chans.map((c) => c.notes.length));
  return { bpm, rows, loopRow, channels: chans };
}

const C = 'C4+E4+G4', Am = 'A3+C4+E4', F = 'F3+A3+C4', G = 'G3+B3+D4', Dm = 'D4+F4+A4', Em = 'E4+G4+B4';

export const SONGS: Record<string, Song> = {
  title: song(132, [
    {
      inst: 'lead',
      notes: t(
        'E5 . . G5 . . C6 . B5 . G5 . E5 . D5 .',
        'C5 . . D5 . . E5 . . . G5 . . . - .',
        'F5 . . A5 . . C6 . B5 . A5 . F5 . E5 .',
        'D5 . . . E5 . F5 . G5 . . . . . - .',
        'E5 . . G5 . . C6 . D6 . C6 . B5 . G5 .',
        'A5 . . G5 . . E5 . D5 . . . C5 . D5 .',
        'E5 . F5 . G5 . A5 . B5 . . . D6 . B5 .',
        'C6 . . . . . G5 . E5 . . . C5 . - .',
        // B section
        'A5 . . . G5 . E5 . . . C5 . D5 . E5 .',
        'F5 . . . E5 . D5 . . . C5 . D5 . . .',
        'G5 . . . F5 . E5 . . . D5 . E5 . F5 .',
        'G5 . . . . . A5 . B5 . . . - . . .',
      ),
    },
    { inst: 'harm', notes: t(hold(C), hold(Am), hold(F), hold(G), hold(C), hold(Am), hold(Dm, 8), hold(G, 8), hold(F), hold(Dm), hold(C), hold(G)) },
    {
      inst: 'bass',
      notes: t(bass('C3', 'G2'), bass('A2', 'E2'), bass('F2', 'C3'), bass('G2', 'D3'), bass('C3', 'G2'), bass('A2', 'E2'),
        'D3 . D3 . A2 . D3 . G2 . G2 . D3 . G2 .', bass('C3', 'G2'), bass('F2', 'C3'), bass('D3', 'A2'), bass('C3', 'G2'), bassWalk('G2', 'A2', 'B2', 'D3')),
    },
    { inst: 'drums', notes: t(rep(DR, 7), 'K . H . S . H . K . S . S S S S', rep(DR2, 3), 'K . S . K . S . S S S S S S S S') },
  ]),

  hub: song(104, [
    {
      inst: 'lead',
      notes: t(
        'A4 . . C5 . . E5 . . . D5 . C5 . . .',
        'B4 . . . G4 . . . A4 . B4 . C5 . . .',
        'F5 . . E5 . . C5 . . . A4 . C5 . . .',
        'E5 . . . . . D5 . . . B4 . . . - .',
        'A4 . . C5 . . E5 . . . A5 . G5 . . .',
        'F5 . . . E5 . . . D5 . C5 . B4 . . .',
        'C5 . . D5 . . E5 . F5 . E5 . D5 . C5 .',
        'B4 . . . . . . . - . . . . . . .',
      ),
      vol: 0.8,
    },
    { inst: 'harm', notes: t(hold(Am), hold(G), hold(F), hold(Em), hold(Am), hold(Dm), hold(F), hold('E4+G#4+B4')), vol: 0.8 },
    { inst: 'bass', notes: t(bassWalk('A2', 'A2', 'E2', 'A2'), bassWalk('G2', 'G2', 'D2', 'G2'), bassWalk('F2', 'F2', 'C3', 'F2'), bassWalk('E2', 'E2', 'B2', 'E2'), bassWalk('A2', 'A2', 'E2', 'A2'), bassWalk('D2', 'D2', 'A2', 'D2'), bassWalk('F2', 'F2', 'C3', 'F2'), bassWalk('E2', 'E2', 'B2', 'E2')) },
    { inst: 'drums', notes: t(rep('K . . . H . . . S . . . H . . H', 8)), vol: 0.7 },
  ]),

  intro: song(150, [
    { inst: 'lead', notes: t('G4 . C5 . E5 . G5 . . . E5 . G5 . . .', 'C6 . . . . . . . - . . . . . . .') },
    { inst: 'harm', notes: t(hold(C), hold('C4+E4+G4+C5')) },
    { inst: 'bass', notes: t('C3 . . . G2 . . . C3 . . . G2 . . .', 'C3 . . . . . . . - . . . . . . .') },
    { inst: 'drums', notes: t('K . H . S . H . K . S . S S S S', 'K . . . . . . . - . . . . . . .') },
  ]),

  victory: song(140, [
    { inst: 'lead', notes: t('C5 . E5 . G5 . C6 . . . G5 . C6 . . .', 'D6 . . . C6 . B5 . C6 . . . . . . .', '- . . . . . . .') },
    { inst: 'harm', notes: t(hold(C), hold('G3+B3+D4', 8), hold(C, 8), '- . . . . . . .') },
    { inst: 'bass', notes: t(bass('C3', 'G2'), 'G2 . . . G2 . . . C3 . . . . . . .', '- . . . . . . .') },
    { inst: 'drums', notes: t(DR, 'K . S . K . S . K . . . . . . .', '- . . . . . . .') },
  ]),

  defeat: song(96, [
    { inst: 'lead', notes: t('E5 . . . D5 . . . C5 . . . B4 . . .', 'A4 . . . . . . . - . . . . . . .') },
    { inst: 'harm', notes: t(hold(Am, 8), hold(G, 8), hold('F3+A3+C4', 8), hold('E3+G#3+B3', 8)) },
    { inst: 'bass', notes: t('A2 . . . G2 . . . F2 . . . E2 . . .', 'A2 . . . . . . . - . . . . . . .') },
  ]),

  trophy: song(120, [
    { inst: 'lead', notes: t('G4 . . C5 . . E5 . G5 . . . E5 . G5 .', 'C6 . . . . . B5 . A5 . . . G5 . . .', 'A5 . . F5 . . A5 . C6 . . . D6 . . .', 'E6 . . . . . . . . . . . - . . .') },
    { inst: 'harm', notes: t(hold(C), hold('E4+G4+C5', 8), hold(G, 8), hold(F), hold('C4+E4+G4+C5')) },
    { inst: 'bass', notes: t(bass('C3', 'G2'), bass('E2', 'G2'), bass('F2', 'C3'), 'C3 . . . . . . . . . . . - . . .') },
    { inst: 'drums', notes: t(DR, DR, DR2, 'K . . . S . . . S S S S K . . .') },
  ]),

  sting_game: song(170, [
    { inst: 'lead', notes: t('E5 . G5 . C6 . . . - . . .') },
    { inst: 'harm', notes: t(hold(C, 12)) },
  ]),
};
