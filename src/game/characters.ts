import type { Color, PieceSymbol } from 'chess.js';

export interface Character {
  en: string;
  hi: string;
  piece: string;
  lore: string;
}

export const CHARACTERS: Record<Color, Record<PieceSymbol, Character>> = {
  w: {
    k: {
      en: 'Shri Ram',
      hi: 'श्रीराम',
      piece: 'King',
      lore: 'Prince of Ayodhya and the seventh avatar of Vishnu. Fourteen years into exile, he leads the war to win back Sita — dharma itself given a bow.',
    },
    q: {
      en: 'Sita Ji',
      hi: 'सीता जी',
      piece: 'Queen',
      lore: "Daughter of the earth, Ram's wife, abducted by Ravana to Lanka. Her rescue is the reason every army in this game is marching at all.",
    },
    b: {
      en: 'Hanuman Ji',
      hi: 'हनुमान जी',
      piece: 'Bishop',
      lore: "The devoted vanara, son of the wind god Vayu. He leapt an ocean to find Sita and set Lanka's towers alight with his own burning tail.",
    },
    n: {
      en: 'Lakshman',
      hi: 'लक्ष्मण',
      piece: 'Knight',
      lore: "Ram's younger brother, who gave up his own comfort to share the exile. Fiercely loyal, quick to anger on his brother's behalf, faster still with a bow.",
    },
    r: {
      en: 'Jamvant',
      hi: 'जामवंत',
      piece: 'Rook',
      lore: 'The ancient bear-king, oldest and wisest of the vanara host. It was he who reminded Hanuman of his own forgotten strength before the leap to Lanka.',
    },
    p: {
      en: 'Vanar Sena',
      hi: 'वानर सेना',
      piece: 'Pawn',
      lore: "The vast army of vanaras from Kishkindha, who tore up mountains to raise Ram Setu across the sea and stormed Lanka's shores by the thousand.",
    },
  },
  b: {
    k: {
      en: 'Ravana',
      hi: 'रावण',
      piece: 'King',
      lore: 'The ten-headed king of Lanka — brilliant scholar, devout of Shiva, undefeated in war. One act of pride, abducting Sita, dooms everything he built.',
    },
    q: {
      en: 'Mandodari',
      hi: 'मंदोदरी',
      piece: 'Queen',
      lore: "Ravana's queen, as virtuous as her husband is proud. She begged him again and again to return Sita and spare Lanka the war she saw coming.",
    },
    b: {
      en: 'Ahiravan',
      hi: 'अहिरावण',
      piece: 'Bishop',
      lore: 'Sorcerer-king of the netherworld Patala and brother to Ravana. He dragged Ram and Lakshman down to his underworld shrine by dark magic — until Hanuman followed.',
    },
    n: {
      en: 'Indrajit',
      hi: 'इंद्रजीत',
      piece: 'Knight',
      lore: "Ravana's son and Lanka's finest warrior, master of illusion and celestial weapons. The only fighter in the epic who ever brought down both Ram and Lakshman at once.",
    },
    r: {
      en: 'Kumbhakarna',
      hi: 'कुंभकर्ण',
      piece: 'Rook',
      lore: 'Ravana\'s giant brother, cursed to sleep six months at a time. Woken for battle, he fought with monstrous strength — even while telling Ravana he was wrong.',
    },
    p: {
      en: 'Rakshasa',
      hi: 'राक्षस',
      piece: 'Pawn',
      lore: "Lanka's demon foot-soldiers, countless and fearsome, filling Ravana's ranks against the vanara tide.",
    },
  },
};

export const ARMY: Record<Color, { en: string; hi: string }> = {
  w: { en: "Shri Ram's Army", hi: 'राम सेना' },
  b: { en: "Lanka's Army", hi: 'लंका सेना' },
};

export const PIECE_GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
