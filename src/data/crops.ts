import { CropGuide } from '../types';

type WaterFields = Pick<CropGuide, 'seedWater' | 'seedlingWater' | 'establishedWater'>;
type CropBasics = Omit<CropGuide, keyof WaterFields> & Partial<WaterFields>;

function gardenStaple(crop: CropBasics): CropGuide {
  return {
    seedWater: 'Keep the seed bed evenly moist with a gentle spray until shoots appear.',
    seedlingWater: 'Check daily and water at soil level when the surface begins to dry.',
    establishedWater: 'Water deeply when the top few centimetres dry; increase during hot or windy weather.',
    ...crop,
  };
}

export const CROPS: CropGuide[] = [
  {
    id: 'bean', name: 'Beans', aliases: ['green beans', 'climbing beans', 'bush beans'], category: 'Legume', emoji: '🌱', germinationDays: [7, 14], harvestDays: [55, 75],
    sowMonths: [9, 10, 11, 12, 1, 2], spacingCm: 15, sun: 'Full sun',
    seedWater: 'Keep evenly moist, not waterlogged, until shoots appear.',
    seedlingWater: 'Check daily and water at soil level when the surface dries.',
    establishedWater: 'Deep water 2–3 times weekly; increase during flowering and hot spells.',
    tip: 'Give climbing varieties support early and pick often to extend harvest.',
  },
  {
    id: 'beetroot', name: 'Beetroot', aliases: ['beets'], category: 'Root', emoji: '🪴', germinationDays: [7, 14], harvestDays: [55, 80],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], spacingCm: 10, sun: 'Sun to part shade',
    seedWater: 'Keep the seed row consistently damp while germinating.',
    seedlingWater: 'Water lightly each day in warm or windy weather.',
    establishedWater: 'Aim for steady moisture; irregular watering can make roots woody.',
    tip: 'Each corky seed can produce several seedlings, so thin gently.',
  },
  {
    id: 'carrot', name: 'Carrot', category: 'Root', emoji: '🥕', germinationDays: [10, 21], harvestDays: [70, 100],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 5, sun: 'Full sun',
    seedWater: 'Mist the surface once or twice daily; never let the fine seed bed crust over.',
    seedlingWater: 'Water gently each day until roots establish.',
    establishedWater: 'Deep, even watering 1–2 times weekly helps prevent split roots.',
    tip: 'Sow shallowly into fine, stone-free soil and avoid fresh manure.',
  },
  {
    id: 'cucumber', name: 'Cucumber', category: 'Fruiting vegetable', emoji: '🥒', germinationDays: [4, 10], harvestDays: [55, 75],
    sowMonths: [9, 10, 11, 12, 1, 2], spacingCm: 45, sun: 'Full sun',
    seedWater: 'Keep warm soil consistently moist until emergence.',
    seedlingWater: 'Water at the base each morning while plants establish.',
    establishedWater: 'Deep water regularly; fruit can turn bitter after drought stress.',
    tip: 'Trellising improves airflow and keeps fruit clean.',
  },
  {
    id: 'kale', name: 'Kale', category: 'Brassica', emoji: '🥬', germinationDays: [5, 10], harvestDays: [55, 80],
    sowMonths: [2, 3, 4, 5, 6, 7, 8], spacingCm: 40, sun: 'Sun to part shade',
    seedWater: 'Keep moist with a fine spray until seedlings emerge.',
    seedlingWater: 'Check daily; water when the top centimetre is dry.',
    establishedWater: 'Deep water 1–2 times weekly and mulch around plants.',
    tip: 'Harvest outer leaves first so the centre keeps producing.',
  },
  {
    id: 'lettuce', name: 'Lettuce', aliases: ['cos lettuce', 'romaine lettuce'], category: 'Leafy green', emoji: '🥬', germinationDays: [4, 10], harvestDays: [35, 65],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 25, sun: 'Morning sun / part shade',
    seedWater: 'Mist daily and keep the shallow seed bed cool and moist.',
    seedlingWater: 'Water gently each morning; protect from hot afternoon sun.',
    establishedWater: 'Maintain even moisture to reduce bitterness and bolting.',
    tip: 'In Newcastle, use shade cloth during warm spells and sow small batches often.',
  },
  {
    id: 'pea', name: 'Peas', aliases: ['snow peas', 'sugar snap peas'], category: 'Legume', emoji: '🫛', germinationDays: [7, 14], harvestDays: [60, 85],
    sowMonths: [3, 4, 5, 6, 7, 8], spacingCm: 8, sun: 'Full sun',
    seedWater: 'Water once after sowing, then keep just moist to avoid rot.',
    seedlingWater: 'Check daily while roots establish, especially in drying winds.',
    establishedWater: 'Deep water during flowering and pod fill; avoid wet leaves.',
    tip: 'Install a trellis before tendrils start reaching.',
  },
  {
    id: 'radish', name: 'Radish', category: 'Root', emoji: '🫜', germinationDays: [3, 7], harvestDays: [25, 40],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 5, sun: 'Sun to part shade',
    seedWater: 'Keep the row evenly damp; these seeds emerge quickly.',
    seedlingWater: 'Check daily and never let young roots dry out.',
    establishedWater: 'Water steadily to keep roots crisp and mild.',
    tip: 'Sow a short row every two weeks for a rolling harvest.',
  },
  {
    id: 'silverbeet', name: 'Silverbeet', aliases: ['swiss chard', 'chard'], category: 'Leafy green', emoji: '🌿', germinationDays: [7, 14], harvestDays: [55, 75],
    sowMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], spacingCm: 35, sun: 'Sun to part shade',
    seedWater: 'Keep consistently moist until the cluster seeds emerge.',
    seedlingWater: 'Check daily and thin crowded seedlings.',
    establishedWater: 'Deep water weekly, more often in hot weather.',
    tip: 'Pick outside stalks and leave the heart to regrow.',
  },
  {
    id: 'spinach', name: 'Spinach', category: 'Leafy green', emoji: '🍃', germinationDays: [5, 14], harvestDays: [35, 55],
    sowMonths: [3, 4, 5, 6, 7, 8], spacingCm: 15, sun: 'Sun to part shade',
    seedWater: 'Keep cool soil damp through germination.',
    seedlingWater: 'Water lightly each day if the surface is drying.',
    establishedWater: 'Maintain even moisture; heat and dryness trigger bolting.',
    tip: 'Best in Newcastle’s cooler months; harvest leaves young.',
  },
  {
    id: 'tomato', name: 'Tomato', aliases: ['cherry tomato', 'roma tomato'], category: 'Fruiting vegetable', emoji: '🍅', germinationDays: [5, 10], harvestDays: [90, 120],
    sowMonths: [8, 9, 10, 11], spacingCm: 50, sun: 'Full sun',
    seedWater: 'Keep seed mix warm and evenly moist, using a gentle mist.',
    seedlingWater: 'Water in the morning when the surface starts to dry.',
    establishedWater: 'Deep water 2–3 times weekly; keep moisture consistent as fruit forms.',
    tip: 'Stake early and keep water off leaves to reduce fungal disease in humid weather.',
  },
  {
    id: 'zucchini', name: 'Zucchini', aliases: ['courgette'], category: 'Fruiting vegetable', emoji: '🥒', germinationDays: [4, 10], harvestDays: [45, 65],
    sowMonths: [9, 10, 11, 12, 1, 2], spacingCm: 80, sun: 'Full sun',
    seedWater: 'Keep warm soil moist but not saturated.',
    seedlingWater: 'Water at the base each morning while leaves establish.',
    establishedWater: 'Deep water regularly and mulch; avoid splashing foliage.',
    tip: 'Pick fruit small and frequently for tender zucchinis and continued production.',
  },
  gardenStaple({
    id: 'basil', name: 'Basil', aliases: ['sweet basil', 'thai basil', 'genovese basil'], category: 'Herb', emoji: '🌿',
    germinationDays: [5, 10], harvestDays: [45, 70], sowMonths: [9, 10, 11, 12, 1, 2], spacingCm: 25, sun: 'Full sun',
    tip: 'Pinch out growing tips often and remove flower buds to keep leaves coming.',
  }),
  gardenStaple({
    id: 'parsley', name: 'Parsley', aliases: ['flat leaf parsley', 'curly parsley'], category: 'Herb', emoji: '🌿',
    germinationDays: [14, 28], harvestDays: [70, 95], sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], spacingCm: 20, sun: 'Sun to part shade',
    tip: 'Soak seed overnight and expect slow germination; harvest outer stems first.',
  }),
  gardenStaple({
    id: 'coriander', name: 'Coriander', aliases: ['cilantro'], category: 'Herb', emoji: '🌿',
    germinationDays: [7, 14], harvestDays: [35, 60], sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 15, sun: 'Morning sun / part shade',
    tip: 'Sow directly in small batches; warm weather makes plants bolt quickly.',
  }),
  gardenStaple({
    id: 'chives', name: 'Chives', aliases: ['garden chives'], category: 'Herb', emoji: '🌱',
    germinationDays: [7, 14], harvestDays: [60, 90], sowMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], spacingCm: 15, sun: 'Sun to part shade',
    tip: 'Cut leaves near the base and divide established clumps every few years.',
  }),
  gardenStaple({
    id: 'dill', name: 'Dill', category: 'Herb', emoji: '🌿', germinationDays: [7, 14], harvestDays: [40, 70],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 25, sun: 'Full sun',
    tip: 'Direct sow because dill dislikes root disturbance; let some flower for beneficial insects.',
  }),
  gardenStaple({
    id: 'mint', name: 'Mint', aliases: ['peppermint', 'spearmint'], category: 'Herb', emoji: '🌿',
    germinationDays: [10, 16], harvestDays: [60, 90], sowMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], spacingCm: 35, sun: 'Part shade',
    tip: 'Keep mint contained in a pot because its runners spread aggressively.',
  }),
  gardenStaple({
    id: 'oregano', name: 'Oregano', category: 'Herb', emoji: '🌿', germinationDays: [7, 14], harvestDays: [70, 100],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], spacingCm: 30, sun: 'Full sun',
    tip: 'Allow the soil surface to dry between watering once established.',
  }),
  gardenStaple({
    id: 'rosemary', name: 'Rosemary', category: 'Herb', emoji: '🌿', germinationDays: [14, 30], harvestDays: [100, 150],
    sowMonths: [3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 60, sun: 'Full sun',
    tip: 'Seed is slow; nursery seedlings or cuttings are usually easier. Avoid wet feet.',
  }),
  gardenStaple({
    id: 'sage', name: 'Sage', category: 'Herb', emoji: '🌿', germinationDays: [10, 21], harvestDays: [75, 110],
    sowMonths: [3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 40, sun: 'Full sun',
    tip: 'Prune lightly after flowering and keep foliage dry in Newcastle humidity.',
  }),
  gardenStaple({
    id: 'thyme', name: 'Thyme', category: 'Herb', emoji: '🌿', germinationDays: [14, 28], harvestDays: [85, 120],
    sowMonths: [3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 25, sun: 'Full sun',
    tip: 'Use free-draining soil and avoid overwatering established plants.',
  }),
  gardenStaple({
    id: 'rocket', name: 'Rocket', aliases: ['arugula', 'roquette'], category: 'Leafy green', emoji: '🥬',
    germinationDays: [3, 8], harvestDays: [25, 45], sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11], spacingCm: 10, sun: 'Sun to part shade',
    tip: 'Succession sow every few weeks and pick young leaves for a milder flavour.',
  }),
  gardenStaple({
    id: 'bok-choy', name: 'Bok Choy', aliases: ['pak choi', 'pak choy', 'asian greens'], category: 'Leafy green', emoji: '🥬',
    germinationDays: [4, 8], harvestDays: [35, 55], sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 20, sun: 'Sun to part shade',
    tip: 'Protect seedlings from cabbage moth and keep moisture even to prevent bolting.',
  }),
  gardenStaple({
    id: 'broccoli', name: 'Broccoli', aliases: ['broccolini'], category: 'Brassica', emoji: '🥦',
    germinationDays: [5, 10], harvestDays: [75, 110], sowMonths: [1, 2, 3, 4, 5, 6, 7], spacingCm: 45, sun: 'Full sun',
    tip: 'Net early against cabbage moth and harvest the main head before flowers open.',
  }),
  gardenStaple({
    id: 'cabbage', name: 'Cabbage', category: 'Brassica', emoji: '🥬', germinationDays: [5, 10], harvestDays: [80, 120],
    sowMonths: [1, 2, 3, 4, 5, 6, 7], spacingCm: 45, sun: 'Full sun',
    tip: 'Firm soil around seedlings and use insect netting from planting time.',
  }),
  gardenStaple({
    id: 'cauliflower', name: 'Cauliflower', category: 'Brassica', emoji: '🥦', germinationDays: [5, 10], harvestDays: [90, 130],
    sowMonths: [1, 2, 3, 4, 5, 6], spacingCm: 50, sun: 'Full sun',
    tip: 'Steady growth is essential; avoid drought or nutrient stress while heads form.',
  }),
  gardenStaple({
    id: 'brussels-sprouts', name: 'Brussels Sprouts', aliases: ['brussel sprouts'], category: 'Brassica', emoji: '🥬',
    germinationDays: [5, 10], harvestDays: [120, 180], sowMonths: [1, 2, 3, 4], spacingCm: 60, sun: 'Full sun',
    tip: 'Plant early enough for sprouts to mature through the coolest part of the year.',
  }),
  gardenStaple({
    id: 'spring-onion', name: 'Spring Onion', aliases: ['green onion', 'shallots', 'scallions'], category: 'Allium', emoji: '🧅',
    germinationDays: [7, 14], harvestDays: [55, 80], sowMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], spacingCm: 4, sun: 'Sun to part shade',
    tip: 'Sow a short row every three weeks for a steady kitchen supply.',
  }),
  gardenStaple({
    id: 'onion', name: 'Onion', aliases: ['brown onion', 'red onion'], category: 'Allium', emoji: '🧅',
    germinationDays: [7, 14], harvestDays: [150, 210], sowMonths: [2, 3, 4, 5, 6, 7, 8], spacingCm: 10, sun: 'Full sun',
    tip: 'Choose a variety suited to local day length and reduce watering as tops fall.',
  }),
  gardenStaple({
    id: 'leek', name: 'Leek', category: 'Allium', emoji: '🌱', germinationDays: [10, 21], harvestDays: [120, 180],
    sowMonths: [1, 2, 3, 4, 5, 6, 7], spacingCm: 15, sun: 'Full sun',
    tip: 'Plant seedlings into deep holes and gradually mound soil for longer white stems.',
  }),
  gardenStaple({
    id: 'garlic', name: 'Garlic', category: 'Allium', emoji: '🧄', germinationDays: [7, 21], harvestDays: [180, 240],
    sowMonths: [3, 4, 5, 6], spacingCm: 15, sun: 'Full sun',
    tip: 'Plant individual cloves point-up and stop watering as leaves yellow near harvest.',
  }),
  gardenStaple({
    id: 'turnip', name: 'Turnip', category: 'Root', emoji: '🫜', germinationDays: [3, 8], harvestDays: [40, 65],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9], spacingCm: 10, sun: 'Sun to part shade',
    tip: 'Direct sow and thin promptly; young leaves are edible too.',
  }),
  gardenStaple({
    id: 'parsnip', name: 'Parsnip', category: 'Root', emoji: '🥕', germinationDays: [14, 28], harvestDays: [120, 180],
    sowMonths: [2, 3, 4, 5, 6, 7], spacingCm: 10, sun: 'Full sun',
    tip: 'Use fresh seed, direct sow, and keep the surface moist during slow germination.',
  }),
  gardenStaple({
    id: 'potato', name: 'Potato', aliases: ['seed potato'], category: 'Root', emoji: '🥔', germinationDays: [14, 28], harvestDays: [90, 140],
    sowMonths: [2, 3, 4, 7, 8, 9], spacingCm: 35, sun: 'Full sun',
    tip: 'Hill soil or mulch around stems as they grow and harvest after foliage dies back.',
  }),
  gardenStaple({
    id: 'sweet-potato', name: 'Sweet Potato', category: 'Root', emoji: '🍠', germinationDays: [10, 21], harvestDays: [120, 180],
    sowMonths: [9, 10, 11, 12, 1, 2], spacingCm: 40, sun: 'Full sun',
    tip: 'Plant slips into warm soil and give spreading vines plenty of room.',
  }),
  gardenStaple({
    id: 'capsicum', name: 'Capsicum', aliases: ['bell pepper', 'sweet pepper'], category: 'Fruiting vegetable', emoji: '🫑',
    germinationDays: [7, 21], harvestDays: [90, 140], sowMonths: [8, 9, 10, 11, 12], spacingCm: 45, sun: 'Full sun',
    tip: 'Seeds need warmth; keep plants evenly watered once fruit begins to swell.',
  }),
  gardenStaple({
    id: 'chilli', name: 'Chilli', aliases: ['chili', 'hot pepper'], category: 'Fruiting vegetable', emoji: '🌶️',
    germinationDays: [7, 21], harvestDays: [90, 150], sowMonths: [8, 9, 10, 11, 12], spacingCm: 45, sun: 'Full sun',
    tip: 'Warmth speeds germination; established plants may overwinter in sheltered Newcastle gardens.',
  }),
  gardenStaple({
    id: 'eggplant', name: 'Eggplant', aliases: ['aubergine'], category: 'Fruiting vegetable', emoji: '🍆',
    germinationDays: [7, 14], harvestDays: [100, 150], sowMonths: [8, 9, 10, 11], spacingCm: 55, sun: 'Full sun',
    tip: 'Start with warm soil, stake heavy plants, and pick fruit while skins are glossy.',
  }),
  gardenStaple({
    id: 'pumpkin', name: 'Pumpkin', aliases: ['squash'], category: 'Fruiting vegetable', emoji: '🎃',
    germinationDays: [4, 10], harvestDays: [100, 150], sowMonths: [9, 10, 11, 12, 1], spacingCm: 120, sun: 'Full sun',
    tip: 'Direct vines out of the bed and hand-pollinate morning flowers if fruit set is poor.',
  }),
  gardenStaple({
    id: 'sweet-corn', name: 'Sweet Corn', aliases: ['corn', 'maize'], category: 'Fruiting vegetable', emoji: '🌽',
    germinationDays: [5, 10], harvestDays: [75, 110], sowMonths: [9, 10, 11, 12, 1, 2], spacingCm: 30, sun: 'Full sun',
    tip: 'Plant in a compact block rather than one long row to improve wind pollination.',
  }),
  gardenStaple({
    id: 'celery', name: 'Celery', category: 'Leafy green', emoji: '🌿', germinationDays: [14, 21], harvestDays: [110, 160],
    sowMonths: [2, 3, 4, 5, 6, 7, 8], spacingCm: 25, sun: 'Sun to part shade',
    tip: 'Celery needs rich soil and constant moisture; dryness produces stringy stalks.',
  }),
  gardenStaple({
    id: 'strawberry', name: 'Strawberry', aliases: ['strawberries'], category: 'Fruiting vegetable', emoji: '🍓',
    germinationDays: [14, 28], harvestDays: [100, 160], sowMonths: [3, 4, 5, 6, 7, 8], spacingCm: 30, sun: 'Full sun',
    tip: 'Runners or crowns establish faster than seed; keep fruit raised on clean mulch.',
  }),
  gardenStaple({
    id: 'marigold', name: 'Marigold', aliases: ['french marigold'], category: 'Companion', emoji: '🌼',
    germinationDays: [4, 10], harvestDays: [55, 80], sowMonths: [8, 9, 10, 11, 12, 1, 2], spacingCm: 25, sun: 'Full sun',
    tip: 'Place along bed edges to add colour and attract pollinators and beneficial insects.',
  }),
  gardenStaple({
    id: 'nasturtium', name: 'Nasturtium', category: 'Companion', emoji: '🌼', germinationDays: [7, 14], harvestDays: [55, 80],
    sowMonths: [2, 3, 4, 5, 6, 7, 8, 9, 10], spacingCm: 30, sun: 'Sun to part shade',
    tip: 'Leaves and flowers are edible; let plants trail over bed edges.',
  }),
];

