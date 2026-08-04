const TAMIL_MAPPING: Record<string, string> = {
  // Uyir Ezhuthu
  'அ': 'a', 'ஆ': 'a', 'இ': 'i', 'ஈ': 'i', 'உ': 'u', 'ஊ': 'u', 'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'ou', 'ஃ': '',
  
  // Mei Ezhuthu
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n', 'த': 't', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'l', 'ள': 'l', 'ற': 'r', 'ன': 'n', 
  
  // Grantha
  'ஜ': 'j', 'ஷ': 's', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh',
  
  // Uyir Mei Extensions (Simplified to vowels)
  'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'ou', '்': '',
};

export function getPhoneticKey(text: string): string {
  if (!text) return '';
  
  let t = '';
  // 1. Transliterate Tamil to English roughly
  for (const char of text) {
    t += TAMIL_MAPPING[char] ?? char;
  }
  
  t = t.toLowerCase();
  
  // 2. Normalize phonetic equivalents
  t = t.replace(/th|dh|d/g, 't')
       .replace(/b/g, 'p')
       .replace(/g|c/g, 'k')
       .replace(/w/g, 'v')
       .replace(/z|sh|ch/g, 's')
       .replace(/nj|ng/g, 'n')
       .replace(/zh/g, 'l');

  // 3. Keep only alphanumeric
  t = t.replace(/[^a-z0-9]/g, '');

  // 4. Remove all vowels and h (leaving mostly strong consonants)
  t = t.replace(/[aeiouyh]/g, '');
  
  // 5. Remove repeating adjacent characters (e.g. tt -> t, nn -> n)
  t = t.replace(/(.)\1+/g, '$1');

  return t;
}

export function smartFuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  
  // 1. Standard exact substring match (case insensitive)
  if (text.toLowerCase().includes(query.toLowerCase())) return true;
  
  // 2. Transliterated phonetic match
  const phoneticQuery = getPhoneticKey(query);
  const phoneticText = getPhoneticKey(text);
  
  if (phoneticQuery.length === 0) return false;
  
  return phoneticText.includes(phoneticQuery);
}
