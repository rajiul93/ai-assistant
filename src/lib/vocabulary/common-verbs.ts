/**
 * Built-in list of commonly used English verbs with their Bangla meaning, shown to every user in
 * Vocabulary → Verb (read-only, next to the user's own verbs).
 *
 * One verb per line: "present|meaning" for a regular verb (past and past participle follow the
 * spelling rules in regularPast), or "present|past|past participle|meaning" when the forms are
 * irregular or double a letter (British spelling: travel → travelled).
 */
const data = `
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

export type CommonVerb = { present: string; past: string; pastParticiple: string; meaning: string };

/** The regular past (= past participle): bake → baked, carry → carried, play → played, walk → walked. */
export function regularPast(verb: string) {
  if (verb.endsWith("e")) return `${verb}d`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ied`;
  return `${verb}ed`;
}

export const commonVerbs: CommonVerb[] = data
  .trim()
  .split("\n")
  .map((line) => {
    const fields = line.split("|").map((field) => field.trim());
    if (fields.length === 4) return { present: fields[0], past: fields[1], pastParticiple: fields[2], meaning: fields[3] };
    const past = regularPast(fields[0]);
    return { present: fields[0], past, pastParticiple: past, meaning: fields[1] };
  });
