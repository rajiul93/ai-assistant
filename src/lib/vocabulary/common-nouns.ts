/**
 * Built-in list of nouns with their plural and Bangla meaning, shown to every user in
 * Vocabulary → Singular · Plural (read-only, next to the user's own entries). Weighted towards
 * what job exams ask: irregular, foreign, compound and same-form plurals, and uncountable nouns.
 *
 * One noun per line:
 *   "singular|meaning"            regular plural (book → books, box → boxes, city → cities)
 *   "singular|plural|meaning"     any other plural; "a / b" when both are in use
 *   "singular|-|meaning"          uncountable: no plural (information)
 *   "-|plural|meaning"            used only in the plural (scissors)
 * A meaning starting with "*" is a person, so its Bangla plural takes "-রা" (শিশুরা), not "-গুলো".
 */
const data = `
book|বই
pen|কলম
tree|গাছ
bird|পাখি
cow|গরু
horse|ঘোড়া
house|বাড়ি
river|নদী
flower|ফুল
road|রাস্তা
car|গাড়ি
door|দরজা
window|জানালা
table|টেবিল
chair|চেয়ার
boy|*ছেলে
girl|*মেয়ে
student|*ছাত্র
teacher|*শিক্ষক
friend|*বন্ধু
doctor|*চিকিৎসক
farmer|*কৃষক
king|*রাজা
queen|*রানি
day|দিন
key|চাবি
toy|খেলনা
monkey|বানর
donkey|গাধা
valley|উপত্যকা
chimney|চিমনি
journey|যাত্রা
essay|প্রবন্ধ
holiday|ছুটি
city|শহর
lady|*মহিলা
baby|*শিশু
story|গল্প
country|দেশ
family|পরিবার
party|দল / উৎসব
army|সেনাবাহিনী
fly|মাছি
enemy|*শত্রু
duty|দায়িত্ব
library|গ্রন্থাগার
factory|কারখানা
box|বাক্স
bus|বাস
class|শ্রেণি
glass|গ্লাস / চশমা
dish|থালা
brush|ব্রাশ
church|গির্জা
watch|ঘড়ি
match|দেশলাই / খেলা
bench|বেঞ্চ
fox|শিয়াল
tax|কর
kiss|চুমু
wish|ইচ্ছা
branch|শাখা
beach|সমুদ্রসৈকত
address|ঠিকানা
process|প্রক্রিয়া
witness|*সাক্ষী
princess|*রাজকন্যা
lens|লেন্স
gas|গ্যাস
quiz|quizzes|কুইজ
stomach|stomachs|পাকস্থলী
monarch|monarchs|*রাজা / সম্রাট
epoch|epochs|যুগ
patriarch|patriarchs|*গোত্রপ্রধান
man|men|*পুরুষ
woman|women|*মহিলা
child|children|*শিশু
person|people / persons|*ব্যক্তি
foot|feet|পা
tooth|teeth|দাঁত
goose|geese|রাজহাঁস
mouse|mice|ইঁদুর
louse|lice|উকুন
ox|oxen|ষাঁড়
die|dice|পাশার ঘুঁটি
penny|pence / pennies|পেনি
Englishman|Englishmen|*ইংরেজ
Frenchman|Frenchmen|*ফরাসি
fireman|firemen|*দমকলকর্মী
policeman|policemen|*পুলিশ সদস্য
fisherman|fishermen|*জেলে
postman|postmen|*ডাকপিয়ন
chairman|chairmen|*সভাপতি
gentleman|gentlemen|*ভদ্রলোক
workman|workmen|*শ্রমিক
boatman|boatmen|*মাঝি
milkman|milkmen|*গোয়ালা
salesman|salesmen|*বিক্রয়কর্মী
statesman|statesmen|*রাষ্ট্রনায়ক
German|Germans|*জার্মান
Roman|Romans|*রোমান
Norman|Normans|*নর্মান
Mussulman|Mussulmans|*মুসলমান
talisman|talismans|তাবিজ
ottoman|ottomans|গদিওয়ালা আসন
brother-in-law|brothers-in-law|*শ্যালক / দুলাভাই
sister-in-law|sisters-in-law|*ননদ / শ্যালিকা
mother-in-law|mothers-in-law|*শাশুড়ি
father-in-law|fathers-in-law|*শ্বশুর
son-in-law|sons-in-law|*জামাই
daughter-in-law|daughters-in-law|*পুত্রবধূ
passer-by|passers-by|*পথচারী
looker-on|lookers-on|*দর্শক
hanger-on|hangers-on|*তোষামোদকারী
commander-in-chief|commanders-in-chief|*প্রধান সেনাপতি
governor-general|governors-general|*গভর্নর জেনারেল
attorney-general|attorneys-general|*অ্যাটর্নি জেনারেল
court-martial|courts-martial|সামরিক আদালত
man-of-war|men-of-war|যুদ্ধজাহাজ
maid-of-honour|maids-of-honour|*রানির সহচরী
coat-of-mail|coats-of-mail|বর্ম
man-servant|men-servants|*ভৃত্য
woman-doctor|women-doctors|*মহিলা চিকিৎসক
lady-doctor|lady-doctors|*মহিলা চিকিৎসক
maid-servant|maid-servants|*দাসী
step-son|step-sons|*সৎ ছেলে
step-mother|step-mothers|*সৎ মা
grown-up|grown-ups|*প্রাপ্তবয়স্ক
forget-me-not|forget-me-nots|ফুলবিশেষ
spoonful|spoonfuls|চামচ-ভর্তি
handful|handfuls|মুঠো
mouthful|mouthfuls|এক গ্রাস
cupful|cupfuls|কাপ-ভর্তি
sheep|sheep|ভেড়া
deer|deer|হরিণ
fish|fish / fishes|মাছ
swine|swine|শূকর
aircraft|aircraft|উড়োজাহাজ
spacecraft|spacecraft|মহাকাশযান
series|series|ধারাবাহিক
species|species|প্রজাতি
salmon|salmon|স্যামন মাছ
trout|trout|ট্রাউট মাছ
cod|cod|কড মাছ
moose|moose|মুস হরিণ
bison|bison|বাইসন
dozen|dozen|ডজন (two dozen eggs)
score|score|কুড়ি (three score years)
hundred|hundred|শত (five hundred)
thousand|thousand|হাজার (two thousand)
means|means|উপায়
corps|corps|বাহিনী
crossroads|crossroads|চৌরাস্তা
headquarters|headquarters|সদর দপ্তর
offspring|offspring|*সন্তান
gross|gross|বারো ডজন
knife|knives|ছুরি
wife|wives|*স্ত্রী
life|lives|জীবন
leaf|leaves|পাতা
half|halves|অর্ধেক
calf|calves|বাছুর
wolf|wolves|নেকড়ে
thief|thieves|*চোর
loaf|loaves|পাউরুটি
shelf|shelves|তাক
self|selves|নিজ সত্তা
sheaf|sheaves|আঁটি
elf|elves|পরি
scarf|scarves / scarfs|স্কার্ফ
wharf|wharves / wharfs|জেটি
hoof|hooves / hoofs|খুর
dwarf|dwarfs / dwarves|*বামন
roof|roofs|ছাদ
chief|chiefs|*প্রধান
proof|proofs|প্রমাণ
belief|beliefs|বিশ্বাস
chef|chefs|*রাঁধুনি
cliff|cliffs|খাড়া পাহাড়
safe|safes|সিন্দুক
gulf|gulfs|উপসাগর
reef|reefs|প্রবাল প্রাচীর
grief|griefs|দুঃখ
handkerchief|handkerchiefs|রুমাল
serf|serfs|*ভূমিদাস
brief|briefs|সারসংক্ষেপ
staff|staffs|কর্মীবাহিনী
cuff|cuffs|জামার হাতা
potato|potatoes|আলু
tomato|tomatoes|টমেটো
hero|heroes|*বীর
echo|echoes|প্রতিধ্বনি
mango|mangoes|আম
buffalo|buffaloes|মহিষ
mosquito|mosquitoes|মশা
volcano|volcanoes|আগ্নেয়গিরি
cargo|cargoes|মালপত্র
veto|vetoes|ভেটো
torpedo|torpedoes|টর্পেডো
tornado|tornadoes|টর্নেডো
domino|dominoes|ডমিনো
photo|photos|ছবি
piano|pianos|পিয়ানো
radio|radios|রেডিও
kilo|kilos|কিলো
zoo|zoos|চিড়িয়াখানা
bamboo|bamboos|বাঁশ
video|videos|ভিডিও
studio|studios|স্টুডিও
ratio|ratios|অনুপাত
solo|solos|একক পরিবেশনা
memo|memos|স্মারকলিপি
canto|cantos|কাব্যের সর্গ
dynamo|dynamos|ডায়নামো
kangaroo|kangaroos|ক্যাঙারু
cuckoo|cuckoos|কোকিল
embryo|embryos|ভ্রূণ
logo|logos|লোগো
halo|halos / haloes|জ্যোতির্বলয়
zero|zeros / zeroes|শূন্য
criterion|criteria|মানদণ্ড
phenomenon|phenomena|ঘটনা / প্রপঞ্চ
automaton|automata|স্বয়ংক্রিয় যন্ত্র
datum|data|উপাত্ত
medium|media|মাধ্যম
memorandum|memoranda / memorandums|স্মারকলিপি
curriculum|curricula / curriculums|পাঠ্যক্রম
bacterium|bacteria|ব্যাকটেরিয়া
stratum|strata|স্তর
erratum|errata|মুদ্রণপ্রমাদ
agendum|agenda|আলোচ্য বিষয়
addendum|addenda|সংযোজন
millennium|millennia|সহস্রাব্দ
referendum|referendums / referenda|গণভোট
symposium|symposia / symposiums|আলোচনাসভা
stadium|stadiums / stadia|স্টেডিয়াম
aquarium|aquariums / aquaria|অ্যাকোয়ারিয়াম
radius|radii|ব্যাসার্ধ
nucleus|nuclei|নিউক্লিয়াস
fungus|fungi|ছত্রাক
cactus|cacti / cactuses|ক্যাকটাস
stimulus|stimuli|উদ্দীপক
syllabus|syllabi / syllabuses|পাঠ্যসূচি
alumnus|alumni|*প্রাক্তন ছাত্র
focus|foci / focuses|কেন্দ্রবিন্দু
locus|loci|অবস্থান
terminus|termini|প্রান্তিক স্টেশন
bacillus|bacilli|ব্যাসিলাস
genius|geniuses|*প্রতিভাবান ব্যক্তি
genus|genera|গণ (জীববিজ্ঞান)
corpus|corpora|সংকলন
opus|opera|সংগীতকর্ম
crisis|crises|সংকট
analysis|analyses|বিশ্লেষণ
basis|bases|ভিত্তি
thesis|theses|গবেষণাপত্র
hypothesis|hypotheses|অনুকল্প
oasis|oases|মরূদ্যান
axis|axes|অক্ষ
diagnosis|diagnoses|রোগনির্ণয়
synopsis|synopses|সারসংক্ষেপ
parenthesis|parentheses|বন্ধনী
ellipsis|ellipses|বর্জনচিহ্ন
emphasis|emphases|গুরুত্ব
synthesis|syntheses|সংশ্লেষণ
formula|formulae / formulas|সূত্র
antenna|antennae / antennas|শুঙ্গ / অ্যান্টেনা
larva|larvae|শূককীট
alga|algae|শৈবাল
vertebra|vertebrae|মেরুদণ্ডের হাড়
nebula|nebulae|নীহারিকা
alumna|alumnae|*প্রাক্তন ছাত্রী
index|indices / indexes|সূচক / সূচিপত্র
appendix|appendices / appendixes|পরিশিষ্ট
matrix|matrices|ম্যাট্রিক্স
vortex|vortices|ঘূর্ণি
vertex|vertices|শীর্ষবিন্দু
apex|apexes / apices|শীর্ষ
bureau|bureaus / bureaux|দপ্তর
plateau|plateaus / plateaux|মালভূমি
tableau|tableaux|জীবন্ত চিত্র
beau|beaux|*প্রেমিক
madam|mesdames|*ভদ্রমহিলা
monsieur|messieurs|*মহাশয়
cherub|cherubim / cherubs|*দেবশিশু
seraph|seraphim|*দেবদূত
-|scissors|কাঁচি
-|trousers|প্যান্ট
-|spectacles|চশমা
-|pants|প্যান্ট
-|tongs|চিমটা
-|pliers|প্লায়ার্স
-|shorts|হাফপ্যান্ট
-|jeans|জিন্স
-|binoculars|দূরবীন
-|goods|মালামাল
-|thanks|ধন্যবাদ
-|riches|ঐশ্বর্য
-|alms|ভিক্ষা
-|wages|মজুরি
-|surroundings|পারিপার্শ্বিক অবস্থা
-|outskirts|শহরতলি
-|premises|প্রাঙ্গণ
-|belongings|জিনিসপত্র
-|savings|সঞ্চয়
-|earnings|উপার্জন
-|clothes|কাপড়চোপড়
-|cattle|গবাদিপশু
-|police|পুলিশ
-|gentry|ভদ্রসমাজ
-|vermin|ক্ষতিকর কীটপতঙ্গ
information|-|তথ্য
advice|-|পরামর্শ
furniture|-|আসবাবপত্র
luggage|-|মালপত্র
baggage|-|মালপত্র
news|-|খবর (news is…)
mathematics|-|গণিত (mathematics is…)
physics|-|পদার্থবিজ্ঞান
economics|-|অর্থনীতি
politics|-|রাজনীতি
measles|-|হাম (রোগ)
equipment|-|সরঞ্জাম
machinery|-|যন্ত্রপাতি
scenery|-|দৃশ্যাবলি
poetry|-|কবিতা (কাব্য)
knowledge|-|জ্ঞান
homework|-|বাড়ির কাজ
money|-|টাকা
bread|-|রুটি
rice|-|ভাত / চাল
evidence|-|সাক্ষ্যপ্রমাণ
traffic|-|যানবাহন
weather|-|আবহাওয়া
mischief|-|দুষ্টুমি
jewellery|-|গয়না
stationery|-|লেখার সামগ্রী
hair|-|চুল (সব চুল একসাথে)
`;

