/**
 * Built-in list of common English prefixes and suffixes with their Bangla meaning and examples,
 * shown to every user in Vocabulary → Prefix & Suffix (read-only, next to the user's own entries).
 *
 * One per line: "PREFIX|un-|meaning|example — অর্থ, example — অর্থ" (SUFFIX for suffixes).
 */
const data = `
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

export type CommonAffix = { kind: "PREFIX" | "SUFFIX"; affix: string; meaning: string; example: string };

export const commonAffixes: CommonAffix[] = data
  .trim()
  .split("\n")
  .map((line) => {
    const [kind, affix, meaning, example] = line.split("|").map((field) => field.trim());
    return { kind: kind as CommonAffix["kind"], affix, meaning, example };
  });

/** An affix without its dashes and case, for spotting the same one written differently ("un" / "Un-"). */
export const bareAffix = (affix: string) => affix.replace(/^[-–]+|[-–]+$/g, "").toLowerCase();
