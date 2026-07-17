/** Themed battle cries for the notice toast — flavour, not information. */
export type QuoteEvent = 'capture-ram' | 'capture-lanka' | 'check';

const QUOTES: Record<QuoteEvent, { en: string; hi: string }[]> = {
  'capture-ram': [
    { en: 'Dharma strikes true', hi: 'धर्म की विजय निश्चित है' },
    { en: 'The vanar sena roars', hi: 'वानर सेना गरज उठी' },
    { en: 'Jai Shri Ram!', hi: 'जय श्री राम!' },
    { en: "Hanuman's fire spreads", hi: 'हनुमान की ज्वाला फैली' },
    { en: 'One more rakshasa falls', hi: 'एक और राक्षस धराशायी' },
  ],
  'capture-lanka': [
    { en: 'Lanka laughs in the dark', hi: 'लंका का अट्टहास गूंजा' },
    { en: "Ravana's shadow grows", hi: 'रावण की छाया बढ़ी' },
    { en: 'The rakshasas feast tonight', hi: 'राक्षसों का उत्सव' },
    { en: 'Indrajit strikes unseen', hi: 'इंद्रजीत का अदृश्य वार' },
    { en: 'A warrior of Ram has fallen', hi: 'राम का योद्धा गिरा' },
  ],
  check: [
    { en: 'The king stands in peril!', hi: 'राजा संकट में!' },
    { en: 'An arrow flies at the throne', hi: 'सिंहासन पर बाण चला' },
    { en: 'The battle tightens', hi: 'युद्ध निर्णायक मोड़ पर' },
  ],
};

export function battleQuote(ev: QuoteEvent): { en: string; hi: string } {
  const arr = QUOTES[ev];
  return arr[Math.floor(Math.random() * arr.length)];
}
