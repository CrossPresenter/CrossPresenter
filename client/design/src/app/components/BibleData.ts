export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export const BIBLE_BOOKS = [
  "Genesis","Exodus","Psalms","Proverbs","Isaiah","Matthew","Mark","Luke","John",
  "Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians",
  "Colossians","1 Thessalonians","1 Timothy","Hebrews","James","1 Peter","1 John","Revelation",
];

// Chapters per book (simplified)
export const CHAPTERS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Psalms: 150, Proverbs: 31, Isaiah: 66,
  Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
  "1 Corinthians": 16, "2 Corinthians": 13, Galatians: 6, Ephesians: 6,
  Philippians: 4, Colossians: 4, "1 Thessalonians": 5, "1 Timothy": 6,
  Hebrews: 13, James: 5, "1 Peter": 5, "1 John": 5, Revelation: 22,
};

// Sample verses — real text for popular passages
const VERSES: Record<string, Record<number, Record<number, string>>> = {
  John: {
    3: {
      16: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
      17: "For God did not send his Son into the world to condemn the world, but to save the world through him.",
      18: "Whoever believes in him is not condemned, but whoever does not believe stands condemned already because they have not believed in the name of God's one and only Son.",
    },
    1: {
      1: "In the beginning was the Word, and the Word was with God, and the Word was God.",
      2: "He was with God in the beginning.",
      3: "Through him all things were made; without him nothing was made that has been made.",
      14: "The Word became flesh and made his dwelling among us. We have seen his glory, the glory of the one and only Son, who came from the Father, full of grace and truth.",
    },
    14: {
      6: "Jesus answered, 'I am the way and the truth and the life. No one comes to the Father except through me.'",
      27: "Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.",
    },
  },
  Psalms: {
    23: {
      1: "The Lord is my shepherd, I lack nothing.",
      2: "He makes me lie down in green pastures, he leads me beside quiet waters,",
      3: "he refreshes my soul. He guides me along the right paths for his name's sake.",
      4: "Even though I walk through the darkest valley, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
      6: "Surely your goodness and love will follow me all the days of my life, and I will dwell in the house of the Lord forever.",
    },
    91: {
      1: "Whoever dwells in the shelter of the Most High will rest in the shadow of the Almighty.",
      2: "I will say of the Lord, 'He is my refuge and my fortress, my God, in whom I trust.'",
      11: "For he will command his angels concerning you to guard you in all your ways.",
    },
    46: {
      1: "God is our refuge and strength, an ever-present help in trouble.",
      10: "He says, 'Be still, and know that I am God; I will be exalted among the nations, I will be exalted in the earth.'",
    },
  },
  Philippians: {
    4: {
      4: "Rejoice in the Lord always. I will say it again: Rejoice!",
      6: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.",
      7: "And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus.",
      13: "I can do all this through him who gives me strength.",
      19: "And my God will meet all your needs according to the riches of his glory in Christ Jesus.",
    },
  },
  Romans: {
    8: {
      28: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose.",
      38: "For I am convinced that neither death nor life, neither angels nor demons, neither the present nor the future, nor any powers,",
      39: "neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.",
    },
    3: {
      23: "For all have sinned and fall short of the glory of God,",
      24: "and all are justified freely by his grace through the redemption that came by Christ Jesus.",
    },
  },
  Ephesians: {
    2: {
      8: "For it is by grace you have been saved, through faith — and this is not from yourselves, it is the gift of God —",
      9: "not by works, so that no one can boast.",
      10: "For we are God's handiwork, created in Christ Jesus to do good works, which God prepared in advance for us to do.",
    },
    6: {
      10: "Finally, be strong in the Lord and in his mighty power.",
      11: "Put on the full armor of God, so that you can take your stand against the devil's schemes.",
    },
  },
  Isaiah: {
    40: {
      28: "Do you not know? Have you not heard? The Lord is the everlasting God, the Creator of the ends of the earth. He will not grow tired or weary, and his understanding no one can fathom.",
      29: "He gives strength to the weary and increases the power of the weak.",
      31: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.",
    },
    41: {
      10: "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.",
    },
  },
  Matthew: {
    5: {
      3: "Blessed are the poor in spirit, for theirs is the kingdom of heaven.",
      4: "Blessed are those who mourn, for they will be comforted.",
      5: "Blessed are the meek, for they will inherit the earth.",
      6: "Blessed are those who hunger and thirst for righteousness, for they will be filled.",
    },
    28: {
      19: "Therefore go and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit,",
      20: "and teaching them to obey everything I have commanded you. And surely I am with you always, to the very end of the age.",
    },
  },
  Proverbs: {
    3: {
      5: "Trust in the Lord with all your heart and lean not on your own understanding;",
      6: "in all your ways submit to him, and he will make your paths straight.",
    },
  },
  Hebrews: {
    11: {
      1: "Now faith is confidence in what we hope for and assurance about what we do not see.",
      6: "And without faith it is impossible to please God, because anyone who comes to him must believe that he exists and that he rewards those who earnestly seek him.",
    },
  },
  Revelation: {
    21: {
      4: "He will wipe every tear from their eyes. There will be no more death or mourning or crying or pain, for the old order of things has passed away.",
      5: "He who was seated on the throne said, 'I am making everything new!'",
    },
  },
};

export function getVerses(book: string, chapter: number): number[] {
  const chapterData = VERSES[book]?.[chapter];
  if (chapterData) return Object.keys(chapterData).map(Number).sort((a, b) => a - b);
  // Fallback: generate verse numbers 1-20
  return Array.from({ length: 20 }, (_, i) => i + 1);
}

export function getVerseText(book: string, chapter: number, verse: number): string {
  return (
    VERSES[book]?.[chapter]?.[verse] ??
    `${book} ${chapter}:${verse} — "For I know the plans I have for you," declares the Lord, "plans to prosper you and not to harm you, plans to give you hope and a future."`
  );
}
