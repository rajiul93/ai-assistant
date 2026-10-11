/**
 * Loads the built-in vocabulary — 1,505 verbs, 338 nouns and 204 prefixes/suffixes, each with its
 * Bangla meaning — into the shared Vocabulary tables. The app reads them from the database; this
 * file is the only place the lists live.
 *
 *   pnpm db:seed-vocabulary            add what is missing (safe to run again)
 *   pnpm db:seed-vocabulary --update   also rewrite rows already there with the text below
 *
 * Built-in rows have fixed ids (seed-verb-go, seed-noun-child, seed-affix-prefix-un), no userId,
 * and so never clash with what admins add.
 */
import { PrismaClient } from "@prisma/client";

/* ---------- Verbs: "present|meaning" (regular) or "present|past|past participle|meaning" ---------- */
const verbData = `
abandon|ত্যাগ করা
abide|মেনে চলা
abolish|বিলুপ্ত করা
absorb|শোষণ করা
abstain|বিরত থাকা
abuse|অপব্যবহার করা
accelerate|গতি বাড়ানো
accept|গ্রহণ করা
access|প্রবেশ করা
accommodate|জায়গা দেওয়া
accompany|সঙ্গে যাওয়া
accomplish|সম্পন্ন করা
account|হিসাব দেওয়া
accumulate|জমা করা
accuse|অভিযুক্ত করা
accustom|অভ্যস্ত করা
ache|ব্যথা করা
achieve|অর্জন করা
acknowledge|স্বীকার করা
acquaint|পরিচিত করা
acquire|অর্জন করা
act|কাজ করা / অভিনয় করা
adapt|খাপ খাওয়ানো
add|যোগ করা
address|সম্বোধন করা
adjourn|মুলতবি করা
adjust|সমন্বয় করা
administer|পরিচালনা করা
admire|প্রশংসা করা
admit|admitted|admitted|স্বীকার করা
admonish|সতর্ক করা / তিরস্কার করা
adopt|গ্রহণ করা / দত্তক নেওয়া
adore|খুব ভালোবাসা
advance|এগিয়ে যাওয়া
advertise|বিজ্ঞাপন দেওয়া
advise|পরামর্শ দেওয়া
advocate|সমর্থন করা
affect|প্রভাবিত করা
affirm|দৃঢ়ভাবে বলা
afflict|কষ্ট দেওয়া
afford|সামর্থ্য থাকা
aggravate|আরও খারাপ করা
agree|একমত হওয়া
aid|সাহায্য করা
aim|লক্ষ্য করা
alarm|ভয় পাইয়ে দেওয়া
alert|সতর্ক করা
alight|নামা (যানবাহন থেকে)
align|সারিবদ্ধ করা
allege|অভিযোগ করা
alleviate|লাঘব করা
allocate|বরাদ্দ করা
allot|allotted|allotted|বরাদ্দ করা
allow|অনুমতি দেওয়া
allure|প্রলুব্ধ করা
alter|পরিবর্তন করা
amass|জমানো
amaze|বিস্মিত করা
amend|সংশোধন করা
amount|পরিমাণ হওয়া
amuse|আনন্দ দেওয়া
analyse|বিশ্লেষণ করা
anger|রাগানো
animate|প্রাণবন্ত করা
annex|সংযুক্ত করা
announce|ঘোষণা করা
annoy|বিরক্ত করা
answer|উত্তর দেওয়া
anticipate|আগে থেকে ধারণা করা
apologise|ক্ষমা চাওয়া
appal|appalled|appalled|আতঙ্কিত করা
appeal|আবেদন করা
appear|উপস্থিত হওয়া / মনে হওয়া
appease|শান্ত করা
append|যুক্ত করা
applaud|হাততালি দেওয়া
apply|আবেদন করা / প্রয়োগ করা
appoint|নিয়োগ দেওয়া
appreciate|কদর করা
approach|কাছে যাওয়া
approve|অনুমোদন করা
approximate|কাছাকাছি হওয়া
argue|তর্ক করা
arise|arose|arisen|উদ্ভূত হওয়া
arm|সশস্ত্র করা
arouse|জাগিয়ে তোলা
arrange|সাজানো / ব্যবস্থা করা
arrest|গ্রেপ্তার করা
arrive|পৌঁছানো
ascend|আরোহণ করা
ascertain|নিশ্চিত হওয়া
ask|জিজ্ঞাসা করা
aspire|উচ্চাকাঙ্ক্ষা করা
assault|হামলা করা
assemble|একত্র করা
assert|জোর দিয়ে বলা
assess|মূল্যায়ন করা
assign|দায়িত্ব দেওয়া
assimilate|আত্মীকরণ করা
assist|সাহায্য করা
associate|যুক্ত করা
assume|ধরে নেওয়া
assure|নিশ্চয়তা দেওয়া
astonish|বিস্মিত করা
attach|সংযুক্ত করা
attack|আক্রমণ করা
attain|অর্জন করা
attempt|চেষ্টা করা
attend|উপস্থিত থাকা
attest|সত্যায়িত করা
attract|আকর্ষণ করা
attribute|আরোপ করা
audit|নিরীক্ষা করা
authorise|ক্ষমতা দেওয়া
automate|স্বয়ংক্রিয় করা
avail|সুযোগ নেওয়া
avenge|প্রতিশোধ নেওয়া
avoid|এড়িয়ে চলা
await|অপেক্ষা করা
awake|awoke|awoken|জাগা
awaken|জাগানো
award|পুরস্কার দেওয়া
back|সমর্থন করা
bake|সেঁকা
balance|ভারসাম্য রাখা
ban|banned|banned|নিষিদ্ধ করা
bang|জোরে আঘাত করা
bargain|দর কষাকষি করা
bark|ঘেউ ঘেউ করা
base|ভিত্তি করা
bat|batted|batted|ব্যাট করা
bathe|গোসল করা
battle|লড়াই করা
be|was / were|been|হওয়া / থাকা
beam|উজ্জ্বল হাসা / আলো ছড়ানো
bear|bore|borne|বহন করা / সহ্য করা
beat|beat|beaten|মারা / হারানো
become|became|become|হওয়া
beg|begged|begged|ভিক্ষা করা / অনুরোধ করা
begin|began|begun|শুরু করা
behave|আচরণ করা
behold|beheld|beheld|দেখা
believe|বিশ্বাস করা
belittle|ছোট করে দেখা
belong|অন্তর্ভুক্ত হওয়া
bend|bent|bent|বাঁকানো
benefit|উপকৃত হওয়া
bet|bet|bet|বাজি ধরা
betray|বিশ্বাসঘাতকতা করা
bewilder|হতবুদ্ধি করা
bid|bid|bid|দর হাঁকা
bind|bound|bound|বাঁধা
bite|bit|bitten|কামড়ানো
blame|দোষ দেওয়া
bleed|bled|bled|রক্তক্ষরণ হওয়া
bless|আশীর্বাদ করা
blind|অন্ধ করা
blink|চোখ পিটপিট করা
block|বাধা দেওয়া
bloom|ফুল ফোটা
blossom|প্রস্ফুটিত হওয়া
blow|blew|blown|ফুঁ দেওয়া / বয়ে যাওয়া
blush|লজ্জায় লাল হওয়া
boast|বড়াই করা
boil|ফোটানো / সেদ্ধ করা
bomb|বোমা ফেলা
book|বুক করা / সংরক্ষণ করা
boost|বাড়ানো
bore|বিরক্ত করা (একঘেয়েমিতে)
borrow|ধার নেওয়া
bother|বিরক্ত করা
bounce|লাফিয়ে ওঠা
bow|মাথা নত করা
box|বাক্সে ভরা
boycott|বর্জন করা
brake|ব্রেক কষা
branch|শাখা বের হওয়া
breach|লঙ্ঘন করা
break|broke|broken|ভাঙা
breathe|শ্বাস নেওয়া
breed|bred|bred|প্রজনন করা / পালন করা
bribe|ঘুষ দেওয়া
brief|সংক্ষেপে জানানো
brighten|উজ্জ্বল করা
bring|brought|brought|আনা
broadcast|broadcast|broadcast|সম্প্রচার করা
brood|তা দেওয়া / দুশ্চিন্তা করা
browse|চোখ বুলানো
brush|ব্রাশ করা
build|built|built|নির্মাণ করা
bully|দুর্বলকে উত্ত্যক্ত করা
bump|ধাক্কা খাওয়া
burden|বোঝা চাপানো
burn|burnt / burned|burnt / burned|পোড়ানো
burst|burst|burst|ফেটে যাওয়া
bury|কবর দেওয়া
buy|bought|bought|কেনা
calculate|হিসাব করা
call|ডাকা
calm|শান্ত করা
camp|তাঁবু খাটানো
cancel|cancelled|cancelled|বাতিল করা
capture|ধরা / দখল করা
care|যত্ন নেওয়া
carry|বহন করা
carve|খোদাই করা
cast|cast|cast|নিক্ষেপ করা
catch|caught|caught|ধরা
cater|খাবার সরবরাহ করা
cause|ঘটানো
caution|সতর্ক করা
cease|থামা
celebrate|উদযাপন করা
certify|প্রত্যয়ন করা
challenge|চ্যালেঞ্জ করা
change|পরিবর্তন করা
chant|জপ করা / স্লোগান দেওয়া
charge|দাম নেওয়া / অভিযুক্ত করা
charm|মুগ্ধ করা
chase|তাড়া করা
chat|chatted|chatted|গল্প করা
chatter|বকবক করা
cheat|প্রতারণা করা
check|পরীক্ষা করা
cheer|উৎসাহ দেওয়া
cherish|লালন করা
chew|চিবানো
chill|ঠান্ডা করা
choose|chose|chosen|বেছে নেওয়া
chop|chopped|chopped|কুচি কুচি করে কাটা
chuckle|মুচকি হাসা
circulate|প্রচার করা / ঘোরানো
cite|উদ্ধৃত করা
claim|দাবি করা
clamour|হইচই করা
clap|clapped|clapped|হাততালি দেওয়া
clarify|স্পষ্ট করা
clash|সংঘর্ষ হওয়া
classify|শ্রেণিবিভাগ করা
clean|পরিষ্কার করা
cleanse|পরিশুদ্ধ করা
clear|পরিষ্কার করা / সরানো
climb|আরোহণ করা
cling|clung|clung|আঁকড়ে ধরা
clip|clipped|clipped|ছাঁটা
close|বন্ধ করা
cluster|গুচ্ছবদ্ধ হওয়া
coach|প্রশিক্ষণ দেওয়া
coax|ভুলিয়ে রাজি করানো
coincide|একই সময়ে ঘটা
collapse|ভেঙে পড়া
collect|সংগ্রহ করা
collide|সংঘর্ষ হওয়া
colour|রং করা
comb|চুল আঁচড়ানো
combine|একত্র করা
come|came|come|আসা
comfort|সান্ত্বনা দেওয়া
command|আদেশ দেওয়া
commemorate|স্মরণ করা
commence|শুরু করা
comment|মন্তব্য করা
commit|committed|committed|অঙ্গীকার করা / (অপরাধ) করা
communicate|যোগাযোগ করা
commute|যাতায়াত করা
compare|তুলনা করা
compel|compelled|compelled|বাধ্য করা
compensate|ক্ষতিপূরণ দেওয়া
compete|প্রতিযোগিতা করা
compile|সংকলন করা
complain|অভিযোগ করা
complete|সম্পূর্ণ করা
complicate|জটিল করা
compliment|প্রশংসা করা
comply|মেনে চলা
compose|রচনা করা
comprehend|বোঝা
compress|সংকুচিত করা
comprise|অন্তর্ভুক্ত করা
compromise|আপস করা
compute|গণনা করা
conceal|গোপন করা
concede|স্বীকার করা
conceive|ধারণা করা / গর্ভধারণ করা
concentrate|মনোযোগ দেওয়া
concern|সম্পর্কিত হওয়া / চিন্তিত করা
conclude|শেষ করা / সিদ্ধান্তে আসা
condemn|নিন্দা করা
condense|ঘনীভূত করা
conduct|পরিচালনা করা
confer|conferred|conferred|প্রদান করা / আলোচনা করা
confess|স্বীকার করা
confine|সীমাবদ্ধ করা
confirm|নিশ্চিত করা
conflict|বিরোধ হওয়া
conform|মেনে চলা
confront|মুখোমুখি হওয়া
confuse|বিভ্রান্ত করা
congratulate|অভিনন্দন জানানো
connect|সংযুক্ত করা
conquer|জয় করা
conserve|সংরক্ষণ করা
consider|বিবেচনা করা
consist|গঠিত হওয়া
console|সান্ত্বনা দেওয়া
conspire|ষড়যন্ত্র করা
constitute|গঠন করা
construct|নির্মাণ করা
consult|পরামর্শ নেওয়া
consume|ভোগ করা / খরচ করা
contact|যোগাযোগ করা
contain|ধারণ করা
contaminate|দূষিত করা
contemplate|গভীরভাবে ভাবা
contend|প্রতিদ্বন্দ্বিতা করা / দাবি করা
continue|চালিয়ে যাওয়া
contradict|বিরোধিতা করা
contrast|বৈপরীত্য দেখানো
contribute|অবদান রাখা
control|controlled|controlled|নিয়ন্ত্রণ করা
convert|রূপান্তর করা
convey|পৌঁছে দেওয়া / প্রকাশ করা
convict|দোষী সাব্যস্ত করা
convince|বোঝানো / রাজি করানো
cook|রান্না করা
cooperate|সহযোগিতা করা
coordinate|সমন্বয় করা
cope|সামলানো
copy|নকল করা
correct|সংশোধন করা
correspond|চিঠি আদান-প্রদান করা / মিলে যাওয়া
cost|cost|cost|দাম হওয়া
cough|কাশি দেওয়া
counsel|counselled|counselled|পরামর্শ দেওয়া
count|গণনা করা
cover|ঢাকা
crack|ফাটল ধরা
crash|ধাক্কা খাওয়া
crave|তীব্রভাবে চাওয়া
crawl|হামাগুড়ি দেওয়া
create|সৃষ্টি করা
credit|জমা করা / কৃতিত্ব দেওয়া
creep|crept|crept|গুটিগুটি এগোনো
cripple|পঙ্গু করা
criticise|সমালোচনা করা
cross|পার হওয়া
crouch|গুঁড়ি মেরে বসা
crumble|গুঁড়ো হয়ে যাওয়া
crush|পিষে ফেলা
cry|কাঁদা
cultivate|চাষ করা
curb|দমন করা
cure|সুস্থ করা
curse|অভিশাপ দেওয়া
cut|cut|cut|কাটা
cycle|সাইকেল চালানো
damage|ক্ষতি করা
dance|নাচা
dangle|ঝুলে থাকা
dare|সাহস করা
dawn|ভোর হওয়া
dazzle|চোখ ধাঁধানো
deafen|বধির করা
deal|dealt|dealt|মোকাবিলা করা / লেনদেন করা
debate|বিতর্ক করা
decay|পচে যাওয়া
deceive|প্রতারণা করা
decide|সিদ্ধান্ত নেওয়া
decipher|পাঠোদ্ধার করা
declare|ঘোষণা করা
decline|প্রত্যাখ্যান করা / কমে যাওয়া
decorate|সাজানো
decrease|কমানো
dedicate|উৎসর্গ করা
deduct|কেটে নেওয়া
deem|মনে করা
defeat|পরাজিত করা
defend|রক্ষা করা
defer|deferred|deferred|স্থগিত করা
define|সংজ্ঞা দেওয়া
deform|বিকৃত করা
defraud|প্রতারণা করা
defy|অমান্য করা
degrade|অবনমন করা
delay|দেরি করা
delegate|দায়িত্ব অর্পণ করা
delete|মুছে ফেলা
deliberate|ভেবেচিন্তে আলোচনা করা
delight|আনন্দিত করা
deliver|পৌঁছে দেওয়া
demand|দাবি করা
demolish|ভেঙে ফেলা
demonstrate|প্রদর্শন করা
denote|নির্দেশ করা
deny|অস্বীকার করা
depart|প্রস্থান করা
depend|নির্ভর করা
depict|চিত্রিত করা
deplore|নিন্দা করা
deploy|মোতায়েন করা
deport|নির্বাসিত করা
deposit|জমা দেওয়া
deprive|বঞ্চিত করা
derive|উদ্ভূত হওয়া / লাভ করা
descend|নামা
describe|বর্ণনা করা
desert|পরিত্যাগ করা
deserve|যোগ্য হওয়া
design|নকশা করা
desire|কামনা করা
despair|হতাশ হওয়া
despise|ঘৃণা করা
destroy|ধ্বংস করা
detach|বিচ্ছিন্ন করা
detain|আটক করা
detect|শনাক্ত করা
deteriorate|অবনতি হওয়া
determine|নির্ধারণ করা
devastate|বিধ্বস্ত করা
develop|উন্নয়ন করা
deviate|বিচ্যুত হওয়া
devise|উদ্ভাবন করা
devote|নিবেদন করা
diagnose|রোগ নির্ণয় করা
dial|dialled|dialled|ডায়াল করা
dictate|শ্রুতলিপি দেওয়া / হুকুম করা
die|মারা যাওয়া
differ|ভিন্ন হওয়া
dig|dug|dug|খনন করা
digest|হজম করা
dilute|পাতলা করা
diminish|হ্রাস পাওয়া
dine|রাতের খাবার খাওয়া
direct|পরিচালনা করা
disagree|দ্বিমত করা
disappear|অদৃশ্য হওয়া
disappoint|হতাশ করা
discard|বাদ দেওয়া
discern|পার্থক্য বোঝা
discharge|খালাস দেওয়া / মুক্তি দেওয়া
disclose|প্রকাশ করা
discourage|নিরুৎসাহিত করা
discover|আবিষ্কার করা
discuss|আলোচনা করা
disgrace|অসম্মান করা
disguise|ছদ্মবেশ ধারণ করা
dislike|অপছন্দ করা
dismantle|খুলে ফেলা
dismiss|বরখাস্ত করা
disobey|অমান্য করা
dispatch|প্রেরণ করা
disperse|ছত্রভঙ্গ করা
display|প্রদর্শন করা
dispose|নিষ্পত্তি করা / ফেলে দেওয়া
dispute|বিতর্ক করা
disregard|উপেক্ষা করা
dissolve|দ্রবীভূত করা
distinguish|পার্থক্য করা
distort|বিকৃত করা
distract|মনোযোগ নষ্ট করা
distress|কষ্ট দেওয়া
distribute|বিতরণ করা
disturb|বিরক্ত করা
dive|ডুব দেওয়া
divert|অন্যদিকে ফেরানো
divide|ভাগ করা
do|did|done|করা
document|নথিভুক্ত করা
dominate|আধিপত্য করা
donate|দান করা
double|দ্বিগুণ করা
doubt|সন্দেহ করা
download|ডাউনলোড করা
drag|dragged|dragged|টেনে নেওয়া
drain|নিষ্কাশন করা
draw|drew|drawn|আঁকা / টানা
dread|ভয় পাওয়া
dream|dreamt / dreamed|dreamt / dreamed|স্বপ্ন দেখা
dress|পোশাক পরা
drift|ভেসে যাওয়া
drill|ছিদ্র করা / অনুশীলন করানো
drink|drank|drunk|পান করা
drip|dripped|dripped|ফোঁটা ফোঁটা পড়া
drive|drove|driven|গাড়ি চালানো
drizzle|গুঁড়ি গুঁড়ি বৃষ্টি হওয়া
drop|dropped|dropped|ফেলে দেওয়া
drown|ডুবে যাওয়া
dry|শুকানো
dump|ফেলে দেওয়া
dust|ধুলা ঝাড়া
dwell|dwelt|dwelt|বাস করা
dwindle|ক্রমশ কমে যাওয়া
earn|উপার্জন করা
ease|সহজ করা / লাঘব করা
eat|ate|eaten|খাওয়া
echo|প্রতিধ্বনিত হওয়া
edit|সম্পাদনা করা
educate|শিক্ষা দেওয়া
elaborate|বিস্তারিত বলা
elect|নির্বাচিত করা
elevate|উন্নীত করা
eliminate|বাদ দেওয়া / দূর করা
elope|পালিয়ে যাওয়া
emancipate|মুক্ত করা
embark|যাত্রা শুরু করা
embarrass|লজ্জায় ফেলা
embody|মূর্ত করা
embrace|আলিঙ্গন করা
emerge|বেরিয়ে আসা
emigrate|দেশান্তরী হওয়া
emit|emitted|emitted|নির্গত করা
emphasise|গুরুত্ব দেওয়া
employ|নিয়োগ করা
empty|খালি করা
enable|সক্ষম করা
enact|প্রণয়ন করা (আইন)
enclose|সংযুক্ত করা / ঘিরে রাখা
encounter|সম্মুখীন হওয়া
encourage|উৎসাহ দেওয়া
end|শেষ করা
endanger|বিপন্ন করা
endeavour|চেষ্টা করা
endorse|সমর্থন করা
endure|সহ্য করা
enforce|প্রয়োগ করা
engage|নিয়োজিত করা
engrave|খোদাই করা
enhance|বৃদ্ধি করা
enjoy|উপভোগ করা
enlarge|বড় করা
enlighten|আলোকিত করা
enlist|তালিকাভুক্ত করা
enquire|জিজ্ঞাসা করা
enrich|সমৃদ্ধ করা
enrol|enrolled|enrolled|ভর্তি হওয়া
ensure|নিশ্চিত করা
entangle|জড়িয়ে ফেলা
enter|প্রবেশ করা
entertain|আপ্যায়ন করা / বিনোদন দেওয়া
entitle|অধিকার দেওয়া
entrust|দায়িত্ব দেওয়া
envisage|কল্পনা করা
envy|ঈর্ষা করা
equal|equalled|equalled|সমান হওয়া
equip|equipped|equipped|সজ্জিত করা
eradicate|নির্মূল করা
erase|মুছে ফেলা
erect|নির্মাণ করা / খাড়া করা
erupt|অগ্ন্যুৎপাত হওয়া
escape|পালানো
establish|প্রতিষ্ঠা করা
estimate|অনুমান করা
evacuate|সরিয়ে নেওয়া
evade|এড়িয়ে যাওয়া
evaluate|মূল্যায়ন করা
evaporate|বাষ্পীভূত হওয়া
evolve|বিকশিত হওয়া
exaggerate|অতিরঞ্জিত করা
examine|পরীক্ষা করা
exceed|অতিক্রম করা
excel|excelled|excelled|শ্রেষ্ঠত্ব দেখানো
exchange|বিনিময় করা
excite|উত্তেজিত করা
exclaim|বিস্ময়ে বলে ওঠা
exclude|বাদ দেওয়া
excuse|ক্ষমা করা
execute|কার্যকর করা
exempt|অব্যাহতি দেওয়া
exercise|ব্যায়াম করা
exert|প্রয়োগ করা
exhale|শ্বাস ছাড়া
exhaust|নিঃশেষ করা / ক্লান্ত করা
exhibit|প্রদর্শন করা
exist|বিদ্যমান থাকা
exit|বের হওয়া
expand|প্রসারিত করা
expect|আশা করা
expedite|ত্বরান্বিত করা
expel|expelled|expelled|বহিষ্কার করা
experience|অভিজ্ঞতা লাভ করা
experiment|পরীক্ষা চালানো
expire|মেয়াদ শেষ হওয়া
explain|ব্যাখ্যা করা
explode|বিস্ফোরিত হওয়া
exploit|শোষণ করা
explore|অন্বেষণ করা
export|রপ্তানি করা
expose|প্রকাশ করা / উন্মুক্ত করা
express|প্রকাশ করা
extend|বাড়ানো
extinguish|নেভানো
extract|নিষ্কাশন করা
fabricate|বানোয়াট করা
face|মুখোমুখি হওয়া
facilitate|সহজ করা
fade|বিবর্ণ হওয়া
fail|ব্যর্থ হওয়া
faint|অজ্ঞান হওয়া
fall|fell|fallen|পড়ে যাওয়া
falter|দ্বিধা করা
fancy|কল্পনা করা / পছন্দ করা
fascinate|মুগ্ধ করা
fasten|বাঁধা / আটকানো
favour|অনুগ্রহ করা / পক্ষপাত করা
fear|ভয় পাওয়া
feast|ভোজ করা
feed|fed|fed|খাওয়ানো
feel|felt|felt|অনুভব করা
fetch|নিয়ে আসা
fight|fought|fought|লড়াই করা
file|নথিভুক্ত করা
fill|পূর্ণ করা
film|চিত্রায়িত করা
find|found|found|খুঁজে পাওয়া
finish|শেষ করা
fire|গুলি করা / চাকরি থেকে বের করা
fit|fitted|fitted|মানানো / খাপ খাওয়া
fix|ঠিক করা / স্থির করা
flash|ঝলকানো
flatter|তোষামোদ করা
flee|fled|fled|পালিয়ে যাওয়া
flicker|মিটমিট করা
float|ভাসা
flood|প্লাবিত করা
flourish|সমৃদ্ধ হওয়া
flow|প্রবাহিত হওয়া
fluctuate|ওঠানামা করা
fly|flew|flown|ওড়া
focus|মনোযোগ দেওয়া
fold|ভাঁজ করা
follow|অনুসরণ করা
forbid|forbade|forbidden|নিষেধ করা
force|বাধ্য করা
forecast|forecast|forecast|পূর্বাভাস দেওয়া
foresee|foresaw|foreseen|আগে থেকে দেখা
foretell|foretold|foretold|ভবিষ্যদ্বাণী করা
forge|জাল করা
forget|forgot|forgotten|ভুলে যাওয়া
forgive|forgave|forgiven|ক্ষমা করা
form|গঠন করা
formulate|প্রণয়ন করা
forsake|forsook|forsaken|পরিত্যাগ করা
fortify|সুরক্ষিত করা
foster|লালন করা
found|founded|founded|প্রতিষ্ঠা করা
frame|কাঠামো দেওয়া
free|মুক্ত করা
freeze|froze|frozen|জমে যাওয়া
frighten|ভয় দেখানো
frown|ভ্রুকুটি করা
frustrate|হতাশ করা
fry|ভাজা
fulfil|fulfilled|fulfilled|পূরণ করা
function|কাজ করা
fund|অর্থায়ন করা
gain|লাভ করা
gallop|ছুটে চলা (ঘোড়ার মতো)
gamble|জুয়া খেলা
garnish|সাজানো (খাবার)
gasp|হাঁপানো
gather|জড়ো করা
gaze|তাকিয়ে থাকা
generate|উৎপন্ন করা
get|got|got / gotten|পাওয়া
give|gave|given|দেওয়া
glance|এক নজর দেখা
glitter|ঝিকমিক করা
glorify|মহিমান্বিত করা
glow|জ্বলজ্বল করা
glue|আঠা দিয়ে লাগানো
gnaw|কুরে কুরে খাওয়া
go|went|gone|যাওয়া
gossip|পরচর্চা করা
govern|শাসন করা
grab|grabbed|grabbed|ছিনিয়ে ধরা
graduate|স্নাতক হওয়া
grant|মঞ্জুর করা
grasp|আঁকড়ে ধরা / বোঝা
greet|অভিবাদন জানানো
grieve|শোক করা
grin|grinned|grinned|দাঁত বের করে হাসা
grind|ground|ground|পেষা
grip|gripped|gripped|শক্ত করে ধরা
groan|গোঙানো
grow|grew|grown|বেড়ে ওঠা / জন্মানো
growl|গর্জন করা
grumble|গজগজ করা
guarantee|নিশ্চয়তা দেওয়া
guard|পাহারা দেওয়া
guess|অনুমান করা
guide|পথ দেখানো
hail|স্বাগত জানানো / শিলাবৃষ্টি হওয়া
halt|থামানো
hammer|হাতুড়ি দিয়ে পেটানো
hamper|বাধাগ্রস্ত করা
hand|হাতে দেওয়া
handle|সামলানো
hang|hung|hung|ঝোলানো
hang|hanged|hanged|ফাঁসি দেওয়া
happen|ঘটা
harm|ক্ষতি করা
harvest|ফসল কাটা
hate|ঘৃণা করা
haunt|তাড়া করে ফেরা
have|had|had|থাকা / খাওয়া
head|নেতৃত্ব দেওয়া / দিকে যাওয়া
heal|সারিয়ে তোলা
heap|স্তূপ করা
hear|heard|heard|শোনা
heat|গরম করা
help|সাহায্য করা
hesitate|ইতস্তত করা
hide|hid|hidden|লুকানো
highlight|তুলে ধরা
hijack|ছিনতাই করা
hinder|বাধা দেওয়া
hint|ইঙ্গিত দেওয়া
hire|ভাড়া করা / নিয়োগ দেওয়া
hit|hit|hit|আঘাত করা
hoist|উত্তোলন করা (পতাকা)
hold|held|held|ধরে রাখা
honour|সম্মান করা
hope|আশা করা
host|আয়োজন করা
hover|উড়তে থাকা / ঘুরঘুর করা
howl|চিৎকার করা
hug|hugged|hugged|জড়িয়ে ধরা
hum|hummed|hummed|গুনগুন করা
humiliate|অপমানিত করা
hunt|শিকার করা
hurry|তাড়াহুড়া করা
hurt|hurt|hurt|আঘাত দেওয়া / ব্যথা পাওয়া
identify|শনাক্ত করা
ignite|জ্বালানো
ignore|উপেক্ষা করা
illuminate|আলোকিত করা
illustrate|উদাহরণ দিয়ে বোঝানো
imagine|কল্পনা করা
imitate|অনুকরণ করা
immerse|নিমজ্জিত করা
immigrate|অভিবাসী হওয়া
impair|দুর্বল করা
impart|প্রদান করা
impede|বাধা দেওয়া
implement|বাস্তবায়ন করা
implore|মিনতি করা
imply|ইঙ্গিত করা
import|আমদানি করা
impose|আরোপ করা
impress|মুগ্ধ করা
imprison|কারারুদ্ধ করা
improve|উন্নতি করা
incline|ঝোঁকা
include|অন্তর্ভুক্ত করা
incorporate|অন্তর্ভুক্ত করা
increase|বৃদ্ধি করা
indicate|নির্দেশ করা
indulge|প্রশ্রয় দেওয়া
infect|সংক্রমিত করা
infer|inferred|inferred|অনুমান করা
inflict|চাপিয়ে দেওয়া
influence|প্রভাবিত করা
inform|জানানো
inhale|শ্বাস নেওয়া
inherit|উত্তরাধিকার সূত্রে পাওয়া
initiate|সূচনা করা
inject|ইনজেকশন দেওয়া
injure|আহত করা
innovate|নতুন কিছু উদ্ভাবন করা
inquire|খোঁজ নেওয়া
inscribe|খোদাই করা
insert|ঢোকানো
insist|জোর দেওয়া
inspect|পরিদর্শন করা
inspire|অনুপ্রাণিত করা
install|স্থাপন করা
instil|instilled|instilled|সঞ্চার করা
instruct|নির্দেশ দেওয়া
insult|অপমান করা
insure|বিমা করা
integrate|একীভূত করা
intend|ইচ্ছা করা
intensify|তীব্র করা
interact|মিথস্ক্রিয়া করা
interest|আগ্রহী করা
interfere|হস্তক্ষেপ করা
interpret|ব্যাখ্যা করা / অনুবাদ করা
interrupt|বাধা দেওয়া
intervene|হস্তক্ষেপ করা
interview|সাক্ষাৎকার নেওয়া
intimidate|ভয় দেখানো
introduce|পরিচয় করিয়ে দেওয়া
invade|আক্রমণ করা / অনুপ্রবেশ করা
invent|উদ্ভাবন করা
invest|বিনিয়োগ করা
investigate|তদন্ত করা
invite|আমন্ত্রণ জানানো
involve|জড়িত করা
iron|ইস্ত্রি করা
irrigate|সেচ দেওয়া
irritate|বিরক্ত করা
isolate|বিচ্ছিন্ন করা
issue|জারি করা
jeer|বিদ্রূপ করা
jog|jogged|jogged|ধীরে দৌড়ানো
join|যোগ দেওয়া
joke|ঠাট্টা করা
jolt|ঝাঁকুনি দেওয়া
judge|বিচার করা
jump|লাফ দেওয়া
justify|ন্যায্যতা প্রমাণ করা
keep|kept|kept|রাখা
kick|লাথি মারা
kidnap|kidnapped|kidnapped|অপহরণ করা
kill|হত্যা করা
kindle|জ্বালানো
kiss|চুমু খাওয়া
kneel|knelt|knelt|হাঁটু গেড়ে বসা
knit|knitted|knitted|বোনা
knock|টোকা দেওয়া
know|knew|known|জানা
label|labelled|labelled|লেবেল লাগানো
lack|অভাব থাকা
lament|বিলাপ করা
land|অবতরণ করা
last|স্থায়ী হওয়া
laugh|হাসা
launch|চালু করা
lay|laid|laid|শোয়ানো / (ডিম) পাড়া
lead|led|led|নেতৃত্ব দেওয়া
lean|leant / leaned|leant / leaned|হেলান দেওয়া
leap|leapt / leaped|leapt / leaped|লাফ দেওয়া
learn|learnt / learned|learnt / learned|শেখা
leave|left|left|ত্যাগ করা / চলে যাওয়া
lend|lent|lent|ধার দেওয়া
lessen|কমানো
let|let|let|করতে দেওয়া
level|levelled|levelled|সমান করা
liberate|মুক্ত করা
lick|চাটা
lie|lay|lain|শুয়ে থাকা
lie|lied|lied|মিথ্যা বলা
lift|তোলা
light|lit|lit|জ্বালানো
lighten|হালকা করা
like|পছন্দ করা
limit|সীমিত করা
linger|দেরি করা / থেকে যাওয়া
link|সংযুক্ত করা
listen|শোনা
live|বসবাস করা / বেঁচে থাকা
load|বোঝাই করা
locate|অবস্থান নির্ণয় করা
lock|তালা দেওয়া
long|আকুল হওয়া
look|তাকানো
loosen|ঢিলা করা
loot|লুট করা
lose|lost|lost|হারানো
love|ভালোবাসা
lower|নিচু করা
lure|প্রলুব্ধ করা
magnify|বড় করে দেখানো
maintain|বজায় রাখা
make|made|made|তৈরি করা
manage|পরিচালনা করা / সামলানো
manipulate|কৌশলে প্রভাবিত করা
manufacture|উৎপাদন করা
march|কুচকাওয়াজ করা
mark|চিহ্নিত করা
marry|বিয়ে করা
match|মেলানো
matter|গুরুত্বপূর্ণ হওয়া
mean|meant|meant|বোঝানো / অর্থ হওয়া
measure|পরিমাপ করা
meditate|ধ্যান করা
meet|met|met|দেখা করা
melt|গলে যাওয়া
memorise|মুখস্থ করা
mend|মেরামত করা
mention|উল্লেখ করা
merge|একীভূত করা
migrate|স্থানান্তরিত হওয়া
mimic|mimicked|mimicked|নকল করা
mind|কিছু মনে করা
mingle|মেশা
minimise|কমিয়ে আনা
mislead|misled|misled|বিভ্রান্ত করা
miss|হারানো / মিস করা
mistake|mistook|mistaken|ভুল করা / ভুল বোঝা
mix|মেশানো
moan|কাতরানো
mobilise|সংগঠিত করা
mock|উপহাস করা
modify|পরিবর্তন করা
moisten|ভেজানো
monitor|পর্যবেক্ষণ করা
mop|mopped|mopped|মোছা (মেঝে)
motivate|অনুপ্রাণিত করা
mould|গড়ে তোলা
mount|আরোহণ করা
mourn|শোক করা
move|নড়া / সরানো
multiply|গুণ করা
mumble|বিড়বিড় করা
murder|খুন করা
mutter|বিড়বিড় করে বলা
nail|পেরেক মারা
name|নাম রাখা
narrate|বর্ণনা করা
navigate|দিক নির্ণয় করা
need|প্রয়োজন হওয়া
neglect|অবহেলা করা
negotiate|আলোচনা করে মীমাংসা করা
nibble|ঠুকরে খাওয়া
nod|nodded|nodded|মাথা নাড়া
nominate|মনোনীত করা
note|লক্ষ করা / লিখে রাখা
notice|লক্ষ করা
notify|জানানো
nourish|পুষ্টি জোগানো
nurse|সেবা করা
nurture|লালনপালন করা
obey|মান্য করা
object|আপত্তি করা
oblige|বাধ্য করা / উপকার করা
observe|পর্যবেক্ষণ করা
obstruct|বাধা দেওয়া
obtain|অর্জন করা
occupy|দখল করা
occur|occurred|occurred|ঘটা
offend|অসন্তুষ্ট করা
offer|প্রস্তাব দেওয়া
omit|omitted|omitted|বাদ দেওয়া
open|খোলা
operate|পরিচালনা করা / অস্ত্রোপচার করা
oppose|বিরোধিতা করা
oppress|নিপীড়ন করা
opt|বেছে নেওয়া
order|আদেশ দেওয়া / অর্ডার করা
organise|আয়োজন করা
originate|উদ্ভূত হওয়া
outline|রূপরেখা দেওয়া
outnumber|সংখ্যায় ছাড়িয়ে যাওয়া
outweigh|বেশি গুরুত্বপূর্ণ হওয়া
overcome|overcame|overcome|কাটিয়ে ওঠা
overestimate|বেশি মূল্যায়ন করা
overflow|উপচে পড়া
overhear|overheard|overheard|আড়ি পেতে শোনা
overload|অতিরিক্ত বোঝাই করা
overlook|উপেক্ষা করা
oversee|oversaw|overseen|তদারকি করা
overtake|overtook|overtaken|পেছন থেকে এগিয়ে যাওয়া
overthrow|overthrew|overthrown|উৎখাত করা
owe|ঋণী থাকা
own|মালিক হওয়া
pacify|শান্ত করা
pack|গোছানো / বাঁধা
paint|রং করা / ছবি আঁকা
panic|panicked|panicked|আতঙ্কিত হওয়া
pardon|ক্ষমা করা
park|গাড়ি রাখা
participate|অংশগ্রহণ করা
pass|পার হওয়া / উত্তীর্ণ হওয়া
paste|আঠা দিয়ে লাগানো
pause|থামা
pay|paid|paid|পরিশোধ করা
peel|খোসা ছাড়ানো
peep|উঁকি দেওয়া
penetrate|ভেদ করা
perceive|উপলব্ধি করা
perform|সম্পাদন করা / পরিবেশন করা
perish|ধ্বংস হওয়া / মারা যাওয়া
permit|permitted|permitted|অনুমতি দেওয়া
perplex|বিভ্রান্ত করা
persecute|নিপীড়ন করা
persist|লেগে থাকা
persuade|রাজি করানো
pick|তোলা / বাছাই করা
pierce|বিদ্ধ করা
pinch|চিমটি কাটা
pity|করুণা করা
place|রাখা
plan|planned|planned|পরিকল্পনা করা
plant|রোপণ করা
play|খেলা
plead|অনুনয় করা
please|খুশি করা
pledge|অঙ্গীকার করা
plough|চাষ করা
plunder|লুণ্ঠন করা
plunge|ঝাঁপ দেওয়া
point|নির্দেশ করা
polish|পালিশ করা
pollute|দূষিত করা
ponder|গভীরভাবে ভাবা
portray|চিত্রিত করা
possess|অধিকারে থাকা
post|ডাকে পাঠানো / পোস্ট করা
postpone|স্থগিত করা
pour|ঢালা
practise|অনুশীলন করা
praise|প্রশংসা করা
pray|প্রার্থনা করা
preach|প্রচার করা
precede|আগে আসা
predict|ভবিষ্যদ্বাণী করা
prefer|preferred|preferred|বেশি পছন্দ করা
prepare|প্রস্তুত করা
prescribe|ব্যবস্থাপত্র দেওয়া
present|উপস্থাপন করা
preserve|সংরক্ষণ করা
press|চাপ দেওয়া
pretend|ভান করা
prevail|প্রবল হওয়া
prevent|প্রতিরোধ করা
print|ছাপা
proceed|অগ্রসর হওয়া
produce|উৎপাদন করা
progress|অগ্রগতি করা
prohibit|নিষিদ্ধ করা
prolong|দীর্ঘায়িত করা
promise|প্রতিশ্রুতি দেওয়া
promote|পদোন্নতি দেওয়া / প্রচার করা
pronounce|উচ্চারণ করা
propose|প্রস্তাব করা
prosper|উন্নতি করা
protect|রক্ষা করা
protest|প্রতিবাদ করা
prove|proved|proved / proven|প্রমাণ করা
provide|সরবরাহ করা
provoke|উসকানি দেওয়া
prune|ছাঁটা
publish|প্রকাশ করা
pull|টানা
punish|শাস্তি দেওয়া
purchase|ক্রয় করা
purify|শুদ্ধ করা
pursue|অনুসরণ করা / পিছু নেওয়া
push|ধাক্কা দেওয়া
put|put|put|রাখা
qualify|যোগ্য হওয়া
quarrel|quarrelled|quarrelled|ঝগড়া করা
quench|নিবারণ করা (তৃষ্ণা)
question|প্রশ্ন করা
quit|quit|quit|ছেড়ে দেওয়া
quiver|কাঁপা
quote|উদ্ধৃত করা
race|দৌড় প্রতিযোগিতা করা
radiate|বিকিরণ করা
rain|বৃষ্টি হওয়া
raise|তোলা / উত্থাপন করা
rank|স্থান নির্ধারণ করা
ransack|তছনছ করা
ratify|অনুমোদন করা
rattle|খটখট শব্দ করা
reach|পৌঁছানো
react|প্রতিক্রিয়া দেখানো
read|read|read|পড়া
realise|উপলব্ধি করা
reassure|আশ্বস্ত করা
rebel|rebelled|rebelled|বিদ্রোহ করা
rebuke|তিরস্কার করা
recall|মনে করা
recede|পিছিয়ে যাওয়া
receive|গ্রহণ করা
recite|আবৃত্তি করা
reckon|গণনা করা / মনে করা
recline|হেলান দেওয়া
recognise|চেনা / স্বীকৃতি দেওয়া
recommend|সুপারিশ করা
reconcile|মিটমাট করা
record|রেকর্ড করা / লিপিবদ্ধ করা
recover|সুস্থ হওয়া / ফিরে পাওয়া
recruit|নিয়োগ দেওয়া
rectify|সংশোধন করা
redeem|উদ্ধার করা / খালাস করা
redress|প্রতিকার করা
reduce|কমানো
refer|referred|referred|উল্লেখ করা
refine|পরিশোধন করা
reflect|প্রতিফলিত করা
reform|সংস্কার করা
refresh|সতেজ করা
refund|অর্থ ফেরত দেওয়া
refuse|প্রত্যাখ্যান করা
regard|গণ্য করা
register|নিবন্ধন করা
regret|regretted|regretted|অনুশোচনা করা
regulate|নিয়ন্ত্রণ করা
rehearse|মহড়া দেওয়া
reign|রাজত্ব করা
reinforce|শক্তিশালী করা
reiterate|পুনরায় বলা
reject|প্রত্যাখ্যান করা
rejoice|আনন্দ করা
rejuvenate|নবযৌবন দান করা
relate|সম্পর্কিত করা
relax|বিশ্রাম নেওয়া
release|মুক্তি দেওয়া
relieve|উপশম করা / অব্যাহতি দেওয়া
relinquish|ছেড়ে দেওয়া
relish|উপভোগ করা
rely|নির্ভর করা
remain|থেকে যাওয়া
remark|মন্তব্য করা
remember|মনে রাখা
remind|মনে করিয়ে দেওয়া
remit|remitted|remitted|টাকা পাঠানো / মওকুফ করা
remove|সরানো
render|প্রদান করা / পরিণত করা
renew|নবায়ন করা
renounce|ত্যাগ করা
rent|ভাড়া নেওয়া
repair|মেরামত করা
repeat|পুনরাবৃত্তি করা
repel|repelled|repelled|বিতাড়িত করা
repent|অনুতপ্ত হওয়া
replace|প্রতিস্থাপন করা
reply|উত্তর দেওয়া
report|প্রতিবেদন দেওয়া
represent|প্রতিনিধিত্ব করা
reproach|তিরস্কার করা
reproduce|পুনরুৎপাদন করা
request|অনুরোধ করা
require|প্রয়োজন হওয়া
rescind|বাতিল করা
rescue|উদ্ধার করা
research|গবেষণা করা
resemble|সাদৃশ্য থাকা
resent|অসন্তোষ প্রকাশ করা
reserve|সংরক্ষণ করা
resign|পদত্যাগ করা
resist|প্রতিরোধ করা
resolve|সমাধান করা
respect|সম্মান করা
respond|সাড়া দেওয়া
rest|বিশ্রাম নেওয়া
restore|পুনরুদ্ধার করা
restrict|সীমাবদ্ধ করা
result|ফলস্বরূপ হওয়া
resume|পুনরায় শুরু করা
retain|ধরে রাখা
retaliate|প্রতিশোধ নেওয়া
retire|অবসর নেওয়া
retort|পাল্টা জবাব দেওয়া
retreat|পিছু হটা
return|ফিরে আসা / ফেরত দেওয়া
reveal|প্রকাশ করা
review|পর্যালোচনা করা
revise|সংশোধন করা / পুনরায় পড়া
revive|পুনরুজ্জীবিত করা
revolt|বিদ্রোহ করা
revolve|আবর্তিত হওয়া
reward|পুরস্কৃত করা
rid|rid|rid|মুক্ত করা
ride|rode|ridden|চড়া
ridicule|উপহাস করা
ring|rang|rung|বাজানো
rinse|ধুয়ে ফেলা
rise|rose|risen|ওঠা
risk|ঝুঁকি নেওয়া
roam|ঘুরে বেড়ানো
roar|গর্জন করা
rob|robbed|robbed|ডাকাতি করা
roll|গড়ানো
rot|rotted|rotted|পচা
rub|rubbed|rubbed|ঘষা
ruin|ধ্বংস করা
rule|শাসন করা
run|ran|run|দৌড়ানো
rush|তাড়াহুড়া করা
rustle|খসখস শব্দ করা
sacrifice|ত্যাগ করা / উৎসর্গ করা
sail|পাল তুলে চলা
salute|অভিবাদন জানানো
sanction|অনুমোদন দেওয়া
satisfy|সন্তুষ্ট করা
save|বাঁচানো / সঞ্চয় করা
saw|sawed|sawn|করাত দিয়ে কাটা
say|said|said|বলা
scare|ভয় দেখানো
scatter|ছড়িয়ে দেওয়া
schedule|সময় নির্ধারণ করা
scold|বকা দেওয়া
score|নম্বর পাওয়া / গোল করা
scramble|হুড়োহুড়ি করা
scratch|আঁচড় কাটা
scream|চিৎকার করা
scribble|হিজিবিজি লেখা
scrub|scrubbed|scrubbed|ঘষে পরিষ্কার করা
scrutinise|খুঁটিয়ে দেখা
search|খোঁজা
seat|বসানো
secure|নিরাপদ করা / অর্জন করা
see|saw|seen|দেখা
seek|sought|sought|খোঁজা / চাওয়া
seem|মনে হওয়া
seize|দখল করা / আটক করা
select|নির্বাচন করা
sell|sold|sold|বিক্রি করা
send|sent|sent|পাঠানো
sense|অনুভব করা
separate|আলাদা করা
serve|পরিবেশন করা / সেবা করা
set|set|set|স্থাপন করা / নির্ধারণ করা
settle|মীমাংসা করা / বসতি স্থাপন করা
sew|sewed|sewn|সেলাই করা
shake|shook|shaken|ঝাঁকানো / কাঁপা
shape|আকার দেওয়া
share|ভাগ করে নেওয়া
shatter|চূর্ণবিচূর্ণ করা
shave|দাড়ি কামানো
shed|shed|shed|ঝরানো
shelter|আশ্রয় দেওয়া
shine|shone|shone|উজ্জ্বল হওয়া
shiver|কাঁপা
shock|হতবাক করা
shoot|shot|shot|গুলি করা
shop|shopped|shopped|কেনাকাটা করা
shout|চিৎকার করা
show|showed|shown|দেখানো
shrink|shrank|shrunk|সংকুচিত হওয়া
shrug|shrugged|shrugged|কাঁধ ঝাঁকানো
shudder|শিউরে ওঠা
shun|shunned|shunned|এড়িয়ে চলা
shut|shut|shut|বন্ধ করা
sigh|দীর্ঘশ্বাস ফেলা
sign|স্বাক্ষর করা
signal|signalled|signalled|সংকেত দেওয়া
simplify|সরল করা
sing|sang|sung|গান গাওয়া
sink|sank|sunk|ডুবে যাওয়া
sip|sipped|sipped|চুমুক দেওয়া
sit|sat|sat|বসা
skip|skipped|skipped|বাদ দেওয়া / লাফানো
slam|slammed|slammed|সজোরে বন্ধ করা
slaughter|জবাই করা
slay|slew|slain|হত্যা করা
sleep|slept|slept|ঘুমানো
slide|slid|slid|পিছলে যাওয়া
slip|slipped|slipped|পিছলে পড়া
slumber|তন্দ্রায় থাকা
smash|চুরমার করা
smell|smelt / smelled|smelt / smelled|গন্ধ নেওয়া
smile|মুচকি হাসা
smoke|ধূমপান করা
smuggle|চোরাচালান করা
snatch|ছিনিয়ে নেওয়া
sneeze|হাঁচি দেওয়া
snore|নাক ডাকা
snow|তুষারপাত হওয়া
soak|ভিজিয়ে রাখা
sob|sobbed|sobbed|ফুঁপিয়ে কাঁদা
solicit|প্রার্থনা করা / অনুরোধ করা
solve|সমাধান করা
soothe|প্রশমিত করা
sort|বাছাই করা
sound|শোনানো / মনে হওয়া
sow|sowed|sown|বীজ বোনা
spare|রেহাই দেওয়া / বাঁচিয়ে রাখা
sparkle|ঝলমল করা
speak|spoke|spoken|কথা বলা
specify|নির্দিষ্ট করা
speed|sped|sped|দ্রুত চলা
spell|spelt / spelled|spelt / spelled|বানান করা
spend|spent|spent|ব্যয় করা / কাটানো
spill|spilt / spilled|spilt / spilled|ছলকে পড়া
spin|spun|spun|ঘোরানো
spit|spat|spat|থুতু ফেলা
split|split|split|বিভক্ত করা
spoil|spoilt / spoiled|spoilt / spoiled|নষ্ট করা
sponsor|পৃষ্ঠপোষকতা করা
spray|স্প্রে করা
spread|spread|spread|ছড়িয়ে দেওয়া
spring|sprang|sprung|লাফিয়ে ওঠা
sprinkle|ছিটানো
sprout|অঙ্কুরিত হওয়া
spy|গুপ্তচরবৃত্তি করা
squander|অপচয় করা
squeeze|চিপে বের করা
stab|stabbed|stabbed|ছুরিকাঘাত করা
stagger|টলমল করা
stain|দাগ লাগানো
stammer|তোতলানো
stamp|সিল মারা
stand|stood|stood|দাঁড়ানো
stare|তাকিয়ে থাকা
start|শুরু করা
startle|চমকে দেওয়া
starve|অনাহারে থাকা
state|বিবৃত করা
stay|থাকা
steal|stole|stolen|চুরি করা
steer|চালনা করা (দিক)
step|stepped|stepped|পা ফেলা
stick|stuck|stuck|লাগানো / আটকে থাকা
stimulate|উদ্দীপিত করা
sting|stung|stung|হুল ফোটানো
stir|stirred|stirred|নাড়া
stitch|সেলাই করা
stoop|ঝুঁকে পড়া
stop|stopped|stopped|থামা
store|মজুদ করা
strain|চাপ দেওয়া / ছাঁকা
strangle|শ্বাসরোধ করা
strengthen|শক্তিশালী করা
stretch|প্রসারিত করা
strike|struck|struck|আঘাত করা / ধর্মঘট করা
strive|strove|striven|প্রাণপণ চেষ্টা করা
stroll|পায়চারি করা
struggle|সংগ্রাম করা
study|পড়াশোনা করা
stumble|হোঁচট খাওয়া
subdue|দমন করা
submit|submitted|submitted|জমা দেওয়া
subscribe|গ্রাহক হওয়া
subside|প্রশমিত হওয়া
substitute|প্রতিস্থাপন করা
subtract|বিয়োগ করা
succeed|সফল হওয়া
succumb|নতি স্বীকার করা
suck|চোষা
suffer|ভোগা / কষ্ট পাওয়া
suggest|পরামর্শ দেওয়া
suit|মানানো
summarise|সংক্ষেপ করা
summon|তলব করা
supervise|তত্ত্বাবধান করা
supply|সরবরাহ করা
support|সমর্থন করা
suppose|ধরে নেওয়া
suppress|দমন করা
surpass|ছাড়িয়ে যাওয়া
surprise|অবাক করা
surrender|আত্মসমর্পণ করা
surround|ঘিরে ফেলা
survive|বেঁচে থাকা
suspect|সন্দেহ করা
suspend|স্থগিত করা / বরখাস্ত করা
sustain|টিকিয়ে রাখা
swallow|গেলা
swarm|ঝাঁকে ঝাঁকে আসা
sway|দোলা
swear|swore|sworn|শপথ করা
sweat|ঘামা
sweep|swept|swept|ঝাড়ু দেওয়া
swell|swelled|swollen|ফুলে যাওয়া
swim|swam|swum|সাঁতার কাটা
swing|swung|swung|দোলানো
switch|বদলানো / সুইচ টেপা
sympathise|সহানুভূতি দেখানো
tackle|মোকাবিলা করা
take|took|taken|নেওয়া
talk|কথা বলা
tame|পোষ মানানো
tap|tapped|tapped|আলতো টোকা দেওয়া
tarnish|কলঙ্কিত করা
taste|স্বাদ নেওয়া
tax|কর আরোপ করা
teach|taught|taught|শেখানো
tear|tore|torn|ছেঁড়া
tease|উত্ত্যক্ত করা
telephone|ফোন করা
tell|told|told|বলা
tempt|প্রলুব্ধ করা
tend|প্রবণতা থাকা
terminate|বরখাস্ত করা / শেষ করা
terrify|আতঙ্কিত করা
test|পরীক্ষা করা
text|মেসেজ পাঠানো
thank|ধন্যবাদ দেওয়া
think|thought|thought|চিন্তা করা
thrash|পেটানো
threaten|হুমকি দেওয়া
thrill|রোমাঞ্চিত করা
thrive|উন্নতি করা
throb|throbbed|throbbed|দপদপ করা
throw|threw|thrown|ছোড়া
tick|টিক চিহ্ন দেওয়া
tidy|গুছিয়ে রাখা
tie|বাঁধা
tighten|শক্ত করা
tolerate|সহ্য করা
topple|উল্টে ফেলা
torment|যন্ত্রণা দেওয়া
torture|নির্যাতন করা
toss|ছুড়ে দেওয়া
touch|স্পর্শ করা
tour|ভ্রমণ করা
trace|খুঁজে বের করা
trade|ব্যবসা করা
train|প্রশিক্ষণ দেওয়া
trample|পদদলিত করা
transfer|transferred|transferred|স্থানান্তর করা
transform|রূপান্তরিত করা
translate|অনুবাদ করা
transmit|transmitted|transmitted|প্রেরণ করা
transport|পরিবহন করা
trap|trapped|trapped|ফাঁদে ফেলা
travel|travelled|travelled|ভ্রমণ করা
tread|trod|trodden|পা দেওয়া / মাড়ানো
treat|আচরণ করা / চিকিৎসা করা
tremble|কাঁপা
trick|ঠকানো
trip|tripped|tripped|হোঁচট খাওয়া
triumph|বিজয় লাভ করা
trouble|কষ্ট দেওয়া
trust|বিশ্বাস করা
try|চেষ্টা করা
tumble|গড়িয়ে পড়া
turn|ঘোরানো
twist|মোচড়ানো
type|টাইপ করা
undergo|underwent|undergone|ভোগ করা / মধ্য দিয়ে যাওয়া
underline|নিচে দাগ দেওয়া
undermine|দুর্বল করা
understand|understood|understood|বোঝা
undertake|undertook|undertaken|দায়িত্ব নেওয়া
undo|undid|undone|পূর্বাবস্থায় ফেরানো
unfold|প্রকাশিত হওয়া / খোলা
unite|ঐক্যবদ্ধ করা
unlock|তালা খোলা
unpack|খোলা (ব্যাগ বা বাক্স)
unveil|উন্মোচন করা
update|হালনাগাদ করা
upgrade|উন্নত করা
uphold|upheld|upheld|সমুন্নত রাখা
uplift|উন্নত করা
upset|upset|upset|মন খারাপ করানো / উল্টে দেওয়া
urge|তাগিদ দেওয়া
use|ব্যবহার করা
usurp|জবরদখল করা
utilise|কাজে লাগানো
utter|উচ্চারণ করা
vacate|খালি করা
validate|বৈধতা দেওয়া
value|মূল্য দেওয়া
vanish|অদৃশ্য হওয়া
vary|ভিন্ন হওয়া
venture|ঝুঁকি নিয়ে এগোনো
verify|যাচাই করা
vex|বিরক্ত করা
vibrate|কম্পিত হওয়া
vindicate|নির্দোষ প্রমাণ করা
violate|লঙ্ঘন করা
visit|পরিদর্শন করা / বেড়াতে যাওয়া
volunteer|স্বেচ্ছায় এগিয়ে আসা
vomit|বমি করা
vote|ভোট দেওয়া
vow|প্রতিজ্ঞা করা
wade|জলে হেঁটে পার হওয়া
wage|(যুদ্ধ) চালানো
wail|বিলাপ করা
wait|অপেক্ষা করা
wake|woke|woken|ঘুম থেকে ওঠা
walk|হাঁটা
wander|ঘুরে বেড়ানো
want|চাওয়া
warm|গরম করা
warn|সতর্ক করা
warrant|যৌক্তিক করা
wash|ধোয়া
waste|অপচয় করা
watch|দেখা / লক্ষ করা
water|পানি দেওয়া
wave|হাত নাড়া
weaken|দুর্বল করা
wear|wore|worn|পরা
weave|wove|woven|বোনা
wed|wedded|wedded|বিয়ে করা
weed|আগাছা পরিষ্কার করা
weep|wept|wept|কাঁদা
weigh|ওজন করা
welcome|স্বাগত জানানো
whip|whipped|whipped|চাবুক মারা
whisper|ফিসফিস করে বলা
whistle|শিস দেওয়া
widen|প্রশস্ত করা
wield|প্রয়োগ করা (ক্ষমতা)
win|won|won|জেতা
wind|wound|wound|প্যাঁচানো / দম দেওয়া
wink|চোখ টিপ দেওয়া
wipe|মোছা
wish|কামনা করা / ইচ্ছা করা
withdraw|withdrew|withdrawn|প্রত্যাহার করা / তুলে নেওয়া
wither|শুকিয়ে যাওয়া
withhold|withheld|withheld|আটকে রাখা
withstand|withstood|withstood|প্রতিরোধ করা / টিকে থাকা
witness|সাক্ষী হওয়া
wonder|বিস্মিত হওয়া / ভাবা
work|কাজ করা
worry|চিন্তা করা
worship|worshipped|worshipped|উপাসনা করা
wound|আহত করা
wrap|wrapped|wrapped|মোড়ানো
wrestle|কুস্তি করা
wrinkle|কুঁচকে যাওয়া
write|wrote|written|লেখা
yawn|হাই তোলা
yearn|আকুল হওয়া
yell|চিৎকার করা
yield|ফলন দেওয়া / নতি স্বীকার করা
zip|zipped|zipped|চেইন লাগানো
zoom|দ্রুত বড় করা / সাঁই করে যাওয়া
`;