export type CommonNoun = { singular: string; plural: string; meaning: string; person: boolean };

/** The regular plural: book → books, box → boxes, city → cities, boy → boys. */
export function regularPlural(noun: string) {
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export const commonNouns: CommonNoun[] = data
  .trim()
  .split("\n")
  .map((line) => {
    const fields = line.split("|").map((field) => field.trim());
    const [singular, plural, rawMeaning] = fields.length === 3 ? fields : [fields[0], regularPlural(fields[0]), fields[1]];
    const person = rawMeaning.startsWith("*");
    return { singular, plural, meaning: person ? rawMeaning.slice(1) : rawMeaning, person };
  });

/** Which rule the plural follows, as a short label for the table. */
export function pluralRule(singular: string, plural: string) {
  if (singular === "-" || !singular) return "শুধু বহুবচন";
  if (plural === "-" || !plural) return "অগণনযোগ্য";
  const first = plural.split("/")[0].trim();
  const s = singular.toLowerCase();
  const p = first.toLowerCase();
  if (s === p) return "একই রূপ";
  if (s.includes("-") && p.includes("-") && s.split("-").slice(1).join("-") === p.split("-").slice(1).join("-") && s.split("-")[0] !== p.split("-")[0]) return "প্রধান শব্দে বহুবচন";
  // Exams ask about the ones that break the spelling rule: stomach → stomachs, roof → roofs, photo → photos, German → Germans.
  if (p === `${s}s`) return /(ch|f|fe|o|man)$/.test(s) ? "+s (ব্যতিক্রম)" : "+s";
  if (p === `${s}es`) return s.endsWith("o") ? "o → oes" : "+es";
  if (p === `${s}zes`) return "z → zzes";
  if (/y$/.test(s) && p === `${s.slice(0, -1)}ies`) return "y → ies";
  if (/(f|fe)$/.test(s) && p.endsWith("ves")) return "f / fe → ves";
  if ((s.endsWith("um") && p.endsWith("a")) || (s.endsWith("on") && p.endsWith("a")) || (s.endsWith("us") && (p.endsWith("i") || p.endsWith("era") || p.endsWith("ora")))
    || (s.endsWith("is") && p.endsWith("es")) || (s.endsWith("a") && p.endsWith("ae")) || (/(ex|ix)$/.test(s) && p.endsWith("ices")) || p.endsWith("eaux") || p.endsWith("im")) return "বিদেশি শব্দ";
  return "অনিয়মিত";
}

/** Bangla plural of a meaning: people take "-রা" (শিশুরা), things "-গুলো" (বইগুলো); each "/" alternative separately. */
export function banglaPlural(meaning: string, person: boolean) {
  return meaning
    .split(" / ")
    .map((alt) => {
      // A meaning with a note ("ডজন (two dozen eggs)", "গণ (জীববিজ্ঞান)") reads wrong with -গুলো; keep it as it is.
      if (/\(.*\)/.test(alt)) return alt;
      return `${alt.trim()}${person ? "রা" : "গুলো"}`;
    })
    .join(" / ");
}

/** A noun is known by its singular, or by its plural when it has no singular (scissors). */
export const nounKey = (noun: { singular: string; plural: string }) => (noun.singular === "-" ? noun.plural : noun.singular).trim().toLowerCase();
