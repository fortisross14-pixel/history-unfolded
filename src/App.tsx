import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpen, ChevronRight, Crown, Globe2, Landmark, Map as MapIcon, Pause, Play, RotateCcw, Shield, Sparkles, Swords, TrendingUp, Users } from 'lucide-react';
import { advanceWorld, createWorld, displayYear, eraName, rankWeight } from './engine';
import type { Civilization, EventCategory, HistoryEvent, Province, WorldState } from './types';

const categoryIcon: Record<EventCategory, string> = {
  military:'⚔', economy:'◆', diplomacy:'♜', religion:'✦', culture:'❖', technology:'⚙', society:'●', world:'☄'
};
const terrainFill: Record<Province['terrain'],string>={ocean:'#182a33',plains:'#263d32',forest:'#20372d',desert:'#493e2c',mountain:'#3b3d40',tundra:'#39454a'};

function formatPopulation(n:number){
  if(n>=1_000_000_000)return `${(n/1_000_000_000).toFixed(1)}B`;
  if(n>=1_000_000)return `${(n/1_000_000).toFixed(1)}M`;
  if(n>=1_000)return `${(n/1_000).toFixed(1)}K`;
  return n.toString();
}
function score(c:Civilization){return rankWeight(c.rank)*1_000_000+c.prestige*10000+c.population+c.provinces.length*5000;}

export default function App(){
  const [world,setWorld]=useState<WorldState>(()=>createWorld());
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [tab,setTab]=useState<'world'|'chronicle'|'almanac'>('world');
  const [overlay,setOverlay]=useState<'political'|'population'|'technology'>('political');
  const [auto,setAuto]=useState(false);
  const selected=world.civilizations.find(c=>c.id===selectedId)??null;
  const living=useMemo(()=>world.civilizations.filter(c=>c.provinces.length>0).sort((a,b)=>score(b)-score(a)),[world]);
  const topEvents=world.events.slice(0,12);
  const advance=(years:number)=>{setWorld(w=>advanceWorld(w,years));setAuto(false)};
  useEffect(()=>{if(!auto)return;const timer=window.setInterval(()=>setWorld(w=>advanceWorld(w,1)),650);return()=>window.clearInterval(timer)},[auto]);
  const restart=()=>{setWorld(createWorld(Date.now()));setSelectedId(null)};

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><Landmark size={24}/><div><strong>HISTORY UNFOLDED</strong><span>A living world chronicle</span></div></div>
      <nav>
        <button className={tab==='world'?'active':''} onClick={()=>setTab('world')}><Globe2 size={16}/> World</button>
        <button className={tab==='chronicle'?'active':''} onClick={()=>setTab('chronicle')}><BookOpen size={16}/> Chronicle</button>
        <button className={tab==='almanac'?'active':''} onClick={()=>setTab('almanac')}><Crown size={16}/> Almanac</button>
      </nav>
      <button className="ghost" onClick={restart}><RotateCcw size={16}/> New world</button>
    </header>

    <section className="timebar">
      <div className="date-block"><span>{eraName(world.year)}</span><strong>{displayYear(world.year)}</strong></div>
      <div className="time-controls">
        <button className="play" onClick={()=>setAuto(!auto)}>{auto?<Pause size={17}/>:<Play size={17}/>}</button>
        {[1,5,10,25].map(y=><button key={y} onClick={()=>advance(y)}>+{y} year{y>1?'s':''}</button>)}
      </div>
      <div className="world-stats">
        <span><Users size={15}/>{formatPopulation(living.reduce((s,c)=>s+c.population,0))}</span>
        <span><Crown size={15}/>{living.filter(c=>c.rank==='Kingdom'||c.rank==='Empire').length} great powers</span>
        <span><Sparkles size={15}/>{world.religions.length} faiths</span>
      </div>
    </section>

    {tab==='world'&&<main className="dashboard">
      <section className="map-card panel">
        <div className="panel-head">
          <div><span className="eyebrow">THE KNOWN WORLD</span><h2>Political landscape</h2></div>
          <div className="segmented">{(['political','population','technology'] as const).map(x=><button className={overlay===x?'active':''} onClick={()=>setOverlay(x)} key={x}>{x}</button>)}</div>
        </div>
        <WorldMap world={world} overlay={overlay} selectedId={selectedId} onSelect={setSelectedId}/>
        <div className="map-footer"><span><MapIcon size={14}/> {world.provinces.filter(p=>p.terrain!=='ocean').length} land provinces</span><span>Click any realm to open its history</span></div>
      </section>

      <section className="ranking panel">
        <div className="panel-head"><div><span className="eyebrow">WORLD ORDER</span><h2>Great powers</h2></div><TrendingUp size={19}/></div>
        <div className="ranking-list">{living.slice(0,12).map((c,i)=><button key={c.id} className={selectedId===c.id?'selected':''} onClick={()=>setSelectedId(c.id)}>
          <span className="rank-number">{i+1}</span><span className="swatch" style={{background:c.color}}/><span className="realm"><strong>{c.name}</strong><small>{c.rank} · {c.provinces.length} provinces</small></span><span className="prestige">{Math.round(c.prestige)}</span><ChevronRight size={15}/>
        </button>)}</div>
      </section>

      <section className="news panel">
        <div className="panel-head"><div><span className="eyebrow">LATEST HISTORY</span><h2>The world chronicle</h2></div><BookOpen size={19}/></div>
        <div className="event-feed">{topEvents.length?topEvents.map(e=><EventCard key={e.id} event={e} onSelect={id=>setSelectedId(id)}/>):<div className="empty"><Sparkles/><strong>The world is waiting</strong><p>Advance time to watch tribes grow, faiths emerge and rivalries become wars.</p></div>}</div>
      </section>
    </main>}

    {tab==='chronicle'&&<Chronicle world={world} onSelect={setSelectedId}/>} 
    {tab==='almanac'&&<Almanac world={world} onSelect={setSelectedId}/>} 
    {selected&&<CountryDrawer civ={selected} world={world} onClose={()=>setSelectedId(null)}/>} 
  </div>
}

