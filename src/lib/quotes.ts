import { EDITION } from "./edition";
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

/**
 * Hushed Tales' (IMP-29): uplifting words about writing, by authors who died before 1955, so their words are free of
 * copyright, each found in its book, letter or diary (Project Gutenberg, Wikisource, Wikivir, Internet Archive scans)
 * and given as the source has it, shortened only with "…". What wasn't written in English or Slovenian is translated
 * here from its original; Slovenian authors in their own words, in today's spelling.
 */
export const WRITING: Record<UiLanguage, Quote>[] = [
  {
    en: { text: "So long as you write what you wish to write, that is all that matters; and whether it matters for ages or only for hours, nobody can say.", reference: "Virginia Woolf, A Room of One’s Own" },
    sl: { text: "Dokler pišete, kar želite pisati, je samo to pomembno; ali bo pomembno stoletja ali le nekaj ur, tega nihče ne ve.", reference: "Virginia Woolf, Lastna soba" },
  },
  {
    en: { text: "Everything is the proper stuff of fiction, every feeling, every thought.", reference: "Virginia Woolf, Modern Fiction" },
    sl: { text: "Vse je prava snov za prozo, vsak občutek, vsaka misel.", reference: "Virginia Woolf, »Modern Fiction«" },
  },
  {
    en: { text: "I must confess that I think her as delightful a creature as ever appeared in print.", reference: "Jane Austen, of Elizabeth Bennet, in a letter, 1813" },
    sl: { text: "Priznati moram, da se mi zdi najbolj ljubko bitje, kar jih je kdaj prišlo v tisk.", reference: "Jane Austen o Elizabeth Bennet, v pismu, 1813" },
  },
  {
    en: { text: "Three or four families in a country village is the very thing to work on.", reference: "Jane Austen, to her niece Anna, who was writing a novel, 1814" },
    sl: { text: "Tri ali štiri družine v podeželski vasi so ravno pravšnja snov za delo.", reference: "Jane Austen nečakinji Anni, ki je pisala roman, 1814" },
  },
  {
    en: { text: "Imagination is a strong, restless faculty, which claims to be heard and exercised.", reference: "Charlotte Brontë, in a letter, 1847" },
    sl: { text: "Domišljija je močna, nemirna sposobnost, ki zahteva, da jo slišimo in uporabljamo.", reference: "Charlotte Brontë, v pismu, 1847" },
  },
  {
    en: { text: "September, 1856, made a new era in my life, for it was then I began to write fiction.", reference: "George Eliot, journal, 1857" },
    sl: { text: "September 1856 je v mojem življenju začel novo obdobje, saj sem takrat začela pisati leposlovje.", reference: "George Eliot, dnevnik, 1857" },
  },
  {
    en: { text: "I’d have … rooms piled high with books, and I’d write out of a magic inkstand.", reference: "Louisa May Alcott, Little Women" },
    sl: { text: "Imela bi … sobe, do stropa polne knjig, in pisala bi iz čarobne črnilnice.", reference: "Louisa May Alcott, Male ženske" },
  },
  {
    en: { text: "I never had a study. Any pen and paper do, and an old atlas on my knee is all I want.", reference: "Louisa May Alcott" },
    sl: { text: "Nikoli nisem imela delovne sobe. Zadoščata katero koli pero in papir, in star atlas na kolenih je vse, kar potrebujem.", reference: "Louisa May Alcott" },
  },
  {
    en: { text: "Better far write twaddle or anything, anything, than nothing at all.", reference: "Katherine Mansfield, 1922" },
    sl: { text: "Veliko bolje je pisati neumnosti ali karkoli, karkoli, kot pa nič.", reference: "Katherine Mansfield, 1922" },
  },
  {
    en: { text: "A word is dead / When it is said, / Some say. / I say it just / Begins to live / That day.", reference: "Emily Dickinson" },
    sl: { text: "Beseda je mrtva, / ko je izrečena, / pravijo nekateri. / Jaz pa pravim, da šele / tisti dan / začne živeti.", reference: "Emily Dickinson" },
  },
  {
    en: { text: "As a child I scribbled; and my favourite pastime, during the hours given me for recreation, was to “write stories.”", reference: "Mary Shelley, introduction to Frankenstein" },
    sl: { text: "Kot otrok sem ves čas nekaj čečkala; in moja najljubša zabava v urah, ki so mi bile dane za razvedrilo, je bila »pisati zgodbe«.", reference: "Mary Shelley, uvod k Frankensteinu" },
  },
  {
    en: { text: "Everything’s a story. You are a story—I am a story.", reference: "Frances Hodgson Burnett, A Little Princess" },
    sl: { text: "Vse je zgodba. Ti si zgodba – jaz sem zgodba.", reference: "Frances Hodgson Burnett, Mala princesa" },
  },
  {
    en: { text: "You’ll be able to do something by and by. Something—I don’t know how much—but keep on—keep on.", reference: "L. M. Montgomery, Emily of New Moon" },
    sl: { text: "Nekoč boš nekaj zmogla. Nekaj – ne vem, koliko – a vztrajaj, vztrajaj.", reference: "L. M. Montgomery, Emily of New Moon" },
  },
  {
    en: { text: "You must find your own quiet centre of life, and write from that to the world.", reference: "Sarah Orne Jewett, to Willa Cather, 1908" },
    sl: { text: "Poiskati morate svoje tiho središče življenja in iz njega pisati svetu.", reference: "Sarah Orne Jewett Willi Cather, 1908" },
  },
  {
    en: { text: "Write while the heat is in you.", reference: "Henry David Thoreau, journal, 1852" },
    sl: { text: "Piši, dokler je v tebi žar.", reference: "Henry David Thoreau, dnevnik, 1852" },
  },
  {
    en: { text: "Try to be one of the people on whom nothing is lost!", reference: "Henry James, The Art of Fiction" },
    sl: { text: "Skušajte biti eden tistih ljudi, ki jim nič ne uide!", reference: "Henry James, »The Art of Fiction«" },
  },
  {
    en: { text: "Every artist was first an amateur.", reference: "Ralph Waldo Emerson" },
    sl: { text: "Vsak umetnik je bil najprej ljubitelj.", reference: "Ralph Waldo Emerson" },
  },
  {
    en: { text: "I kept always two books in my pocket, one to read, one to write in.", reference: "Robert Louis Stevenson" },
    sl: { text: "V žepu sem imel vedno dve knjigi: eno za branje, eno za pisanje.", reference: "Robert Louis Stevenson" },
  },
  {
    en: { text: "A small daily task, if it be really daily, will beat the labours of a spasmodic Hercules.", reference: "Anthony Trollope, An Autobiography" },
    sl: { text: "Majhna vsakdanja naloga, če je res vsakdanja, premaga napore Herkula, ki dela v sunkih.", reference: "Anthony Trollope, Avtobiografija" },
  },
  {
    en: { text: "“Begin at the beginning,” the King said gravely, “and go on till you come to the end: then stop.”", reference: "Lewis Carroll, Alice’s Adventures in Wonderland" },
    sl: { text: "»Začni na začetku,« je resno rekel Kralj, »in nadaljuj, dokler ne prideš do konca: potem pa nehaj.«", reference: "Lewis Carroll, Alica v čudežni deželi" },
  },
  {
    en: { text: "Don’t loaf and invite inspiration; light out after it with a club.", reference: "Jack London, Getting Into Print" },
    sl: { text: "Ne lenarite in ne vabite navdiha; pojdite nadenj s kijem.", reference: "Jack London, »Getting Into Print«" },
  },
  {
    en: { text: "The difference between the almost right word and the right word is really a large matter—’tis the difference between the lightning-bug and the lightning.", reference: "Mark Twain, in a letter, 1888" },
    sl: { text: "Razlika med skoraj pravo besedo in pravo besedo je zares velika: kot razlika med kresnico in strelo.", reference: "Mark Twain, v pismu, 1888" },
  },
  {
    en: { text: "The poet’s pen / Turns them to shapes, and gives to airy nothing / A local habitation and a name.", reference: "William Shakespeare, A Midsummer Night’s Dream" },
    sl: { text: "Pesnikovo pero / jim da podobo in zračnemu ničemur / prebivališče in ime.", reference: "William Shakespeare, Sen kresne noči" },
  },
  {
    en: { text: "Poetry is the record of the best and happiest moments of the happiest and best minds.", reference: "Percy Bysshe Shelley, A Defence of Poetry" },
    sl: { text: "Poezija je zapis najboljših in najsrečnejših trenutkov najsrečnejših in najboljših duhov.", reference: "Percy Bysshe Shelley, Zagovor poezije" },
  },
  {
    en: {
      text: "Being an artist means not reckoning and counting; ripening like the tree, which does not force its sap and stands confident in the storms of spring, without fear that no summer might come after. It does come.",
      reference: "Rainer Maria Rilke, Letters to a Young Poet",
    },
    sl: {
      text: "Biti umetnik pomeni ne računati in ne šteti; zoreti kakor drevo, ki ne priganja svojih sokov in spokojno stoji v pomladnih viharjih, brez strahu, da za njimi ne bi prišlo poletje. Saj pride.",
      reference: "Rainer Maria Rilke, Pisma mlademu pesniku",
    },
  },
  {
    en: { text: "One ought every day at least to hear a little song, read a good poem, see a fine painting and, if it could be managed, speak a few sensible words.", reference: "Johann Wolfgang von Goethe, Wilhelm Meister’s Apprenticeship" },
    sl: { text: "Vsak dan bi morali slišati vsaj kakšno pesmico, prebrati dobro pesem, videti odlično sliko in, če bi se le dalo, izreči nekaj pametnih besed.", reference: "Johann Wolfgang von Goethe, Učna leta Wilhelma Meistra" },
  },
  {
    en: { text: "Good or bad, it is a delicious thing to write, to be no longer yourself, but to move through the whole creation you are telling of.", reference: "Gustave Flaubert, in a letter, 1853" },
    sl: { text: "Dobro ali slabo, pisati je nekaj čudovitega: ne biti več sam svoj, ampak se gibati po vsem stvarstvu, o katerem pripoveduješ.", reference: "Gustave Flaubert, v pismu, 1853" },
  },
  {
    en: { text: "For the word, let it be known, is a living being.", reference: "Victor Hugo, Les Contemplations" },
    sl: { text: "Kajti beseda, naj se ve, je živo bitje.", reference: "Victor Hugo, Kontemplacije" },
  },
  {
    en: { text: "The smallest thing holds a little of the unknown. Let us find it.", reference: "Guy de Maupassant, preface to Pierre and Jean" },
    sl: { text: "Tudi najmanjša stvar skriva nekaj neznanega. Poiščimo ga.", reference: "Guy de Maupassant, predgovor k Pierru in Jeanu" },
  },
  {
    en: { text: "I have no more made my book than my book has made me.", reference: "Michel de Montaigne, Essays" },
    sl: { text: "Svoje knjige nisem naredil nič bolj, kot je moja knjiga naredila mene.", reference: "Michel de Montaigne, Eseji" },
  },
  {
    en: {
      text: "There are perhaps no days of our childhood that we lived so fully as those we thought we had let pass without living them, those we spent with a favourite book.",
      reference: "Marcel Proust, On Reading",
    },
    sl: {
      text: "Morda ni dni našega otroštva, ki bi jih živeli tako polno kot tiste, za katere smo mislili, da so minili, ne da bi jih živeli: tiste, ki smo jih preživeli z najljubšo knjigo.",
      reference: "Marcel Proust, O branju",
    },
  },
  {
    en: { text: "And thoughts stir boldly in my head, / and light rhymes run out to meet them, / and fingers ask for the pen, the pen for paper; / a minute, and the verses freely flow.", reference: "Alexander Pushkin, Autumn" },
    sl: { text: "In misli v glavi drzno valovijo, / lahke rime jim tečejo naproti, / prsti prosijo za pero, pero za papir; / še minuta in verzi svobodno stečejo.", reference: "Aleksander Puškin, Jesen" },
  },
  {
    en: { text: "Don’t lick it smooth, don’t polish it; be clumsy and bold. Brevity is the sister of talent.", reference: "Anton Chekhov, in a letter to his brother, 1889" },
    sl: { text: "Ne gladi in ne brusi, ampak bodi neroden in drzen. Kratkost je sestra talenta.", reference: "Anton Čehov, v pismu bratu, 1889" },
  },
  {
    en: { text: "My heart will come to life again, anew; / the flowers of clear poems will grow in it / and put forth new blossom, more gladly.", reference: "France Prešeren, A Wreath of Sonnets" },
    sl: { text: "Na novo bo srce spet oživelo, / v njem rasle jasnih poezij cvetlice / in gnale bodo nov cvet bolj veselo.", reference: "France Prešeren, Sonetni venec" },
  },
  {
    en: { text: "That is remembrance enough: my songs sing of me.", reference: "Valentin Vodnik, My Monument" },
    sl: { text: "Dovolj je spomina: me pesmi pojo.", reference: "Valentin Vodnik, Moj spominik" },
  },
  {
    en: { text: "The Slovenian word is a word of holidays, of song and of shouts of joy.", reference: "Ivan Cankar, Kurent" },
    sl: { text: "Slovenska beseda je beseda praznika, petja in vriskanja.", reference: "Ivan Cankar, Kurent" },
  },
  {
    en: { text: "The whole world was in me; and I give it all my beauty and create it anew.", reference: "Ivan Cankar, Strangers" },
    sl: { text: "Ves svet je bil v meni; in dam mu vso svojo lepoto in ga ustvarim iznova.", reference: "Ivan Cankar, Tujci" },
  },
  {
    en: { text: "One word I would like to say, / that like a spring wind / it might come softly into your hearts, / one word I would like to say.", reference: "Srečko Kosovel, One Word" },
    sl: { text: "Eno besedo bi rekel rad, / da bi kot veter pomladni / mehka v vaša srca prišla, / eno besedo bi rekel rad.", reference: "Srečko Kosovel, Eno besedo" },
  },
  {
    en: {
      text: "Once again I believe in my strength, my ability and my will, and I know I shall not falter before the goal! I took a deep breath, lit the lamp and wrote this sketch.",
      reference: "Zofka Kveder, Sketches",
    },
    sl: {
      text: "Zopet verujem v svojo moč, v svojo zmožnost in v svojo voljo in vem, da ne omagam pred ciljem! Oddihnila sem se globoko, nažgala luč in napisala to črtico.",
      reference: "Zofka Kveder, Črtice",
    },
  },
];

// Home shows the verses in Pensieve, and the words about writing in Hushed Tales.
const QUOTES = EDITION === "hushed" ? WRITING : VERSES;

/** A quote chosen at random, as its place in the list, so it stays the same one in either language. */
export function randomQuote(): number {
  return Math.floor(Math.random() * QUOTES.length);
}

/** The quote at `index` in the interface language: a verse in Pensieve, words about writing in Hushed Tales. */
export function homeQuote(index: number, language: UiLanguage): Quote {
  return (QUOTES[index] ?? QUOTES[0])[language];
}
