import { translate, resolveLocale } from './i18n.js?v=20260914.2';
const localized = (en, ja, fr) => ({ en, ja, fr });
export const routes = [
  {
    id: 'kyoto', category: 'countryside', days: 3, image: 'japan',
    title: localized('The quiet way to Kyoto', '京都へ、のんびり寄り道', 'Le chemin tranquille vers Kyoto'),
    region: localized('Kyoto region, Japan', '日本・京都', 'Région de Kyoto, Japon'),
    description: localized('Village lanes, wooded hills, and a little space to breathe. Discover the quieter side of Kyoto at your own pace.', '里山の小道、緑の丘、ほっとひと息つける時間。自分のペースで、静かな京都を見つけましょう。', 'Des ruelles de village, des collines boisées et le temps de respirer. Découvrez un Kyoto plus paisible, à votre rythme.'),
    stops: [
      localized(['Kyoto · A gentle beginning', 'Explore a quiet neighborhood and settle in with a local meal.'], ['京都・ゆったり旅のはじまり', '静かな街並みを歩き、地元の料理を楽しみながら旅を始めましょう。'], ['Kyoto · Un départ en douceur', 'Explorez un quartier calme et prenez le temps d’un repas local.']),
      localized(['Ohara · Into the hills', 'Visit the village lanes and gardens of Ohara, north of Kyoto.'], ['大原・里山を訪ねて', '京都の北、大原の小道や庭園を散策しましょう。'], ['Ohara · Vers les collines', 'Parcourez les ruelles et les jardins d’Ohara, au nord de Kyoto.']),
      localized(['Miyama · A slower rhythm', 'Discover the countryside around Miyama and its traditional houses.'], ['美山・のどかな時間', '美山の里山風景と昔ながらの家並みを楽しみましょう。'], ['Miyama · Un autre rythme', 'Découvrez la campagne de Miyama et ses maisons traditionnelles.']),
      localized(['Kyoto · Riverside wandering', 'Return to Kyoto for a stroll beside the Kamo River.'], ['京都・川辺の散歩', '京都に戻り、鴨川沿いをゆっくり歩きましょう。'], ['Kyoto · Au fil de l’eau', 'Retrouvez Kyoto pour une promenade le long de la rivière Kamo.']),
    ]
  },
  {
    id: 'alpine', category: 'mountains', days: 4, image: 'mountains',
    title: localized('The Alpine escape', 'アルプスの休日', 'L’échappée alpine'),
    region: localized('Dolomites, Italy', 'イタリア・ドロミテ', 'Dolomites, Italie'),
    description: localized('Big peaks, small villages, and mountain air. A flexible journey through the Dolomites, with time to stop and look up.', '雄大な峰、小さな村、澄んだ山の空気。ドロミテを巡り、立ち止まって景色を見上げる旅へ。', 'De grands sommets, de petits villages et l’air des montagnes. Traversez les Dolomites en prenant le temps de lever les yeux.'),
    stops: [
      localized(['Bolzano · Find your bearings', 'Enjoy the old town and a relaxed first evening in the mountains.'], ['ボルツァーノ・旅の準備', '旧市街を歩き、山の旅の最初の夜をゆったり過ごしましょう。'], ['Bolzano · Prenez vos repères', 'Profitez de la vieille ville et d’une première soirée tranquille.']),
      localized(['Val Gardena · Valley views', 'Choose a valley walk suited to the season and your experience.'], ['ヴァル・ガルデーナ・谷の風景', '季節と経験に合った散歩道で、谷の景色を楽しみましょう。'], ['Val Gardena · Vues sur la vallée', 'Choisissez une promenade adaptée à la saison et à votre expérience.']),
      localized(['Cortina · Among the peaks', 'Explore Cortina and a nearby viewpoint if the roads are open.'], ['コルティナ・山々に囲まれて', '道路状況を確認して、街や近くの展望スポットを訪れましょう。'], ['Cortina · Au cœur des sommets', 'Explorez Cortina et un point de vue proche si les routes sont ouvertes.']),
      localized(['Bolzano · One last mountain morning', 'Return towards Bolzano with a favorite scenic stop along the way.'], ['ボルツァーノ・最後の山の朝', 'お気に入りの景色に寄り道しながら、ボルツァーノ方面へ戻りましょう。'], ['Bolzano · Une dernière matinée alpine', 'Revenez vers Bolzano en faisant une dernière halte panoramique.']),
    ]
  },
  {
    id: 'pacific', category: 'coast', days: 5, image: 'coast',
    title: localized('Pacific coast, slow and easy', 'ゆっくり走る太平洋沿岸', 'La côte Pacifique, tout doucement'),
    region: localized('California, USA', 'アメリカ・カリフォルニア', 'Californie, États-Unis'),
    description: localized('Salt in the air and nowhere to rush. A California coast inspiration route for long lunches and ocean-side pauses.', '潮風を感じながら、急がずに。海を眺める休憩と、ゆっくりしたランチを楽しむカリフォルニアの旅。', 'L’air salé et aucune raison de se presser. Une escapade californienne entre longs déjeuners et pauses face à l’océan.'),
    stops: [
      localized(['San Francisco · Meet the ocean', 'Start with a waterfront walk and a leisurely evening.'], ['サンフランシスコ・海との出会い', '水辺の散歩から始め、のんびりと夕方を過ごしましょう。'], ['San Francisco · Face à l’océan', 'Commencez par une promenade au bord de l’eau et une soirée paisible.']),
      localized(['Monterey · By the bay', 'Explore the harbor and make time for the ocean views.'], ['モントレー・湾のほとり', '港を散策し、海を眺める時間を楽しみましょう。'], ['Monterey · Au bord de la baie', 'Explorez le port et prenez le temps d’admirer l’océan.']),
      localized(['Big Sur · The scenic stretch', 'Visit accessible coastal viewpoints. Check Highway 1 closures before choosing your route.'], ['ビッグサー・絶景の海岸線', 'アクセスできる展望スポットへ。ルートを決める前に国道1号線の通行状況をご確認ください。'], ['Big Sur · La route panoramique', 'Visitez les points de vue accessibles. Vérifiez les fermetures de la Highway 1 avant de partir.']),
      localized(['Cambria · Small-town afternoon', 'Enjoy a village stop and a slow coastal afternoon.'], ['カンブリア・小さな街の午後', '街に立ち寄り、海辺の午後をゆったり過ごしましょう。'], ['Cambria · Un après-midi au village', 'Profitez d’une halte au village et d’un après-midi côtier.']),
      localized(['Santa Barbara · A final sea breeze', 'Finish with a waterfront breakfast and a little time to wander.'], ['サンタバーバラ・最後の潮風', '海辺の朝食と、気ままな散歩で旅を締めくくりましょう。'], ['Santa Barbara · Une dernière brise', 'Terminez par un petit-déjeuner face à l’eau et une dernière balade.']),
    ]
  },
  {
    id: 'provence', category: 'countryside', days: 4, image: 'village',
    title: localized('A little Provençal daydream', 'プロヴァンスで過ごす夢の休日', 'Une rêverie en Provence'),
    region: localized('Provence, France', 'フランス・プロヴァンス', 'Provence, France'),
    description: localized('Warm stone villages, winding lanes, and market mornings. Follow the unhurried rhythm of southern France.', '石造りの村、曲がりくねった小道、朝の市場。南フランスのゆったりしたリズムを感じましょう。', 'Des villages de pierre, des petites routes et des matins au marché. Suivez le rythme tranquille du Sud.'),
    stops: [
      localized(['Avignon · Settle into the south', 'Explore the old streets and enjoy a relaxed evening meal.'], ['アヴィニョン・南仏のはじまり', '古い街並みを歩き、ゆっくりと夕食を楽しみましょう。'], ['Avignon · Prenez le rythme du Sud', 'Explorez les vieilles rues et savourez un dîner tranquille.']),
      localized(['Gordes · Village views', 'Explore the village on foot and pause for views of the countryside.'], ['ゴルド・村の風景', '村を歩き、田園風景を眺めながらひと休みしましょう。'], ['Gordes · Le village en panorama', 'Visitez le village à pied et admirez les paysages alentour.']),
      localized(['Roussillon · A little color', 'Discover ochre-colored streets and local crafts.'], ['ルシヨン・彩りの街', '黄土色の街並みと、地元の工芸品を見つけましょう。'], ['Roussillon · Une touche de couleur', 'Découvrez les rues ocre et l’artisanat local.']),
      localized(['L’Isle-sur-la-Sorgue · Beside the water', 'Enjoy riverside wandering before returning towards Avignon.'], ['リル・シュル・ラ・ソルグ・水辺の時間', '川沿いの散策を楽しんでから、アヴィニョン方面へ戻りましょう。'], ['L’Isle-sur-la-Sorgue · Au bord de l’eau', 'Flânez au bord des canaux avant de revenir vers Avignon.']),
    ]
  },
];
export const images = {
  japan: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1000&q=85&v=20260914.2',
  mountains: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85&v=20260914.2',
  coast: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1000&q=85&v=20260914.2',
  village: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=85&v=20260914.2',
};
export const getRoute = id => routes.find(route => route.id === id);
export function createPlan(input) {
  const { routeId, pace = 'balanced', interests = [] } = input;
  const days = Number(input.days), travelers = Number(input.travelers);
  if (!getRoute(routeId) || !Number.isInteger(days) || days < 2 || days > 7 || !Number.isInteger(travelers) || travelers < 1 || travelers > 8 || !['relaxed', 'balanced', 'active'].includes(pace) || !Array.isArray(interests)) throw new Error('invalidPlan');
  return { id: globalThis.crypto?.randomUUID?.() || `plan-${Date.now()}-${Math.random().toString(36).slice(2)}`, routeId, days, travelers, pace, interests: [...new Set(interests.filter(x => ['nature', 'food', 'culture'].includes(x)))], createdAt: new Date().toISOString() };
}
export function validPlan(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 100 || !Number.isInteger(value.days) || !Number.isInteger(value.travelers) || !['relaxed', 'balanced', 'active'].includes(value.pace) || !Array.isArray(value.interests) || !value.interests.every(interest => ['nature', 'food', 'culture'].includes(interest))) return false;
  try { createPlan(value); return true; } catch { return false; }
}
export function planDays(plan, language) {
  const lang = resolveLocale(language);
  const route = getRoute(plan.routeId);
  if (!route) return [];
  return Array.from({ length: plan.days }, (_, index) => {
    // Longer trips spend more time in each area; the journey never loops back to its start.
    const stopIndex = Math.floor(index * (route.stops.length - 1) / Math.max(1, plan.days - 1));
    const [title, description] = route.stops[stopIndex][lang];
    const interest = plan.interests.length ? translate(lang, `${plan.interests[index % plan.interests.length]}Note`) : '';
    return { title, description: [description, translate(lang, `${plan.pace}Note`), interest].filter(Boolean).join(' ') };
  });
}