/* ---------- Nouns: "singular|meaning" (regular), "singular|plural|meaning", "-" for none; "*" = a person ---------- */
const nounData = `
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

/* ---------- Prefixes and suffixes: "PREFIX|un-|meaning|example — অর্থ, …" ---------- */
const affixData = `
PREFIX|a-|না / -হীন|atypical — অস্বাভাবিক, amoral — নীতিবোধহীন
PREFIX|ab-|দূরে / বিচ্যুত|abnormal — অস্বাভাবিক, absent — অনুপস্থিত
PREFIX|ad-|দিকে / প্রতি|advance — এগিয়ে যাওয়া, adjoin — সংলগ্ন হওয়া
PREFIX|after-|পরে|afternoon — বিকাল, aftermath — পরিণতি
PREFIX|ambi-|উভয়|ambiguous — দ্ব্যর্থক, ambidextrous — দুই হাতেই সমান দক্ষ
PREFIX|ante-|আগে / পূর্বে|antecedent — পূর্ববর্তী, antedate — আগের তারিখ দেওয়া
PREFIX|anti-|বিরোধী / প্রতিরোধক|antibiotic — জীবাণুনাশক ওষুধ, antisocial — অসামাজিক
PREFIX|arch-|প্রধান / শ্রেষ্ঠ|archbishop — প্রধান বিশপ, archenemy — প্রধান শত্রু
PREFIX|auto-|স্বয়ং / নিজে|autobiography — আত্মজীবনী, automatic — স্বয়ংক্রিয়
PREFIX|be-|করা / পরিণত করা|befriend — বন্ধু বানানো, belittle — ছোট করে দেখা
PREFIX|bene-|ভালো / উপকার|benefit — উপকার, benevolent — দয়ালু
PREFIX|bi-|দুই|bicycle — বাইসাইকেল, bilingual — দ্বিভাষিক
PREFIX|bio-|জীবন|biology — জীববিজ্ঞান, biography — জীবনী
PREFIX|by-|পার্শ্ব / গৌণ|bypass — পাশ কাটিয়ে যাওয়া, by-product — উপজাত দ্রব্য
PREFIX|centi-|শত / শত ভাগের এক|centimetre — সেন্টিমিটার, centenary — শতবার্ষিকী
PREFIX|circum-|চারদিকে|circumference — পরিধি, circumstance — পরিস্থিতি
PREFIX|co-|সহ / একসাথে|cooperate — সহযোগিতা করা, co-worker — সহকর্মী
PREFIX|col-|সহ / একসাথে|collaborate — একসাথে কাজ করা, colleague — সহকর্মী
PREFIX|com-|সহ / একসাথে|combine — একত্র করা, companion — সঙ্গী
PREFIX|con-|সহ / একসাথে|connect — সংযুক্ত করা, contemporary — সমসাময়িক
PREFIX|contra-|বিপরীত|contradict — বিরোধিতা করা, contrary — বিপরীত
PREFIX|counter-|পাল্টা / বিপরীত|counterattack — পাল্টা আক্রমণ, counterpart — প্রতিরূপ
PREFIX|cyber-|কম্পিউটার / ইন্টারনেট সংক্রান্ত|cyberspace — সাইবার জগৎ, cybercrime — সাইবার অপরাধ
PREFIX|de-|অপসারণ / বিপরীত / নিচে|defrost — বরফ গলানো, devalue — অবমূল্যায়ন করা
PREFIX|deca-|দশ|decade — দশক, decathlon — দশ ক্রীড়ার প্রতিযোগিতা
PREFIX|deci-|দশ ভাগের এক|decimal — দশমিক, decimetre — ডেসিমিটার
PREFIX|di-|দুই|dioxide — ডাইঅক্সাইড, dilemma — উভয়সংকট
PREFIX|dia-|মধ্য দিয়ে / আড়াআড়ি|diameter — ব্যাস, diagonal — কর্ণ
PREFIX|dis-|না / বিপরীত|dishonest — অসৎ, disagree — দ্বিমত করা
PREFIX|down-|নিচে|downfall — পতন, downstairs — নিচতলায়
PREFIX|dys-|খারাপ / অস্বাভাবিক|dysfunction — বিকলতা, dyslexia — পড়তে অসুবিধার রোগ
PREFIX|e-|ইলেকট্রনিক|e-mail — ই-মেইল, e-commerce — অনলাইন বাণিজ্য
PREFIX|eco-|পরিবেশ|ecosystem — বাস্তুতন্ত্র, eco-friendly — পরিবেশবান্ধব
PREFIX|em-|করানো / ভেতরে (b, m, p-এর আগে)|empower — ক্ষমতায়ন করা, embrace — আলিঙ্গন করা
PREFIX|en-|করানো / ভেতরে|enlarge — বড় করা, enable — সক্ষম করা
PREFIX|equi-|সমান|equivalent — সমতুল্য, equilibrium — ভারসাম্য
PREFIX|ex-|বাইরে / প্রাক্তন|export — রপ্তানি করা, ex-president — সাবেক রাষ্ট্রপতি
PREFIX|extra-|অতিরিক্ত / বাইরে|extraordinary — অসাধারণ, extracurricular — পাঠ্যক্রম-বহির্ভূত
PREFIX|fore-|আগে / সামনে|forecast — পূর্বাভাস, forehead — কপাল
PREFIX|geo-|পৃথিবী / ভূমি|geography — ভূগোল, geology — ভূতত্ত্ব
PREFIX|hemi-|অর্ধ|hemisphere — গোলার্ধ, hemicycle — অর্ধবৃত্তাকার কাঠামো
PREFIX|hetero-|ভিন্ন|heterogeneous — বিষমসত্ত্ব, heterodox — প্রচলিত মতের বিরোধী
PREFIX|homo-|একই / সম|homogeneous — সমসত্ত্ব, homophone — সমোচ্চারিত শব্দ
PREFIX|hydro-|পানি|hydroelectric — জলবিদ্যুৎ, hydrogen — হাইড্রোজেন
PREFIX|hyper-|অতি / মাত্রাতিরিক্ত|hyperactive — অতিচঞ্চল, hypertension — উচ্চ রক্তচাপ
PREFIX|hypo-|নিচে / কম|hypothesis — অনুকল্প, hypodermic — চামড়ার নিচের
PREFIX|il-|না (l-এর আগে)|illegal — অবৈধ, illiterate — নিরক্ষর
PREFIX|im-|না / ভেতরে (b, m, p-এর আগে)|impossible — অসম্ভব, import — আমদানি করা
PREFIX|in-|না / ভেতরে|incorrect — ভুল, inside — ভেতরে
PREFIX|infra-|নিচে|infrastructure — অবকাঠামো, infrared — অবলোহিত
PREFIX|inter-|মধ্যে / পারস্পরিক|international — আন্তর্জাতিক, interact — মিথস্ক্রিয়া করা
PREFIX|intra-|অভ্যন্তরে|intranet — অভ্যন্তরীণ নেটওয়ার্ক, intravenous — শিরার মধ্যে
PREFIX|ir-|না (r-এর আগে)|irregular — অনিয়মিত, irresponsible — দায়িত্বজ্ঞানহীন
PREFIX|kilo-|হাজার|kilogram — কিলোগ্রাম, kilometre — কিলোমিটার
PREFIX|macro-|বৃহৎ|macroeconomics — সামষ্টিক অর্থনীতি, macrocosm — বৃহৎ জগৎ
PREFIX|mal-|খারাপ / ভুল|malnutrition — অপুষ্টি, malfunction — বিকল হওয়া
PREFIX|mega-|বিশাল / দশ লক্ষ|megacity — মহানগর, megabyte — মেগাবাইট
PREFIX|micro-|ক্ষুদ্র|microscope — অণুবীক্ষণ যন্ত্র, microorganism — অণুজীব
PREFIX|mid-|মধ্য|midnight — মধ্যরাত, midway — মাঝপথে
PREFIX|milli-|হাজার ভাগের এক|millimetre — মিলিমিটার, milligram — মিলিগ্রাম
PREFIX|mini-|ছোট|minibus — ছোট বাস, miniskirt — ছোট স্কার্ট
PREFIX|mis-|ভুল / খারাপভাবে|misunderstand — ভুল বোঝা, misuse — অপব্যবহার করা
PREFIX|mono-|এক|monotonous — একঘেয়ে, monopoly — একচেটিয়া অধিকার
PREFIX|multi-|বহু|multinational — বহুজাতিক, multipurpose — বহুমুখী
PREFIX|neo-|নতুন|neonatal — নবজাতক-সংক্রান্ত, neologism — নতুন শব্দ
PREFIX|non-|না|nonsense — অর্থহীন কথা, non-stop — বিরতিহীন
PREFIX|ob-|বিরুদ্ধে / বাধা|obstacle — বাধা, object — আপত্তি করা
PREFIX|omni-|সর্ব|omnipresent — সর্বব্যাপী, omnipotent — সর্বশক্তিমান
PREFIX|out-|ছাড়িয়ে / বাইরে|outrun — দৌড়ে ছাড়িয়ে যাওয়া, outdoor — বাইরের
PREFIX|over-|অতিরিক্ত / ওপরে|overload — অতিরিক্ত বোঝাই করা, overcome — কাটিয়ে ওঠা
PREFIX|pan-|সমগ্র / সব|pandemic — বৈশ্বিক মহামারি, panorama — পূর্ণ দৃশ্য
PREFIX|para-|পাশে / সদৃশ|paramedic — সহকারী চিকিৎসাকর্মী, paragraph — অনুচ্ছেদ
PREFIX|penta-|পাঁচ|pentagon — পঞ্চভুজ, pentathlon — পাঁচ ক্রীড়ার প্রতিযোগিতা
PREFIX|per-|মধ্য দিয়ে / সম্পূর্ণ|perfect — নিখুঁত, persist — লেগে থাকা
PREFIX|peri-|চারপাশে|perimeter — পরিসীমা, periscope — পেরিস্কোপ
PREFIX|photo-|আলো|photograph — আলোকচিত্র, photosynthesis — সালোকসংশ্লেষণ
PREFIX|poly-|বহু|polygon — বহুভুজ, polytechnic — বহু প্রযুক্তির শিক্ষালয়
PREFIX|post-|পরে|postwar — যুদ্ধোত্তর, postpone — স্থগিত করা
PREFIX|pre-|আগে|preview — পূর্বদর্শন, prehistoric — প্রাগৈতিহাসিক
PREFIX|pro-|পক্ষে / সামনে|proceed — অগ্রসর হওয়া, pro-government — সরকারপন্থী
PREFIX|pseudo-|ছদ্ম / মিথ্যা|pseudonym — ছদ্মনাম, pseudoscience — অপবিজ্ঞান
PREFIX|psycho-|মন|psychology — মনোবিজ্ঞান, psychotherapy — মনোচিকিৎসা
PREFIX|quad-|চার|quadrilateral — চতুর্ভুজ, quadruple — চারগুণ
PREFIX|re-|আবার / ফিরে|rewrite — আবার লেখা, return — ফিরে আসা
PREFIX|retro-|পেছনে / অতীতমুখী|retrospect — অতীতের দিকে ফিরে দেখা, retroactive — ভূতাপেক্ষ
PREFIX|self-|নিজে / আত্ম|self-confidence — আত্মবিশ্বাস, self-employed — স্বনিযুক্ত
PREFIX|semi-|আধা|semicircle — অর্ধবৃত্ত, semifinal — সেমিফাইনাল
PREFIX|sub-|নিচে / উপ|subway — পাতালপথ, subdivide — উপবিভাগ করা
PREFIX|super-|ঊর্ধ্বে / অতি|supernatural — অতিপ্রাকৃত, superpower — পরাশক্তি
PREFIX|sur-|ওপরে / অতিরিক্ত|surface — উপরিভাগ, surcharge — অতিরিক্ত মাশুল
PREFIX|sym-|সহ / একসাথে (b, m, p-এর আগে)|sympathy — সহানুভূতি, symphony — ঐকতান
PREFIX|syn-|সহ / একসাথে|synonym — সমার্থক শব্দ, synthesis — সংশ্লেষণ
PREFIX|tele-|দূর|telephone — টেলিফোন, telescope — দূরবীক্ষণ যন্ত্র
PREFIX|thermo-|তাপ|thermometer — থার্মোমিটার, thermostat — তাপনিয়ন্ত্রক
PREFIX|trans-|পার / অন্যত্র|transport — পরিবহন করা, translate — অনুবাদ করা
PREFIX|tri-|তিন|triangle — ত্রিভুজ, tricycle — তিন চাকার সাইকেল
PREFIX|ultra-|অতি / সীমার বাইরে|ultraviolet — অতিবেগুনি, ultramodern — অতি আধুনিক
PREFIX|un-|না / বিপরীত|unhappy — অসুখী, unlock — তালা খোলা
PREFIX|under-|নিচে / কম|underground — ভূগর্ভস্থ, underestimate — অবমূল্যায়ন করা
PREFIX|uni-|এক|uniform — একই রকম পোশাক, unique — অদ্বিতীয়
PREFIX|up-|ওপরে|upgrade — উন্নত করা, uphill — চড়াই
PREFIX|vice-|সহকারী / উপ|vice-president — উপরাষ্ট্রপতি, vice-chancellor — উপাচার্য
PREFIX|with-|বিরুদ্ধে / পেছনে|withdraw — প্রত্যাহার করা, withstand — প্রতিরোধ করা
SUFFIX|-able|যোগ্য / সম্ভব|readable — পাঠযোগ্য, washable — ধোয়া যায় এমন
SUFFIX|-acy|অবস্থা / গুণ|privacy — গোপনীয়তা, accuracy — নির্ভুলতা
SUFFIX|-ade|কাজ / ফল|blockade — অবরোধ, lemonade — লেবুর শরবত
SUFFIX|-age|কাজ / অবস্থা / পরিমাণ|marriage — বিবাহ, shortage — ঘাটতি
SUFFIX|-al|সম্পর্কিত (বিশেষণ) / কাজ (বিশেষ্য)|national — জাতীয়, arrival — আগমন
SUFFIX|-ally|ভাবে (ক্রিয়াবিশেষণ)|basically — মূলত, automatically — স্বয়ংক্রিয়ভাবে
SUFFIX|-an|সম্পর্কিত / অধিবাসী|American — আমেরিকান, urban — শহুরে
SUFFIX|-ance|অবস্থা / কাজ|performance — পরিবেশনা, assistance — সহায়তা
SUFFIX|-ancy|অবস্থা|vacancy — শূন্যপদ, pregnancy — গর্ভাবস্থা
SUFFIX|-ant|কর্তা / অবস্থাসূচক|assistant — সহকারী, important — গুরুত্বপূর্ণ
SUFFIX|-ar|সম্পর্কিত / কর্তা|circular — বৃত্তাকার, beggar — ভিক্ষুক
SUFFIX|-ard|অতিমাত্রায় কিছু করে এমন ব্যক্তি|drunkard — মাতাল, coward — কাপুরুষ
SUFFIX|-arian|ব্যক্তি / মতাবলম্বী|vegetarian — নিরামিষভোজী, humanitarian — মানবহিতৈষী
SUFFIX|-ary|সম্পর্কিত / স্থান|dictionary — অভিধান, military — সামরিক
SUFFIX|-ate|করা (ক্রিয়া) / যুক্ত (বিশেষণ)|activate — সক্রিয় করা, fortunate — ভাগ্যবান
SUFFIX|-ation|কাজ / প্রক্রিয়া|education — শিক্ষা, information — তথ্য
SUFFIX|-ative|প্রবণ / গুণসূচক|talkative — বাচাল, informative — তথ্যবহুল
SUFFIX|-cide|হত্যা / নাশক|pesticide — কীটনাশক, suicide — আত্মহত্যা
SUFFIX|-cracy|শাসন|democracy — গণতন্ত্র, bureaucracy — আমলাতন্ত্র
SUFFIX|-crat|শাসক / সমর্থক|democrat — গণতন্ত্রী, autocrat — স্বৈরশাসক
SUFFIX|-dom|অবস্থা / রাজ্য|freedom — স্বাধীনতা, kingdom — রাজ্য
SUFFIX|-ed|অতীত / অবস্থাসূচক|worked — কাজ করেছিল, tired — ক্লান্ত
SUFFIX|-ee|যার প্রতি কাজ করা হয়|employee — কর্মচারী, trainee — প্রশিক্ষণার্থী
SUFFIX|-eer|পেশাজীবী / কর্তা|engineer — প্রকৌশলী, volunteer — স্বেচ্ছাসেবক
SUFFIX|-en|করা (ক্রিয়া) / তৈরি (বিশেষণ)|strengthen — শক্তিশালী করা, wooden — কাঠের তৈরি
SUFFIX|-ence|অবস্থা / গুণ|difference — পার্থক্য, confidence — আত্মবিশ্বাস
SUFFIX|-ency|অবস্থা / গুণ|emergency — জরুরি অবস্থা, efficiency — দক্ষতা
SUFFIX|-ent|কর্তা / অবস্থাসূচক|student — ছাত্র, dependent — নির্ভরশীল
SUFFIX|-eous|গুণসম্পন্ন|courageous — সাহসী, gorgeous — অপূর্ব
SUFFIX|-er|কর্তা / অধিকতর|teacher — শিক্ষক, bigger — আরও বড়
SUFFIX|-ery|স্থান / কাজ / গুণ|bakery — বেকারি, bravery — সাহসিকতা
SUFFIX|-es|বহুবচন / ক্রিয়ার রূপ|boxes — বাক্সগুলো, watches — দেখে
SUFFIX|-ese|দেশ বা ভাষাসূচক|Chinese — চীনা, Japanese — জাপানি
SUFFIX|-esque|ধাঁচের|picturesque — ছবির মতো সুন্দর, Romanesque — রোমান ধাঁচের
SUFFIX|-ess|স্ত্রীবাচক|actress — অভিনেত্রী, lioness — সিংহী
SUFFIX|-est|সবচেয়ে|biggest — সবচেয়ে বড়, fastest — সবচেয়ে দ্রুত
SUFFIX|-ette|ক্ষুদ্র|cigarette — সিগারেট, kitchenette — ছোট রান্নাঘর
SUFFIX|-fold|গুণ|twofold — দ্বিগুণ, manifold — বহুগুণ
SUFFIX|-ful|পূর্ণ|beautiful — সুন্দর, helpful — সহায়ক
SUFFIX|-fy|করা / পরিণত করা|simplify — সরল করা, purify — শুদ্ধ করা
SUFFIX|-gram|লিখিত / রেকর্ড|telegram — টেলিগ্রাম, diagram — নকশাচিত্র
SUFFIX|-graph|লিখিত / অঙ্কিত|autograph — স্বাক্ষর, photograph — আলোকচিত্র
SUFFIX|-hood|অবস্থা / সময়কাল|childhood — শৈশব, neighbourhood — পাড়া
SUFFIX|-ial|সম্পর্কিত|official — দাপ্তরিক, financial — আর্থিক
SUFFIX|-ian|পেশাজীবী / অধিবাসী|musician — সংগীতজ্ঞ, librarian — গ্রন্থাগারিক
SUFFIX|-ible|যোগ্য / সম্ভব|visible — দৃশ্যমান, flexible — নমনীয়
SUFFIX|-ic|সম্পর্কিত|historic — ঐতিহাসিক, artistic — শৈল্পিক
SUFFIX|-ical|সম্পর্কিত|historical — ইতিহাস-সংক্রান্ত, musical — সাংগীতিক
SUFFIX|-ician|বিশেষজ্ঞ|politician — রাজনীতিবিদ, physician — চিকিৎসক
SUFFIX|-ics|বিদ্যা / শাস্ত্র|physics — পদার্থবিজ্ঞান, economics — অর্থনীতি
SUFFIX|-ify|করা / পরিণত করা|classify — শ্রেণিবিভাগ করা, beautify — সুন্দর করা
SUFFIX|-ile|সম্পর্কিত / প্রবণ|fragile — ভঙ্গুর, juvenile — কিশোর
SUFFIX|-ine|সম্পর্কিত|feminine — নারীসুলভ, marine — সামুদ্রিক
SUFFIX|-ing|চলমান কাজ / কাজের নাম|reading — পড়া, building — ভবন
SUFFIX|-ion|কাজ / অবস্থা|action — কাজ, decision — সিদ্ধান্ত
SUFFIX|-ise|করা (ব্রিটিশ বানান)|organise — আয়োজন করা, criticise — সমালোচনা করা
SUFFIX|-ish|কিছুটা / ধাঁচের|childish — শিশুসুলভ, reddish — লালচে
SUFFIX|-ism|মতবাদ / প্রথা / গুণ|socialism — সমাজতন্ত্র, heroism — বীরত্ব
SUFFIX|-ist|ব্যক্তি / মতাবলম্বী|scientist — বিজ্ঞানী, artist — শিল্পী
SUFFIX|-ite|সম্পর্কিত / খনিজ|favourite — প্রিয়, graphite — গ্রাফাইট
SUFFIX|-ition|কাজ / অবস্থা|competition — প্রতিযোগিতা, addition — যোগ
SUFFIX|-itis|প্রদাহ|arthritis — বাত, bronchitis — শ্বাসনালীর প্রদাহ
SUFFIX|-ity|গুণ / অবস্থা|equality — সমতা, reality — বাস্তবতা
SUFFIX|-ive|প্রবণ / গুণসূচক|active — সক্রিয়, creative — সৃজনশীল
SUFFIX|-ize|করা (আমেরিকান বানান)|realize — উপলব্ধি করা, modernize — আধুনিকীকরণ করা
SUFFIX|-less|-হীন / ছাড়া|careless — অসতর্ক, homeless — গৃহহীন
SUFFIX|-let|ক্ষুদ্র|booklet — পুস্তিকা, piglet — শূকরছানা
SUFFIX|-ling|ক্ষুদ্র / অল্পবয়সী|duckling — হাঁসের ছানা, seedling — চারাগাছ
SUFFIX|-logy|বিদ্যা / শাস্ত্র|biology — জীববিজ্ঞান, psychology — মনোবিজ্ঞান
SUFFIX|-ly|ভাবে (ক্রিয়াবিশেষণ) / সুলভ|quickly — দ্রুত, friendly — বন্ধুসুলভ
SUFFIX|-ment|কাজ / ফল / অবস্থা|development — উন্নয়ন, agreement — চুক্তি
SUFFIX|-meter|পরিমাপক যন্ত্র|thermometer — থার্মোমিটার, speedometer — গতিমাপক যন্ত্র
SUFFIX|-most|সবচেয়ে|topmost — সর্বোচ্চ, utmost — চরম
SUFFIX|-ness|অবস্থা / গুণ|kindness — দয়া, happiness — সুখ
SUFFIX|-oid|সদৃশ|humanoid — মানুষসদৃশ, spheroid — গোলকসদৃশ
SUFFIX|-or|কর্তা|actor — অভিনেতা, doctor — চিকিৎসক
SUFFIX|-ory|স্থান / সম্পর্কিত|factory — কারখানা, compulsory — বাধ্যতামূলক
SUFFIX|-ous|পূর্ণ / গুণসম্পন্ন|dangerous — বিপজ্জনক, famous — বিখ্যাত
SUFFIX|-ious|পূর্ণ / গুণসম্পন্ন|curious — কৌতূহলী, religious — ধার্মিক
SUFFIX|-phobia|ভীতি|hydrophobia — জলাতঙ্ক, claustrophobia — বদ্ধস্থানভীতি
SUFFIX|-phone|শব্দ / ধ্বনি|microphone — মাইক্রোফোন, telephone — টেলিফোন
SUFFIX|-proof|প্রতিরোধী|waterproof — জলরোধী, bulletproof — বুলেটরোধী
SUFFIX|-s|বহুবচন / ক্রিয়ার রূপ|books — বইগুলো, runs — দৌড়ায়
SUFFIX|-scope|দেখার যন্ত্র|telescope — দূরবীক্ষণ যন্ত্র, microscope — অণুবীক্ষণ যন্ত্র
SUFFIX|-ship|অবস্থা / দক্ষতা / পদ|friendship — বন্ধুত্ব, leadership — নেতৃত্ব
SUFFIX|-sion|কাজ / অবস্থা|discussion — আলোচনা, permission — অনুমতি
SUFFIX|-some|প্রবণ / যুক্ত|handsome — সুদর্শন, troublesome — ঝামেলাপূর্ণ
SUFFIX|-ster|কাজের সাথে যুক্ত ব্যক্তি|gangster — সন্ত্রাসী, youngster — তরুণ
SUFFIX|-th|অবস্থা / ক্রমবাচক|growth — বৃদ্ধি, fourth — চতুর্থ
SUFFIX|-tion|কাজ / অবস্থা|celebration — উদযাপন, protection — সুরক্ষা
SUFFIX|-tude|অবস্থা / গুণ|gratitude — কৃতজ্ঞতা, solitude — নির্জনতা
SUFFIX|-ty|গুণ / অবস্থা|safety — নিরাপত্তা, loyalty — আনুগত্য
SUFFIX|-ular|সম্পর্কিত|muscular — পেশিবহুল, popular — জনপ্রিয়
SUFFIX|-ure|কাজ / ফল|failure — ব্যর্থতা, pressure — চাপ
SUFFIX|-ward|অভিমুখে|forward — সামনের দিকে, backward — পেছনের দিকে
SUFFIX|-wards|অভিমুখে|towards — দিকে, afterwards — পরে
SUFFIX|-ways|ভাবে / দিকে|sideways — পাশের দিকে, always — সবসময়
SUFFIX|-wise|অনুসারে / ভাবে|clockwise — ঘড়ির কাঁটার দিকে, otherwise — অন্যথায়
SUFFIX|-worthy|যোগ্য|trustworthy — বিশ্বস্ত, praiseworthy — প্রশংসনীয়
SUFFIX|-wright|নির্মাতা|playwright — নাট্যকার, shipwright — জাহাজনির্মাতা
SUFFIX|-y|যুক্ত / পূর্ণ|rainy — বৃষ্টিময়, healthy — স্বাস্থ্যবান
`;

const lines = (data: string) => data.trim().split("\n").map((line) => line.split("|").map((field) => field.trim()));

/** bake → baked, carry → carried, play → played, walk → walked. */
function regularPast(verb: string) {
  if (verb.endsWith("e")) return `${verb}d`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ied`;
  return `${verb}ed`;
}

