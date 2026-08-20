/* ============================================================
   js/products.js
   DISPLAY catalog only. Prices here are for rendering.
   The SERVER re-prices every cart from api/_catalog.js.
   Nothing the browser sends about price is ever trusted.
============================================================ */
window.SHIPPING_FEE = 0;   // flat US shipping, in dollars
window.TAX_RATE = 0;       // see README: US sales tax depends on your nexus
window.MAX_QTY = 10;

window.PRODUCTS = [
{
  id:'bubble-carrier',
  name:'Bubble Pet Carrier Backpack',
  tagline:'Transparent panoramic shell, large capacity, for cats and small dogs',
  active: true,
  maxQuantity: 10,
  price:45, compareAt:45, cat:'carriers', badge:'Bestseller', rating:4.8, reviews:412,
  main:'https://petsone.pk/wp-content/uploads/2024/01/download-15-1.jpeg',
  desc:[
    'A panoramic bubble backpack that lets your cat or small dog watch the world go by while you keep both hands free. The transparent front shell gives a full 180° view, and the hard outer frame holds its shape so nothing presses down on your pet.',
    'Ventilation holes run along both sides and the top, and the padded shoulder straps spread the weight across your back rather than your shoulders. Choose a clear shell for curious pets, or a light-proof cover if yours prefers a darker, calmer space.'
  ],
  features:['Panoramic transparent front shell with a 180° view','Hard outer frame keeps its shape under load','Side and top ventilation holes for constant airflow','Padded, adjustable shoulder straps for longer walks','Light-proof cover options for anxious pets','Wipe-clean interior with a removable mat'],
  specs:{'Capacity':'Cats and small dogs up to 7kg','Shell':'Transparent PC front with ABS frame','Weight':'1100g (1300g for cover variants)','Colours':'13 options','Shipping':'Free across the US','Processing':'2-3 business days','Delivery':'8-15 days'},
  shipCost:'Free', shipTime:'8-15 days', processing:'2-3 business days',
  optionLabel:'Colour',
  variants:[
    {n:'Black',c:'#1E1E1E',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/48CD2A3B9062EA019114D1D2CC81966D.jpg'},
    {n:'Red',c:'#C0392B',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/C22B4BB26D4099FE8F36ED31399CCE7A.jpg'},
    {n:'Dark green',c:'#2E5E4E',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/03B345D0CF4C8F3BE7A8BA5E04FDC76D.jpg'},
    {n:'Yellow',c:'#E9C22B',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/A350B2966D623008F92ECCF3298B07C6.jpg'},
    {n:'Gray',c:'#9A9A9A',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/26BF56476E795EBA6361FBE84C1ADE44.jpg'},
    {n:'Blue',c:'#3A78C2',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/094DC471A7A194878F4139F47515D52C.jpg'},
    {n:'Pink',c:'#E58FA8',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/D5EB3A1DA3AB8BCC9900558D88C7C5B0.jpg'},
    {n:'Fruit green',c:'#8CC63F',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/DA2309EA13483B98914FFC9C5CAAE8C8.jpg'},
    {n:'Lemon yellow',c:'#F2E14C',w:'1100g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/C96BA68F0FC401528F0A39FAD8158B4E.jpg'},
    {n:'Brown front shell',c:'#7B4A17',w:'1300g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/352DAE0F3B137FE7467935E30ED61603.jpg'},
    {n:'Green blue cover',c:'#4E9A93',w:'1300g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/4B0D41C55487F49CBAFF7FB3039AEF0A.jpg'},
    {n:'Green brown light-proof',c:'#6B6B3A',w:'1300g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/624F7AB60B6645EB6C9BBE35471F8039.jpg'},
    {n:'Blue brown light-proof',c:'#4A5C7A',w:'1300g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202310/C61B5CC471FFDED9EBECD0F3ABF7B5F7.jpg'}
  ]
},
{
  id:'ball-launcher',
  name:'Automatic Ball Launcher',
  tagline:'Interactive tennis ball thrower for small and medium dogs',
  active: true,
  maxQuantity: 10,
  price:99, compareAt:139, cat:'toys', badge:'Top rated', rating:4.9, reviews:308,
  main:'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/EFA7AA610C00BDEA0352B92939B99719.JPEG',
  desc:[
    'An automatic ball launcher that plays fetch when you can\'t. Your dog drops the ball in the top, the machine throws it, and after a few rounds most dogs work out the loop and keep the game going on their own.',
    'Built from durable ABS, it works indoors and out and ships with three 2-inch tennis balls. Designed for small to medium dogs who need more exercise than a single evening walk provides.'
  ],
  features:['Fully automatic - your dog reloads it themselves','Three 2-inch tennis balls included','Durable ABS body for indoor and outdoor play','Sized for small and medium dogs','Encourages independent exercise and mental stimulation','A global bestseller from All For Paws'],
  specs:{'Material':'ABS','Suits':'Small and medium dogs','Included':'3 × 2-inch tennis balls','Weight':'2150g','Colour':'White','Shipping':'Free across the US','Delivery':'10-18 days'},
  shipCost:'Free', shipTime:'10-18 days', processing:'2-3 business days',
  optionLabel:'Colour',
  variants:[{n:'White',c:'#F2F2F2',w:'2150g',img:'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/EFA7AA610C00BDEA0352B92939B99719.JPEG'}],
  gallery:[
    'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/EFA7AA610C00BDEA0352B92939B99719.JPEG',
    'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/1A31B7D3A70EF8BE8B4017C5A70448C9.JPEG',
    'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/C78A6D7DA8FBE5E6B58380F15405214E.JPEG',
    'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/8E3EC1D80B326CF1009DFF018A280B91.JPEG',
    'https://shopifyfile.oss-us-west-1.aliyuncs.com/attached/image/202407/E9482F8CF8DEB979D7E40421711F702F.JPEG'
  ]
},
{
  id:'water-dispenser',
  name:'Adjustable Pet Water Dispenser',
  tagline:'Height-adjustable cat dispenser that refills itself from a bottle',
  active: true,
  maxQuantity: 10,
  price:35, compareAt:49, cat:'fountains', badge:'New', rating:4.7, reviews:186,
  main:'https://fursera.com/cdn/shop/files/ChatGPT_Image_2026_7_9_14_30_33.png?v=1783651363&width=1600',
  desc:[
    'A gravity dispenser you can raise or lower so your cat drinks at a comfortable height instead of hunching over a floor bowl - easier on the neck and better for posture.',
    'The bowl refills automatically from the matching 650ml bottle, so water stays at a steady level all day. Everything comes apart for cleaning, and the base is weighted enough that enthusiastic drinkers won\'t tip it.'
  ],
  features:['Adjustable height protects your cat\'s neck and spine','Automatic gravity refill from the matching bottle','650ml bottle included with every set','Fully separable for easy weekly cleaning','Weighted, non-slip base','Food-grade plastic throughout'],
  specs:{'Material':'Food-grade plastic','Suits':'Cats and small dogs','Bottle':'650ml, included','Weight':'800g','Shipping':'Free across the US','Delivery':'8-12 days'},
  shipCost:'Free', shipTime:'8-12 days', processing:'2-3 business days',
  optionLabel:'Set',
  variants:[
    {n:'Blue + 650ml bottle',c:'#5A96DC',w:'800g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202607/14F8868B4CA9312C5ABA487F1A1BA734.jpg'},
    {n:'Pink + 650ml bottle',c:'#E58FA8',w:'800g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202607/178CA72B2E0773B713DD93EB89681DBA.jpg'},
    {n:'Yellow riser + 640ml bottle',c:'#F0C93F',w:'800g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202607/9B566775FA58B732BE1B706B0CFF6A5A.png'}
  ],
  gallery:[
    'https://fursera.com/cdn/shop/files/ChatGPT_Image_2026_7_9_14_30_33.png?v=1783651363&width=1600',
    'https://www.puptailor.com/cdn/shop/files/8_0933bf08-de64-4134-b93c-7af528edaacf.jpg?v=1784099512'
  ]
},
{
  id:'travel-bottle',
  name:'Portable Dog Water Bottle',
  tagline:'304 stainless steel travel bottle with a fold-out drinking bowl',
  active: true,
  maxQuantity: 10,
  price:30, compareAt:42, cat:'travel', badge:'', rating:4.6, reviews:241,
  main:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/B9E825AFA1D0211941E9F8E03F0D9977.jpg',
  desc:[
    'A 285ml stainless steel bottle with a silicone bowl built into the lid - flip it open, press the button, and your dog drinks without a drop hitting the pavement.',
    'The 304 stainless body keeps water cool for hours and doesn\'t hold onto smells the way plastic does. Small enough for a jacket pocket, sealed well enough for a backpack.'
  ],
  features:['One-handed operation - flip, press, pour','304 stainless steel keeps water cool for hours','Integrated silicone bowl, nothing extra to carry','285ml capacity, pocket-sized','Leak-proof seal for bags and backpacks','Print and plain finishes available'],
  specs:{'Material':'304 stainless steel + silicone','Capacity':'285ml','Weight':'250g','Colours':'4 options','Shipping':'Free across the US','Delivery':'8-15 days'},
  shipCost:'Free', shipTime:'8-15 days', processing:'2-3 business days',
  optionLabel:'Finish',
  variants:[
    {n:'Mist pink',c:'#EFB6C0',w:'250g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202605/FAFE32A18433545A5E790512238E052C.jpg'},
    {n:'Tiffany blue',c:'#7FD4CE',w:'250g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/B9E825AFA1D0211941E9F8E03F0D9977.jpg'},
    {n:'Mist pink (print)',c:'#E9A0AE',w:'250g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202605/F34597C57709767D8B7FEA9B6DD4524D.jpg'},
    {n:'Tiffany blue (print)',c:'#6CC6C0',w:'250g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202605/5040A2B879235F2A7C9A79C585503534.jpg'}
  ],
  gallery:[
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/B9E825AFA1D0211941E9F8E03F0D9977.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/B6702EED3986C26999882395D957E1E4.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/C4128FD46CD550F47FDD61F405149834.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/1126ED44111A548CA0018AF07543DF9B.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/pingtai/202605/31E1B2AEE72F95CFDF2128C30FFA023A.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202605/FAFE32A18433545A5E790512238E052C.jpg'
  ]
},
{
  id:'travel-cup',
  name:'Pet Water Feeder Travel Cup',
  tagline:'580ml large-capacity flip cup kettle for long walks',
  active: true,
  maxQuantity: 10,
  price:20, compareAt:29, cat:'travel', badge:'Best value', rating:4.5, reviews:167,
  main:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202203/278C36FB71E520DBE05D33269E652D08.jpg',
  desc:[
    'The big-capacity option: 580ml is enough for a long hike or a full day in the car, and the flip-top design means the cup and the bottle are the same object.',
    'Tip it forward to pour, tip it back and any water your dog doesn\'t drink runs straight back into the bottle. Nothing is wasted and nothing spills in your bag.'
  ],
  features:['580ml - nearly double a standard travel bottle','Flip-top cup doubles as the drinking bowl','Unused water pours back into the bottle','Leak-proof lock for bags and car boots','Lightweight at 320g even when full','Four colours to choose from'],
  specs:{'Capacity':'580ml','Weight':'320g','Colours':'4 options','Suits':'Dogs of all sizes','Shipping':'Free across the US','Delivery':'8-15 days'},
  shipCost:'Free', shipTime:'8-15 days', processing:'2-3 business days',
  optionLabel:'Colour',
  variants:[
    {n:'Blue',c:'#3A78C2',w:'320g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202203/19F6A82F94CDA7E33FB4536BEF001A0A.jpg'},
    {n:'Green',c:'#57A05A',w:'320g',img:'https://cbu01.alicdn.com/img/ibank/2020/248/430/17073034842_1308716586.jpg'},
    {n:'Black',c:'#242424',w:'320g',img:'https://cbu01.alicdn.com/img/ibank/2020/941/220/17073022149_1308716586.jpg'},
    {n:'Orange',c:'#F4622B',w:'320g',img:'https://cbu01.alicdn.com/img/ibank/2020/648/554/17142455846_1308716586.jpg'}
  ],
  gallery:[
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202203/278C36FB71E520DBE05D33269E652D08.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202203/D670C9E881A2645020D2F6DBDB5C7594.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202203/19F6A82F94CDA7E33FB4536BEF001A0A.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202203/9EDCFCBD87E6E91379340007F59BAA9B.jpg',
    'https://cbu01.alicdn.com/img/ibank/2020/608/309/17080903806_1308716586.jpg'
  ]
},
{
  id:'cat-fountain',
  name:'Automatic Cat Water Fountain 2L',
  tagline:'Filtered LED fountain with a motion sensor that waits for your cat',
  active: true,
  maxQuantity: 10,
  price:49, compareAt:69, cat:'fountains', badge:'Staff pick', rating:4.8, reviews:395,
  main:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/465A6F45822FBB7E57D7D0CA8E235F50.jpg',
  desc:[
    'A 2L filtered fountain with a motion sensor: it stays silent until your cat walks up, runs for 60 seconds, then goes back to standby. Quieter than an always-on pump, and much kinder to the filter and motor.',
    'Running water encourages cats to drink far more than they do from a still bowl, which matters for kidney and urinary health. The charcoal filter removes hair, debris and odours from every cycle.'
  ],
  features:['Motion sensor activates within roughly 0.2-3 metres','Runs 60 seconds, then returns to standby automatically','2L capacity with a soft LED water-level indicator','Charcoal filter removes hair, debris and odours','Near-silent operation, safe for nervous cats','Sensor mounts with a suction cup or adhesive pad'],
  specs:{'Capacity':'2 litres','Sensor range':'0.2-3 metres','Run time':'60 seconds per activation','Filter':'Charcoal, replace every 1-2 months','Colours':'4 options','Shipping':'Free across the US','Delivery':'8-15 days'},
  shipCost:'Free', shipTime:'8-15 days', processing:'2-3 business days',
  optionLabel:'Colour',
  care:[
    'Replace the charcoal filter monthly for best filtering; in sensor mode, every 1-2 months is enough.',
    'Clean the pump regularly - it is the single biggest factor in how long the fountain lasts.',
    'To stop the flow, cover the round sensor head with your palm, blocking the light, for 60 seconds.'
  ],
  specsExtra:true,
  variants:[
    {n:'Blue',c:'#5A96DC',w:'1200g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/465A6F45822FBB7E57D7D0CA8E235F50.jpg'},
    {n:'Light green',c:'#9FD18A',w:'1200g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/7D80D6BB551A6B7E1CAFE594362C6746.jpg'},
    {n:'Grey',c:'#A6A6A6',w:'1200g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/053A4903DDA5A6BF2B9E157063270042.jpg'},
    {n:'Orange',c:'#F4903A',w:'1200g',img:'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/AB1E6850EFF91C9F0555E3CEF2E43788.jpg'}
  ],
  gallery:[
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/465A6F45822FBB7E57D7D0CA8E235F50.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/658100CDE287722B6AE46DE23661B587.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/9AE20219B959CB58C510C212ED5ED5CB.jpg',
    'https://shopifyfile.oss-accelerate.aliyuncs.com/attached/image/202110/22EF98270CCFC85F8378DFA3B97A96EE.jpg',
    'https://cbu01.alicdn.com/img/ibank/O1CN01C5Y6ht1rO0YtDkj9U_!!2211158695620-0-cib.jpg'
  ]
}
];

window.FAQS = [
  ['Do you really ship for free?','Yes - every product ships free to any address in the United States, with no minimum order. Tracking is included and the price you see at checkout is the price you pay.'],
  ['How long will my order take?','Orders are processed in 2-3 business days, then delivery takes 8-15 days for most products (10-18 days for the ball launcher). Each product page lists its own estimate.'],
  ['What if my item arrives damaged or wrong?','Message us within 48 hours of delivery with a photo and we will make it right. We are a small shop and we do not run a general change of mind returns programme, so please check the colour and size on the product page before ordering.'],
  ['Which carrier colour should I pick?','If your cat is curious, go for a clear shell - most enjoy the view. If yours is nervous in the car or on public transport, a light-proof cover variant keeps things calmer.'],
  ['How often does the fountain filter need changing?','Monthly in continuous mode, or every 1-2 months in sensor mode since the pump runs far less. Cleaning the pump regularly matters just as much as the filter.'],
  ['Is the ball launcher suitable for a large dog?','It\'s designed for small and medium dogs with 2-inch balls. Large breeds can use it, but the throw distance will feel short to them.']
];

window.CATS = { carriers:'Carriers', fountains:'Fountains', travel:'Travel water', toys:'Play' };

window.money = function (n) { return '$' + Number(n).toFixed(2); };
window.findProduct = function (id) { return window.PRODUCTS.find(function (p) { return p.id === id; }); };
window.stars = function (r) {
  var f = Math.round(r);
  return '\u2605'.repeat(f) + '\u2606'.repeat(5 - f);
};
window.galleryFor = function (p, vi) {
  var imgs = [], v = p.variants[vi];
  if (v && v.img) imgs.push(v.img);
  (p.gallery || []).forEach(function (g) { if (imgs.indexOf(g) < 0) imgs.push(g); });
  if (imgs.indexOf(p.main) < 0) imgs.push(p.main);
  p.variants.forEach(function (x) { if (x.img && imgs.indexOf(x.img) < 0) imgs.push(x.img); });
  return imgs.slice(0, 8);
};
