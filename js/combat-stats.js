// Ataque bruto, no daño por impacto. Fuentes y alcance en docs/DATA_SOURCES.md.
const chaotic = {great_sword:[123,-45,20],long_sword:[114,-30,10],sword_and_shield:[113,-25,10],dual_blades:[112,-25,15],hammer:[117,-40,20],hunting_horn:[100,-35,20],lance:[112,-30,15],gunlance:[101,-40,15],switch_axe:[98,-30,15],charge_blade:[72,-35,10],insect_glaive:[72,-25,10],light_bowgun:[97,-20,10],heavy_bowgun:[94,-30,20],bow:[94,-25,15]};
const sign = n => n > 0 ? `+${n}` : `${n}`;
const clamp = a => Math.min(100,Math.max(-100,a));
const elements = new Set(['Fire','Water','Thunder','Ice','Dragon']);
// Efectos compartidos: un mismo efecto nunca se suma dos veces (p. ej. Crueldad + Maza).
const combos = {
  Brutality:{Expert:15,Tenderizer:10}, Edgemaster:{Attack:20}, Readiness:{'Punish Draw':10},
  Amplify:{Elemental:10}, Prudence:{Unscathed:10}, Fury:{Potential:15}, 'D. Fencing':{Survivor:10},
  Redhelm:{Furor:10}, Drilltusk:{Potential:15}, Dreadqueen:{Status:15}, Silverwind:{Expert:20},
  Deadeye:{Spirit:15}, Dreadking:{Attack:20}, Thunderlord:{'Gloves Off':15}, Bloodbath:{Attack:20},
  Soulseer:{Expert:20,Spirit:10}, 'Soulseer X':{Expert:20,Spirit:15}, 'Elderfrost X':{Attack:15,Blunt:10,'Normal Up':10},
  Boltreaver:{'Critical Up':10}, SteadyHand:{'Normal Up':10,'Pierce Up':10,'Pellet Up':10},
  Elderfrost:{Blunt:10,'Normal Up':10}, 'Deadeye X':{Spirit:15,Survivor:10}, 'Hellblade X':{'Bomb Boost':10}, Mechanic:{'Bomb Boost':10},
  'Anti-Kushala':{ColdBlooded:10}, 'Anti-Teostra':{HotBlooded:10}
};
export function combatStats(w, skills) {
  const pts = new Map(skills.map(s => [s.en,s.total]));
  const p = k => pts.get(k) || 0;
  for (const {en,total} of skills) if (total >= 10) {
    for (const [key,v] of Object.entries(combos[en] || combos[en.replace(/ X$/, '')] || {})) pts.set(key, Math.max(p(key),v));
  }
  const atk = p('Attack'), eye = p('Expert');
  const tier = (n,values) => n >= 20 ? values[2] : n >= 15 ? values[1] : n >= 10 ? values[0] : 0;
  const fixedRaw = tier(atk,[10,15,20])-tier(-atk,[5,10,15]);
  const fixedAff = tier(eye,[10,20,30])-tier(-eye,[5,10,15]);
  const raw = w.raw + fixedRaw + (p('Punish Draw') >= 10 ? 5 : 0);
  const conditions = [], fixed = [];
  if (fixedRaw) fixed.push(`Ataque: ${sign(fixedRaw)} de ataque.`);
  if (p('Punish Draw') >= 10) fixed.push('Desenfunde punitivo: +5 de ataque.');
  if (fixedAff) fixed.push(`Ojo crítico: ${sign(fixedAff)} puntos de afinidad.`);
  let bonus = 0;
  const addAff = (n,when) => { bonus += n; conditions.push(`${when}: +${n} puntos de afinidad.`); };
  if (p('Tenderizer') >= 10) addAff(50,'Maza · golpe en zona débil (valor físico ≥45 para ese tipo de ataque)');
  if (p('Chain Crit') >= 10) addAff(30,'Atacante constante · encadenar golpes (+25 tras el primero; máximo tras cinco)');
  if (p('Crit Draw') >= 10) addAff(100,'Desenfunde especial · ataque de desenfunde');
  const spirit = tier(p('Spirit'),[10,15,15]), latent = tier(p('Gloves Off'),[30,50,50]);
  if (spirit) conditions.push(`Espíritu · monstruo grande enfurecido: +${spirit} de afinidad y +${spirit===10?10:20} de ataque.`);
  if (latent) conditions.push(`Poder oculto · al activarse por tiempo en combate o daño recibido: +${latent} de afinidad.`);
  bonus += Math.max(spirit,latent);
  if (spirit && latent) conditions.push('Espíritu y Poder oculto no se suman: se muestra la alternativa de mayor afinidad.');
  const pair = chaotic[w.slug], dual = pair && pair[0] === w.tree;
  if (dual || p('Frenzy Res') >= 10) addAff(p('Frenzy Res') >= 10 ? 30 : 15,'Tras superar el virus de la cólera');
  if (dual) conditions.push(`Arma caótica: al superar el virus, sus ${pair[1]} puntos negativos pasan a positivos.`);
  const aff = (dual ? pair[2] : w.aff) + fixedAff;
  const affinity = dual ? `${pair[1]}% / ${clamp(aff)}%` : `${clamp(aff)}%`;
  const potential = `${clamp(aff+bonus+(dual ? -pair[1] : 0))}%`;
  for (const [key,text] of [['Unscathed','Plena forma · salud completa: +20 de ataque.'],['Furor','Resentimiento · salud roja recuperable: +20 de ataque.'],['Crisis','Resucitar · bajo un estado adverso: +20 de ataque.'],['Survivor','Supervivencia · tras uno/dos desmayos: ataque ×1,10 / ×1,20.'],['Dragon Spirit','Corazón de dragón · salud inferior a dos tercios: ataque ×1,10.'],['ColdBlooded','Zona fría: +15 de ataque; bebida fría: +5.'],['HotBlooded','Zona caliente: +15 de ataque.'],['Blunt','Contundente · con filo verde/amarillo/naranja o rojo: ataque cuerpo a cuerpo ×1,10/1,15/1,20.']]) {
    if (p(key)>=10) conditions.push(text);
  }
  if (p('Potential')>=15 || p('Potential')<=-10) conditions.push(`Adrenalina · salud ≤40%: ataque ×${p('Potential')>=15?'1,30':'0,70'}.`);
  if (p('Critical Up')>=10) conditions.push('Potenciador crítico: un crítico positivo multiplica la parte física por 1,40 en vez de 1,25; no da afinidad.');
  if (p('Vault')>=10) conditions.push('Ataque aéreo: daño físico ×1,10 en ataques de salto.');
  if (w.cls==='G') {
    for (const [key,type,mult] of [['Normal Up','disparo normal / flecha de salva','1,10'],['Pierce Up','perforante','1,10'],['Pellet Up','perdigones / flecha de abanico',w.slug==='bow'?'1,30':'1,20'],['Heavy Up','pesado','1,10']]) {
      if (p(key)>=10) conditions.push(`Solo con proyectil ${type}: daño físico ×${mult}.`);
    }
  }
  const attributes = (w.ele || []).map(([es,en,base]) => {
    let factor=1, add=0;
    if (elements.has(en)) {
      const n=p(en+' Atk'), generic=p('Elemental');
      factor=(generic>=10?1.1:generic<=-10?.9:1)*(n>=15?1.1:n>=10?1.05:n<=-10?.75:1);
      add=n>=15?6:n>=10?4:0;
    } else if (en==='Blast') factor=p('Bomb Boost')>=10?1.2:1;
    else { const n=p('Status'); factor=n>=15?1.2:n>=10?1.1:n<=-10?.9:1; add=n>=10?1:0; }
    const value=Math.floor(base*factor+add+1e-8);
    return `${es} ${value}${value!==base?` (arma: ${base})`:''}`;
  });
  const nativeAffinity = dual ? `${pair[1]}% / +${pair[2]}%` : `${w.aff}%`;
  return {raw, affinity, nativeAffinity, potential, attributes, conditions, fixed};
}
