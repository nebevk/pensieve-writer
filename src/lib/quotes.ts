export type Quote = {
  text: string;
  reference: string;
};

/** Short lines from the King James Bible, which is in the public domain. */
export const quotes: Quote[] = [
  { text: "Write the vision, and make it plain.", reference: "Habakkuk 2:2" },
  { text: "My tongue is the pen of a ready writer.", reference: "Psalm 45:1" },
  { text: "A word fitly spoken is like apples of gold in pictures of silver.", reference: "Proverbs 25:11" },
  { text: "Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight.", reference: "Psalm 19:14" },
  { text: "Write thee all the words that I have spoken unto thee in a book.", reference: "Jeremiah 30:2" },
  { text: "In quietness and in confidence shall be your strength.", reference: "Isaiah 30:15" },
  { text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
  { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
  { text: "The Lord is my light and my salvation; whom shall I fear?", reference: "Psalm 27:1" },
  { text: "God is our refuge and strength, a very present help in trouble.", reference: "Psalm 46:1" },
  { text: "Weeping may endure for a night, but joy cometh in the morning.", reference: "Psalm 30:5" },
  { text: "Create in me a clean heart, O God.", reference: "Psalm 51:10" },
  { text: "This is the day which the Lord hath made; we will rejoice and be glad in it.", reference: "Psalm 118:24" },
  { text: "Thy word is a lamp unto my feet, and a light unto my path.", reference: "Psalm 119:105" },
  { text: "I will lift up mine eyes unto the hills, from whence cometh my help.", reference: "Psalm 121:1" },
  { text: "Trust in the Lord with all thine heart, and lean not unto thine own understanding.", reference: "Proverbs 3:5" },
  { text: "Commit thy works unto the Lord, and thy thoughts shall be established.", reference: "Proverbs 16:3" },
  { text: "A man's heart deviseth his way, but the Lord directeth his steps.", reference: "Proverbs 16:9" },
  { text: "Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.", reference: "Proverbs 16:24" },
  { text: "Death and life are in the power of the tongue.", reference: "Proverbs 18:21" },
  { text: "To every thing there is a season, and a time to every purpose under the heaven.", reference: "Ecclesiastes 3:1" },
  { text: "He hath made every thing beautiful in his time.", reference: "Ecclesiastes 3:11" },
  { text: "They that wait upon the Lord shall renew their strength.", reference: "Isaiah 40:31" },
  { text: "Fear thou not, for I am with thee.", reference: "Isaiah 41:10" },
  { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed.", reference: "Joshua 1:9" },
  { text: "The joy of the Lord is your strength.", reference: "Nehemiah 8:10" },
  { text: "The Lord bless thee, and keep thee.", reference: "Numbers 6:24" },
  { text: "Ye are the light of the world.", reference: "Matthew 5:14" },
  { text: "Let your light so shine before men.", reference: "Matthew 5:16" },
  { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", reference: "Matthew 11:28" },
  { text: "In the beginning was the Word.", reference: "John 1:1" },
  { text: "I am the light of the world.", reference: "John 8:12" },
  { text: "Ye shall know the truth, and the truth shall make you free.", reference: "John 8:32" },
  { text: "Peace I leave with you, my peace I give unto you.", reference: "John 14:27" },
  { text: "I can do all things through Christ which strengtheneth me.", reference: "Philippians 4:13" },
  { text: "Rejoice in the Lord alway: and again I say, Rejoice.", reference: "Philippians 4:4" },
  { text: "Whatsoever ye do, do it heartily, as to the Lord.", reference: "Colossians 3:23" },
  { text: "Faith is the substance of things hoped for, the evidence of things not seen.", reference: "Hebrews 11:1" },
  { text: "They are new every morning: great is thy faithfulness.", reference: "Lamentations 3:23" },
  { text: "Do justly, and love mercy, and walk humbly with thy God.", reference: "Micah 6:8" },
];

export function randomQuote(source: Quote[] = quotes): Quote {
  return source[Math.floor(Math.random() * source.length)] ?? source[0];
}