/** book → books, box → boxes, city → cities, boy → boys. */
function regularPlural(noun: string) {
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function verbRows() {
  const seen = new Map<string, number>();
  return lines(verbData).map((fields) => {
    const [present, past, pastParticiple, meaning] = fields.length === 4 ? fields : [fields[0], regularPast(fields[0]), regularPast(fields[0]), fields[1]];
    // hang and lie appear twice (two meanings, two sets of forms).
    const count = (seen.get(present) ?? 0) + 1;
    seen.set(present, count);
    return { id: `seed-verb-${slug(present)}${count > 1 ? `-${count}` : ""}`, present, past, pastParticiple, meaning };
  });
}

function nounRows() {
  return lines(nounData).map((fields) => {
    const [singular, plural, rawMeaning] = fields.length === 3 ? fields : [fields[0], regularPlural(fields[0]), fields[1]];
    const person = rawMeaning.startsWith("*");
    return { id: `seed-noun-${slug(singular === "-" ? plural : singular)}`, singular, plural, meaning: person ? rawMeaning.slice(1) : rawMeaning, person };
  });
}

function affixRows() {
  return lines(affixData).map(([kind, affix, meaning, example]) => ({
    id: `seed-affix-${kind.toLowerCase()}-${slug(affix)}`,
    kind: kind as "PREFIX" | "SUFFIX",
    affix,
    meaning,
    example,
  }));
}

async function main() {
  const update = process.argv.includes("--update");
  const prisma = new PrismaClient();
  try {
    const verbs = verbRows();
    const nouns = nounRows();
    const affixes = affixRows();
    for (const [name, rows] of [["verbs", verbs], ["nouns", nouns], ["affixes", affixes]] as const) {
      const ids = rows.map((row) => row.id);
      if (new Set(ids).size !== ids.length) throw new Error(`Two ${name} share an id: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(", ")}`);
    }

    const added = {
      verbs: (await prisma.verbEntry.createMany({ data: verbs, skipDuplicates: true })).count,
      nouns: (await prisma.nounEntry.createMany({ data: nouns, skipDuplicates: true })).count,
      affixes: (await prisma.affixEntry.createMany({ data: affixes, skipDuplicates: true })).count,
    };
    console.log(`Added ${added.verbs} verbs, ${added.nouns} nouns, ${added.affixes} prefixes/suffixes (of ${verbs.length}, ${nouns.length}, ${affixes.length}).`);

    if (update) {
      // Rewrite the built-in rows with the text above, a few hundred at a time.
      const chunks = <T,>(rows: T[]) => Array.from({ length: Math.ceil(rows.length / 200) }, (_, index) => rows.slice(index * 200, index * 200 + 200));
      for (const chunk of chunks(verbs)) await prisma.$transaction(chunk.map(({ id, ...data }) => prisma.verbEntry.update({ where: { id }, data })));
      for (const chunk of chunks(nouns)) await prisma.$transaction(chunk.map(({ id, ...data }) => prisma.nounEntry.update({ where: { id }, data })));
      for (const chunk of chunks(affixes)) await prisma.$transaction(chunk.map(({ id, ...data }) => prisma.affixEntry.update({ where: { id }, data })));
      console.log("Updated every built-in row to the text in this file.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
