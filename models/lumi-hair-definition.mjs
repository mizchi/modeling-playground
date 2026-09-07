/** Swept fringe guides in BASE-45 world coordinates (+Z forward).
 * Each row is [x, y, z, relative half-width]. Roots share an offset parting;
 * unequal widths, curved guides and staggered tips avoid a repeated comb rim. */
export function lumiForeheadZ(x,y) {
  // Hair volume is independent of the skull: a convex frontal envelope.
  const section=1-(x/.315)**2-((y-2.04)/.275)**2;
  return section>=0?-.01+.31*Math.sqrt(section):undefined;
}

export const LUMI_FRINGE = [
  { width: .065, rows: [
    [-.060,2.301,.075,.20],[-.080,2.265,.195,.75],[-.067,2.150,.283,1],
    [-.025,2.040,.254,.70],[.034,1.947,.209,.025],
  ] },
  { width: .054, rows: [
    [-.075,2.298,.060,.20],[-.152,2.255,.185,.80],[-.176,2.125,.266,1],
    [-.166,2.005,.226,.65],[-.129,1.940,.190,.025],
  ] },
  { width: .052, rows: [
    [-.095,2.294,.044,.20],[-.217,2.222,.168,.90],[-.249,2.083,.219,1],
    [-.221,1.965,.204,.55],[-.182,1.884,.181,.025],
  ] },
  { width: .070, rows: [
    [-.035,2.301,.065,.20],[.073,2.273,.187,.85],[.147,2.158,.268,1],
    [.166,2.060,.238,.60],[.112,1.989,.211,.025],
  ] },
  { width: .058, rows: [
    [-.004,2.303,.041,.20],[.171,2.251,.149,.90],[.247,2.124,.216,1],
    [.235,1.995,.215,.60],[.190,1.914,.184,.025],
  ] },
  // Secondary locks cross the exposed straight cap edge. Their tips stop
  // above the eyes; a small lift keeps overlaps separate from the main layer.
  { width: .044, depth: .018, lift: .034, rows: [
    [-.090,2.292,.060,.15],[-.125,2.230,.220,.70],[-.115,2.120,.265,1],
    [-.075,2.050,.275,.75],[-.047,1.992,.220,.025],
  ] },
  { width: .045, depth: .018, lift: .034, rows: [
    [-.020,2.295,.060,.15],[.025,2.240,.200,.60],[.065,2.150,.285,1],
    [.075,2.055,.278,.85],[.058,1.987,.228,.025],
  ] },
];
