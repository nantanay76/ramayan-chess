import type { Color, PieceSymbol } from 'chess.js';

export interface Character {
  en: string;
  hi: string;
  piece: string;
}

export const CHARACTERS: Record<Color, Record<PieceSymbol, Character>> = {
  w: {
    k: { en: 'Shri Ram', hi: 'श्रीराम', piece: 'King' },
    q: { en: 'Sita Ji', hi: 'सीता जी', piece: 'Queen' },
    b: { en: 'Hanuman Ji', hi: 'हनुमान जी', piece: 'Bishop' },
    n: { en: 'Lakshman', hi: 'लक्ष्मण', piece: 'Knight' },
    r: { en: 'Jamvant', hi: 'जामवंत', piece: 'Rook' },
    p: { en: 'Vanar Sena', hi: 'वानर सेना', piece: 'Pawn' },
  },
  b: {
    k: { en: 'Ravana', hi: 'रावण', piece: 'King' },
    q: { en: 'Mandodari', hi: 'मंदोदरी', piece: 'Queen' },
    b: { en: 'Ahiravan', hi: 'अहिरावण', piece: 'Bishop' },
    n: { en: 'Indrajit', hi: 'इंद्रजीत', piece: 'Knight' },
    r: { en: 'Kumbhakarna', hi: 'कुंभकर्ण', piece: 'Rook' },
    p: { en: 'Rakshasa', hi: 'राक्षस', piece: 'Pawn' },
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