function WorldMap({world,overlay,selectedId,onSelect}:{world:WorldState;overlay:string;selectedId:number|null;onSelect:(id:number)=>void}){
  const size=26, h=22.5;
  const width=22*size+size/2, height=13*h+10;
  const points=(cx:number,cy:number)=>Array.from({length:6},(_,i)=>{const a=Math.PI/180*(60*i);return `${cx+size*.56*Math.cos(a)},${cy+size*.56*Math.sin(a)}`}).join(' ');
  return <svg className="world-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Procedural political map">
    {world.provinces.map(p=>{
      const cx=p.x*size+(p.y%2?size/2:0)+15, cy=p.y*h+15;
      const owner=p.ownerId!==null?world.civilizations.find(c=>c.id===p.ownerId):null;
      let fill=terrainFill[p.terrain];
      if(owner){
        if(overlay==='political')fill=owner.color;
        if(overlay==='population'){const v=Math.min(1,owner.population/500000);fill=`rgba(217,164,86,${.2+v*.8})`}
        if(overlay==='technology'){const v=owner.technology/100;fill=`rgba(91,168,184,${.25+v*.75})`}
      }
      return <polygon key={p.id} points={points(cx,cy)} fill={fill} className={`${p.terrain} ${selectedId===owner?.id?'highlight':''}`} onClick={()=>owner&&onSelect(owner.id)} />
    })}
    {world.civilizations.filter(c=>c.provinces.length>0).map(c=>{const cap=world.provinces[c.provinces[0]];if(!cap)return null;const cx=cap.x*size+(cap.y%2?size/2:0)+15,cy=cap.y*h+15;return <g key={c.id} className="capital" onClick={()=>onSelect(c.id)}><circle cx={cx} cy={cy} r="3.6"/><text x={cx+5} y={cy-4}>{c.rank==='Empire'||c.rank==='Kingdom'?c.name:''}</text></g>})}
  </svg>
}

function EventCard({event,onSelect}:{event:HistoryEvent;onSelect:(id:number)=>void}){
  return <article className={`event-card ${event.importance>=8?'major':''}`}>
    <div className="event-symbol">{categoryIcon[event.category]}</div>
    <div><div className="event-meta"><span>{displayYear(event.year)}</span><span>{event.category}</span>{event.importance>=8&&<b>Major event</b>}</div><h3>{event.title}</h3><p>{event.description}</p>{event.civIds.length>0&&<button onClick={()=>onSelect(event.civIds[0])}>Explore realm <ChevronRight size={13}/></button>}</div>
  </article>
}

function Chronicle({world,onSelect}:{world:WorldState;onSelect:(id:number)=>void}){
  const groups=useMemo(()=>{
    const map=new Map<number,HistoryEvent[]>();world.events.forEach(e=>{const decade=Math.floor(e.year/10)*10;map.set(decade,[...(map.get(decade)||[]),e])});return [...map.entries()].sort((a,b)=>b[0]-a[0]);
  },[world.events]);
  return <main className="page"><div className="page-title"><span className="eyebrow">HISTORICAL RECORD</span><h1>Chronicle of the world</h1><p>Every rise, collapse, discovery and catastrophe preserved in one continuous history.</p></div>
    {groups.length?groups.map(([decade,events])=><section className="decade" key={decade}><div className="decade-year">{displayYear(decade)}s</div><div>{events.map(e=><EventCard key={e.id} event={e} onSelect={onSelect}/>)}</div></section>):<div className="empty wide"><BookOpen/><strong>No history has yet been written</strong><p>Return to the world and advance time.</p></div>}
  </main>
}