export const ROW_COLORS = ['#00DFA2', '#FF4F8B', '#7B61FF', '#FFD400', '#00B7FF', '#FF7A00'];

export function cropById(id: string) {
  return CROPS.find((crop) => crop.id === id);
}

function cropSearchText(crop: CropGuide) {
  return [crop.name, ...(crop.aliases ?? [])].join(' ').toLowerCase();
}

export function matchCropGuide(name: string) {
  const query = name.trim().toLowerCase();
  if (!query) return undefined;
  return CROPS.find((crop) => crop.name.toLowerCase() === query || crop.aliases?.some((alias) => alias.toLowerCase() === query))
    ?? CROPS.find((crop) => query.includes(crop.name.toLowerCase()) || crop.aliases?.some((alias) => query.includes(alias.toLowerCase())));
}

export function cropSuggestions(queryText: string, limit = 6) {
  const query = queryText.trim().toLowerCase();
  if (!query) return [];
  return CROPS
    .filter((crop) => cropSearchText(crop).includes(query) && crop.name.toLowerCase() !== query)
    .sort((a, b) => {
      const aStarts = cropSearchText(a).split(' ').some((word) => word.startsWith(query)) ? 0 : 1;
      const bStarts = cropSearchText(b).split(' ').some((word) => word.startsWith(query)) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function cropsForMonth(monthIndex: number) {
  const month = monthIndex + 1;
  return CROPS.filter((crop) => crop.sowMonths.includes(month));
}
