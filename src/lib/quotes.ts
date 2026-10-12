import type { UiLanguage } from "./i18n";

export type Quote = {
  text: string;
  reference: string;
};

/**
 * Short verses for Home: in English from the King James Bible, which is in the public domain; in Slovenian
 * from the Slovenski standardni prevod (SSP), as written on biblija.net. The Bible Society of Slovenia lets a
 * work that isn't sold quote up to 500 of its verses, each marked "(SSP)" ("Pravica do uporabe SSP"). Some
 * psalms' verses are one higher in Slovenian, which counts their headings as verses.
 */
const VERSES: Record<UiLanguage, Quote>[] = [
  {
    en: { text: "Write the vision, and make it plain.", reference: "Habakkuk 2:2" },
    sl: { text: "Zapiši videnje in vreži ga na plošče.", reference: "Habakuk 2,2 (SSP)" },
  },
  {
    en: { text: "My tongue is the pen of a ready writer.", reference: "Psalm 45:1" },
    sl: { text: "Moj jezik je pisalo hitrega pisca.", reference: "Psalm 45,2 (SSP)" },
  },
  {
    en: { text: "A word fitly spoken is like apples of gold in pictures of silver.", reference: "Proverbs 25:11" },
    sl: { text: "Zlata jabolka v srebrnih koških so besede, izrečene o pravem času.", reference: "Pregovori 25,11 (SSP)" },
  },
  {
    en: { text: "Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight.", reference: "Psalm 19:14" },
    sl: { text: "Naj ti bodo v veselje izreki mojih ust, premišljanje mojega srca pred tvojim obličjem.", reference: "Psalm 19,15 (SSP)" },
  },
  {
    en: { text: "Write thee all the words that I have spoken unto thee in a book.", reference: "Jeremiah 30:2" },
    sl: { text: "Zapiši si v knjigo vse besede, ki ti jih govorim.", reference: "Jeremija 30,2 (SSP)" },
  },
  {
    en: { text: "In quietness and in confidence shall be your strength.", reference: "Isaiah 30:15" },
    sl: { text: "V mirovanju in zaupanju je vaša moč.", reference: "Izaija 30,15 (SSP)" },
  },
  {
    en: { text: "Be still, and know that I am God.", reference: "Psalm 46:10" },
    sl: { text: "Odnehajte in spoznajte, da sem jaz Bog.", reference: "Psalm 46,11 (SSP)" },
  },
  {
    en: { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    sl: { text: "Gospod je moj pastir, nič mi ne manjka.", reference: "Psalm 23,1 (SSP)" },
  },
  {
    en: { text: "The Lord is my light and my salvation; whom shall I fear?", reference: "Psalm 27:1" },
    sl: { text: "Gospod je moja luč in moja rešitev, koga bi se moral bati?", reference: "Psalm 27,1 (SSP)" },
  },
  {
    en: { text: "God is our refuge and strength, a very present help in trouble.", reference: "Psalm 46:1" },
    sl: { text: "Bog nam je zatočišče in moč, pomoč v stiskah, vedno navzoča.", reference: "Psalm 46,2 (SSP)" },
  },
  {
    en: { text: "Weeping may endure for a night, but joy cometh in the morning.", reference: "Psalm 30:5" },
    sl: { text: "Zvečer se naseli jokanje, proti jutru pa pride vriskanje.", reference: "Psalm 30,6 (SSP)" },
  },
  {
    en: { text: "Create in me a clean heart, O God.", reference: "Psalm 51:10" },
    sl: { text: "Čisto srce, o Bog, mi ustvari.", reference: "Psalm 51,12 (SSP)" },
  },
  {
    en: { text: "This is the day which the Lord hath made; we will rejoice and be glad in it.", reference: "Psalm 118:24" },
    sl: { text: "To je dan, ki ga je naredil Gospod, radujmo se in se ga veselimo.", reference: "Psalm 118,24 (SSP)" },
  },
  {
    en: { text: "Thy word is a lamp unto my feet, and a light unto my path.", reference: "Psalm 119:105" },
    sl: { text: "Tvoja beseda je svetilka mojim nogam, luč moji stezi.", reference: "Psalm 119,105 (SSP)" },
  },
  {
    en: { text: "I will lift up mine eyes unto the hills, from whence cometh my help.", reference: "Psalm 121:1" },
    sl: { text: "Svoje oči vzdigujem h goram: od kod bo prišla moja pomoč?", reference: "Psalm 121,1 (SSP)" },
  },
  {
    en: { text: "Trust in the Lord with all thine heart, and lean not unto thine own understanding.", reference: "Proverbs 3:5" },
    sl: { text: "Zaupaj v Gospoda z vsem svojim srcem, na svojo razumnost pa se ne zanašaj.", reference: "Pregovori 3,5 (SSP)" },
  },
  {
    en: { text: "Commit thy works unto the Lord, and thy thoughts shall be established.", reference: "Proverbs 16:3" },
    sl: { text: "Gospodu priporočaj svoja dela in tvoji načrti se bodo uresničili.", reference: "Pregovori 16,3 (SSP)" },
  },
  {
    en: { text: "A man's heart deviseth his way, but the Lord directeth his steps.", reference: "Proverbs 16:9" },
    sl: { text: "Človekovo srce načrtuje svojo pot, a Gospod vodi njegove korake.", reference: "Pregovori 16,9 (SSP)" },
  },
  {
    en: { text: "Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.", reference: "Proverbs 16:24" },
    sl: { text: "Prijazni izreki so satovje medu, sladki za dušo in zdravi za kosti.", reference: "Pregovori 16,24 (SSP)" },
  },
  {
    en: { text: "Death and life are in the power of the tongue.", reference: "Proverbs 18:21" },
    sl: { text: "Smrt in življenje sta v oblasti jezika.", reference: "Pregovori 18,21 (SSP)" },
  },
  {
    en: { text: "To every thing there is a season, and a time to every purpose under the heaven.", reference: "Ecclesiastes 3:1" },
    sl: { text: "Vse ima svojo uro, vsako veselje ima svoj čas pod nebom.", reference: "Pridigar 3,1 (SSP)" },
  },
  {
    en: { text: "He hath made every thing beautiful in his time.", reference: "Ecclesiastes 3:11" },
    sl: { text: "Dela vse lepo ob svojem času.", reference: "Pridigar 3,11 (SSP)" },
  },
  {
    en: { text: "They that wait upon the Lord shall renew their strength.", reference: "Isaiah 40:31" },
    sl: { text: "Tisti pa, ki zaupajo v Gospoda, obnavljajo svojo moč.", reference: "Izaija 40,31 (SSP)" },
  },
  {
    en: { text: "Fear thou not, for I am with thee.", reference: "Isaiah 41:10" },
    sl: { text: "Ne boj se, saj sem s teboj.", reference: "Izaija 41,10 (SSP)" },
  },
  {
    en: { text: "Be strong and of a good courage; be not afraid, neither be thou dismayed.", reference: "Joshua 1:9" },
    sl: { text: "Ali ti nisem ukazal, krepak in odločen bodi? Ne boj se in se ne plaši.", reference: "Jozue 1,9 (SSP)" },
  },
  {
    en: { text: "The joy of the Lord is your strength.", reference: "Nehemiah 8:10" },
    sl: { text: "Gospodovo veselje je vaša moč.", reference: "Nehemija 8,10 (SSP)" },
  },
  {
    en: { text: "The Lord bless thee, and keep thee.", reference: "Numbers 6:24" },
    sl: { text: "Gospod naj te blagoslovi in te varuje.", reference: "4 Mojzes 6,24 (SSP)" },
  },
  {
    en: { text: "Ye are the light of the world.", reference: "Matthew 5:14" },
    sl: { text: "Vi ste luč sveta.", reference: "Matej 5,14 (SSP)" },
  },
  {
    en: { text: "Let your light so shine before men.", reference: "Matthew 5:16" },
    sl: { text: "Takó naj vaša luč sveti pred ljudmi.", reference: "Matej 5,16 (SSP)" },
  },
  {
    en: { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", reference: "Matthew 11:28" },
    sl: { text: "Pridite k meni vsi, ki ste utrujeni in obteženi, in jaz vam bom dal počitek.", reference: "Matej 11,28 (SSP)" },
  },
  {
    en: { text: "In the beginning was the Word.", reference: "John 1:1" },
    sl: { text: "V začetku je bila Beseda.", reference: "Janez 1,1 (SSP)" },
  },
  {
    en: { text: "I am the light of the world.", reference: "John 8:12" },
    sl: { text: "Jaz sem luč sveta.", reference: "Janez 8,12 (SSP)" },
  },
  {
    en: { text: "Ye shall know the truth, and the truth shall make you free.", reference: "John 8:32" },
    sl: { text: "Spoznali boste resnico in resnica vas bo osvobodila.", reference: "Janez 8,32 (SSP)" },
  },
  {
    en: { text: "Peace I leave with you, my peace I give unto you.", reference: "John 14:27" },
    sl: { text: "Mir vam zapuščam, svoj mir vam dajem.", reference: "Janez 14,27 (SSP)" },
  },
  {
    en: { text: "I can do all things through Christ which strengtheneth me.", reference: "Philippians 4:13" },
    sl: { text: "Vse zmorem v njem, ki mi daje moč.", reference: "Filipljanom 4,13 (SSP)" },
  },
  {
    en: { text: "Rejoice in the Lord alway: and again I say, Rejoice.", reference: "Philippians 4:4" },
    sl: { text: "Veselite se v Gospodu zmeraj; ponavljam vam, veselite se.", reference: "Filipljanom 4,4 (SSP)" },
  },
  {
    en: { text: "Whatsoever ye do, do it heartily, as to the Lord.", reference: "Colossians 3:23" },
    sl: { text: "Kar koli že delate, delajte iz srca, kot da delate za Gospoda.", reference: "Kološanom 3,23 (SSP)" },
  },
  {
    en: { text: "Faith is the substance of things hoped for, the evidence of things not seen.", reference: "Hebrews 11:1" },
    sl: { text: "Je pa vera obstoj resničnosti, v katere upamo, zagotovilo stvari, ki jih ne vidimo.", reference: "Hebrejcem 11,1 (SSP)" },
  },
  {
    en: { text: "They are new every morning: great is thy faithfulness.", reference: "Lamentations 3:23" },
    sl: { text: "Nova je vsako jutro, velika je tvoja zvestoba.", reference: "Žalostinke 3,23 (SSP)" },
  },
  {
    en: { text: "Do justly, and love mercy, and walk humbly with thy God.", reference: "Micah 6:8" },
    sl: { text: "Nič drugega, kakor da ravnaš pravično, da ljubiš dobrohotnost in ponižno hodiš s svojim Bogom.", reference: "Mihej 6,8 (SSP)" },
  },
];

/** A verse chosen at random, as its place in the list, so it stays the same verse in either language. */
export function randomVerse(): number {
  return Math.floor(Math.random() * VERSES.length);
}

/** The verse at `index` in the interface language. */
export function verse(index: number, language: UiLanguage): Quote {
  return (VERSES[index] ?? VERSES[0])[language];
}