function Almanac({world,onSelect}:{world:WorldState;onSelect:(id:number)=>void}){
  const living=[...world.civilizations].filter(c=>c.provinces.length).sort((a,b)=>score(b)-score(a));
  const faiths=[...world.religions].sort((a,b)=>b.followers-a.followers);
  return <main className="page"><div className="page-title"><span className="eyebrow">THE GREAT ARCHIVE</span><h1>World almanac</h1><p>Compare the peoples, powers and faiths that have shaped this world.</p></div>
    <div className="almanac-grid"><section className="panel archive"><div className="panel-head"><h2>Realms</h2><Crown/></div>{living.map((c,i)=><button onClick={()=>onSelect(c.id)} key={c.id}><span>{i+1}</span><i style={{background:c.color}}/><div><strong>{c.name}</strong><small>{c.rank} · founded {displayYear(c.founded)}</small></div><b>{formatPopulation(c.population)}</b></button>)}</section>
    <section className="panel archive"><div className="panel-head"><h2>Religions</h2><Sparkles/></div>{faiths.length?faiths.map((r,i)=><div className="archive-row" key={r.id}><span>{i+1}</span><i style={{background:r.color}}/><div><strong>{r.name}</strong><small>Founded by {r.founder} in {displayYear(r.founded)}</small></div><b>{formatPopulation(r.followers)}</b></div>):<div className="empty"><Sparkles/><strong>No organized faiths</strong><p>Prophets may emerge as centuries pass.</p></div>}</section></div>
  </main>
}

function CountryDrawer({civ,world,onClose}:{civ:Civilization;world:WorldState;onClose:()=>void}){
  const faith=world.religions.find(r=>r.id===civ.faithId);
  const events=civ.history.map(id=>world.events.find(e=>e.id===id)).filter(Boolean) as HistoryEvent[];
  return <aside className="drawer"><button className="drawer-close" onClick={onClose}>×</button><div className="country-hero" style={{background:`linear-gradient(145deg,${civ.color}55,transparent)`}}><span className="country-badge" style={{background:civ.color}}><Crown/></span><p>{civ.rank.toUpperCase()}</p><h1>{civ.name}</h1><span>The {civ.adjective} realm · Founded {displayYear(civ.founded)}</span></div>
    <div className="ruler-card"><div className="portrait">{civ.ruler.name.charAt(0)}</div><div><small>CURRENT RULER</small><strong>{civ.ruler.name}</strong><span>{civ.ruler.trait} {civ.ruler.role}</span></div></div>
    <div className="metric-grid"><Metric icon={<Users/>} label="Population" value={formatPopulation(civ.population)}/><Metric icon={<MapIcon/>} label="Territory" value={`${civ.provinces.length} provinces`}/><Metric icon={<Shield/>} label="Military" value={Math.round(civ.military).toString()}/><Metric icon={<TrendingUp/>} label="Economy" value={Math.round(civ.economy).toString()}/></div>
    <section className="facts"><h3>Realm profile</h3><dl><dt>Capital</dt><dd>{civ.capital}</dd><dt>Origin tribe</dt><dd>{civ.originTribe}</dd><dt>Culture</dt><dd>{civ.culture}</dd><dt>Religion</dt><dd>{faith?.name??'Local traditions'}</dd><dt>Technology</dt><dd>{Math.round(civ.technology)}/100</dd><dt>Stability</dt><dd>{Math.round(civ.stability)}/100</dd><dt>Prestige</dt><dd>{Math.round(civ.prestige)}/100</dd><dt>Wars</dt><dd>{civ.warsWon} won · {civ.warsLost} lost</dd><dt>Historic peak</dt><dd>{civ.peakProvinces||civ.provinces.length} provinces · {formatPopulation(civ.peakPopulation)}</dd></dl></section>
    <section className="country-history"><h3>Names through history</h3>{civ.nameHistory.slice().reverse().map((era,i)=><div key={`${era.name}-${era.from}-${i}`}><span>{displayYear(era.from)}</span><p><strong>{era.name}</strong>{era.rank} · {era.reason}</p></div>)}{civ.absorbedCultures.length>0&&<p className="muted">Peoples absorbed into this civilization: {civ.absorbedCultures.join(', ')}.</p>}</section><section className="country-history"><h3>Historical record</h3>{events.length?events.slice(0,8).map(e=><div key={e.id}><span>{displayYear(e.year)}</span><p><strong>{e.title}</strong>{e.description}</p></div>):<p className="muted">This young realm has not yet left a major mark on history.</p>}</section>
  </aside>
}
function Metric({icon,label,value}:{icon:ReactNode;label:string;value:string}){return <div className="metric">{icon}<small>{label}</small><strong>{value}</strong></div>}
