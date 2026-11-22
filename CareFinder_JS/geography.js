/* Offline overview. The two transparent-to-input Leaflet layers move and zoom with
   map tiles. Streets and the user's own markers occupy higher panes. No network calls. */
(() => {
  "use strict";
  const PRECISION = 10000;
  const TILE = 256;
  const BINS = 32;
  const LABEL_CELL = 64;
  const palette = {
    sea: "#c9e2ef", land: "#f6f5ef", outside: "#edf0ed",
    states: ["#f5f4ec", "#f6f4ec", "#f5f4ee"], border: "#b1bbc4",
    urban: "#e2e6e5", river: "#9dc7df", lake: "#c1dce9",
    road: ["#e8bb7f", "#e7c799", "#d9cdb6", "#dcd5c8"]
  };
  const lonX = lon => (lon + 180) / 360;
  function latY(lat) {
    const a = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180);
    return .5 - Math.log((1 + a) / (1 - a)) / (4 * Math.PI);
  }
  function readPaths(encoded) {
    return encoded.map(s => {
      let i = 0, x = 0, y = 0;
      const data = [];
      function delta() {
        let n=0, shift=0, b;
        do { b=s.charCodeAt(i++)-63; n|=(b&31)<<shift; shift+=5; } while(b>=32);
        return n&1 ? ~(n>>>1) : (n>>>1);
      }
      while (i < s.length) {
        x += delta(); y += delta();
        data.push(lonX(x / PRECISION), latY(y / PRECISION));
      }
      return new Float64Array(data);
    });
  }
  // Keep large world polygons and small regional features in the same spatial index.
  function indexGeometry(records) {
    const index = new Map();
    for (const [rank, x0, y0, x1, y1, ...shapes] of records) {
      const item = { rank, shapes, points:null, x0:lonX(x0/PRECISION), x1:lonX(x1/PRECISION),
                     y0:latY(y1/PRECISION), y1:latY(y0/PRECISION) };
      for (let j=Math.floor(item.y0*BINS); j<=Math.floor(item.y1*BINS); j++) {
        for (let i=Math.floor(item.x0*BINS); i<=Math.floor(item.x1*BINS); i++) {
          const id=j*BINS+i;
          if (!index.has(id)) index.set(id,[]);
          index.get(id).push(item);
        }
      }
    }
    return index;
  }
  function visible(index, extent, maxRank=Infinity) {
    const {x0,x1,y0,y1} = extent, found = new Set();
    for (let j=Math.floor(y0*BINS); j<=Math.floor(y1*BINS); j++) {
      for(let i=Math.floor(x0*BINS); i<=Math.floor(x1*BINS); i++) {
        const bucket=index.get(j*BINS+i);
        if (!bucket) continue;
        for(const p of bucket) if(p.rank<=maxRank && p.x0<=x1 && p.x1>=x0 && p.y0<=y1 && p.y1>=y0) found.add(p);
      }
    }
    return found;
  }
  function canvasTile() {
    const canvas=document.createElement("canvas");
    const density=Math.min(2,window.devicePixelRatio||1);
    canvas.width=canvas.height=TILE*density;
    canvas.style.width=canvas.style.height=TILE+"px";
    canvas.setAttribute("aria-hidden","true");
    const c=canvas.getContext("2d"); c.scale(density,density);
    return [canvas,c];
  }
  function appendGeometry(c, item, transform, polygon) {
    if (!item.points) item.points=readPaths(item.shapes);
    const {scale,ox,oy}=transform;
    for(const p of item.points) {
      if(p.length<4) continue;
      let lx=p[0]*scale-ox,ly=p[1]*scale-oy;
      c.moveTo(lx,ly);
      for(let i=2;i<p.length;i+=2) {
        const x=p[i]*scale-ox, y=p[i+1]*scale-oy;
        if(i<p.length-2 && Math.abs(x-lx)+Math.abs(y-ly)<.85) continue;
        c.lineTo(x,y); lx=x;ly=y;
      }
      if(polygon)c.closePath();
    }
  }
  function paintAreas(c, data, t, fill, border, width=.65) {
    for(const item of data) {
      c.beginPath();appendGeometry(c,item,t,true);
      c.fillStyle=typeof fill==="function"?fill(item):fill;
      c.fill("evenodd");
      if(border){c.strokeStyle=border;c.lineWidth=width;c.stroke();}
    }
  }
  function paintLines(c, data, t, color, width) {
    c.beginPath(); for(const feature of data)appendGeometry(c,feature,t,false);
    c.lineJoin=c.lineCap="round";c.strokeStyle=color;c.lineWidth=width;c.stroke();
  }
  function makeGround(raw) {
    const sets={};
    for (const k of ["land","states","urban","rivers","lakes","roads"]) sets[k]=indexGeometry(raw[k]);
    return L.GridLayer.extend({
      createTile(coords) {
        const [tile,c]=canvasTile(), z=coords.z;
        const scale=TILE*2**z, ox=TILE*coords.x,oy=TILE*coords.y;
        const t={scale,ox,oy};
        const area={x0:(ox-3)/scale,x1:(ox+TILE+3)/scale,y0:(oy-3)/scale,y1:(oy+TILE+3)/scale};
        c.fillStyle=palette.sea;c.fillRect(0,0,TILE,TILE);
        paintAreas(c,visible(sets.land,area),t,palette.land);
        paintAreas(c,visible(sets.states,area),t,p=>p.rank===3?palette.outside:palette.states[p.rank],
                   z>=4?palette.border:null,z>=7?.9:.65);
        if(z>=7)paintAreas(c,visible(sets.urban,area,z<8?7:20),t,palette.urban);
        if(z>=4)paintLines(c,visible(sets.rivers,area,z<5?3:z<7?5:12),t,palette.river,z<7?.8:z<10?1.35:1.8);
        paintAreas(c,visible(sets.lakes,area,z<5?5:12),t,palette.lake);
        // Generalized reference roads are deliberately subdued at street scale.
        if(z>=5) {
          const max=z<6?0:z<7?1:z<8?2:3;
          const split=[[],[],[],[]];
          for(const p of visible(sets.roads,area,max))split[p.rank].push(p);
          const widths=z<7?[1,.8,.7,.6]:z<10?[1.75,1.35,1.05,.85]:[1.55,1.4,1.1,.9];
          c.globalAlpha=z>=13?.48:1;
          for(let i=max;i>=0;i--) {
            if(!split[i].length)continue;
            if(z>=7)paintLines(c,split[i],t,"#fffdf8",widths[i]+1.1);
            paintLines(c,split[i],t,palette.road[i],widths[i]);
          }
          c.globalAlpha=1;
        }
        return tile;
      }
    });
  }

  function paintLabel(c,p,ox,oy) {
    const x=p.tx-ox,y=p.ty-oy;
    if(p.dot) {
      c.beginPath();c.arc(p.px-ox,p.py-oy,p.dot,0,2*Math.PI);
      c.fillStyle="#fbfcf9";c.fill();c.strokeStyle="#6b7f88";c.lineWidth=1;c.stroke();
    }
    c.font=p.font;c.fillStyle=p.color;c.lineWidth=p.halo;c.strokeStyle="#f9faf5";
    c.lineJoin="round";c.textAlign="left";c.textBaseline="middle";
    c.strokeText(p.name,x,y);c.fillText(p.name,x,y);
  }
  function makeLabels(raw,places) {
    const cache=new Map(), scratch=document.createElement("canvas").getContext("2d");
    const cityData=places.map(p=>({
      name:p.city, x:lonX(p.longitude), y:latY(p.latitude), pop:p.population||0, rank:p.mapRank||0
    }));
    const references=(rows,kind)=>rows.map(([name,lon,lat,index])=>({name,x:lonX(lon),y:latY(lat),index,kind}));
    const states=references(raw.stateLabels,"state"),countries=references(raw.countryLabels,"country"),seas=references(raw.seaLabels,"sea");
    function fontData(kind,large,z) {
      if(kind==="sea")return {font:"italic 12px Arial, sans-serif",size:12,color:"#456f89",halo:2};
      if(kind==="country")return {font:"600 14px Arial, sans-serif",size:14,color:"#596873",halo:3};
      if(kind==="state")return {font:"600 10.5px Arial, sans-serif",size:10.5,color:"#788292",halo:3};
      const size=large?(z>=8?15:12):z>=10?12:11;
      return {font:(large?"600 ":"500 ")+size+"px Arial, sans-serif",size,color:large?"#273e55":"#495c6b",halo:3};
    }
    function atZoom(z) {
      if(cache.has(z))return cache.get(z);
      const scale=TILE*2**z, occupied=new Map(), index=new Map(), priorities=[];
      for(const p of countries)if(z<=6)priorities.push({...p,priority:(p.name==="India"?150:119)-p.index});
      for(const p of seas)if(z<=8 && (z>=5||!p.index))priorities.push({...p,priority:100});
      for(const p of states)if(z>=5 && z<=9)priorities.push({...p,priority:93-p.index});
      const floor=z<4?5e6:z<5?1.6e6:z<6?8e5:z<7?2.5e5:z<8?9e4:z<9?3e4:z<10?8000:0;
      for(const p of cityData) {
        if(p.pop<floor && !(p.rank===3&&z>=3) && !(p.rank===2&&z>=6))continue;
        const priority=20+Math.log10(p.pop+1)*8+(p.rank===3?32:p.rank===2?10:0);
        priorities.push({...p,kind:"city",priority});
      }
      priorities.sort((a,b)=>b.priority-a.priority||a.name.localeCompare(b.name));
      const bucketKey=(x,y)=>x+","+y;
      function eachCell(rect,bw,fn) {
        for(let y=Math.floor(rect.y0/bw);y<=Math.floor(rect.y1/bw);y++)
          for(let x=Math.floor(rect.x0/bw);x<=Math.floor(rect.x1/bw);x++)fn(bucketKey(x,y));
      }
      for(const item of priorities) {
        const kind=item.kind, dot=kind==="city"?(item.pop>8e5||item.rank>=2?2.4:1.55):0;
        const px=item.x*scale,py=item.y*scale;
        const props=fontData(kind,kind==="city"&&(item.rank>=2||item.pop>8e5),z);
        const name=kind==="state"||kind==="country"?item.name.toUpperCase():item.name;
        scratch.font=props.font; const width=scratch.measureText(name).width;
        const tx=dot?px+(z>=10?9:5):px-width/2,ty=dot?py-2:py;
        const pad=kind==="city"&&z<8?7:3;
        const rect={x0:Math.min(tx,px-dot)-pad,y0:ty-props.size/2-3,x1:tx+width+pad,y1:ty+props.size/2+3};
        let collides=false;
        eachCell(rect,LABEL_CELL,key=>{
          if(collides)return;
          const bucket=occupied.get(key);
          if(bucket)collides=bucket.some(a=>a.x0<rect.x1&&a.x1>rect.x0&&a.y0<rect.y1&&a.y1>rect.y0);
        });
        if(collides)continue;
        const add=(dict,key,item)=>{if(!dict.has(key))dict.set(key,[]);dict.get(key).push(item);};
        eachCell(rect,LABEL_CELL,k=>add(occupied,k,rect));
        const label={...props,name,px,py,tx,ty,dot};
        eachCell(rect,TILE,k=>add(index,k,label));
      }
      if(cache.size>=3)cache.delete(cache.keys().next().value);
      cache.set(z,index);return index;
    }
    return L.GridLayer.extend({
      createTile(coords) {
        const [tile,c]=canvasTile();
        const labels=atZoom(coords.z).get(coords.x+","+coords.y)||[];
        for(const p of labels)paintLabel(c,p,coords.x*TILE,coords.y*TILE);
        return tile;
      }
    });
  }
  window.CareGeography = {
    addTo(map) {
      for(const [id,z] of [["careGeography",170],["carePlaces",248]]) {
        const pane=map.getPane(id)||map.createPane(id);
        pane.style.zIndex=z;pane.style.pointerEvents="none";
      }
      const options={tileSize:TILE,noWrap:true,keepBuffer:1,updateWhenIdle:false};
      const Ground=makeGround(window.CARE_GEO_DATA),Labels=makeLabels(window.CARE_GEO_DATA,window.CARE_PLACES);
      const ground=new Ground({...options,pane:"careGeography",
        attribution:'<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> · <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>'}).addTo(map);
      const labels=new Labels({...options,pane:"carePlaces"}).addTo(map);
      return {ground,labels};
    }
  };
})();
