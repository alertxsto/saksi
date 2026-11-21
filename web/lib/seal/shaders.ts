// GLSL for the Vault Seal. Two passes:
//  1. SCENE: one texel per dot cell. Raymarches a procedural padlock (rounded body with a check-mark
//     keyhole and a torn receipt edge, torus+capsule shackle), 2×2 supersampled, and writes
//     r = lit luminance, g = coverage, b = highlight (specular + rim + step focus), a = cursor trail.
//  2. DOTS: full resolution. Each pixel finds its cell and draws one quantised dot (4 radii,
//     circle or rounded square by hash), coloured body / light body / ice, plus the silhouette fill.

export const VS = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`

export const SCENE_FS = `#version 300 es
precision highp float;
uniform vec2 uCell;      // cell size, grid offset (board uv)
uniform mat3 uRot;       // world -> object
uniform float uLift;     // vertical bob (scene units)
uniform float uTime;
uniform vec3 uFocus;     // step weights: receipt, shackle, check
uniform vec3 uTrail[24]; // x, y (board uv, y up), strength
uniform float uReceipt;
out vec4 o;

const float SPAN=2.8;
const vec3 BB=vec3(.74,.56,.30);
const float BY=-.36,SR=.45,ST=.12,SY=.3;

float box(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.));}
float tick(vec2 q){return min(seg(q,vec2(-.3,.0),vec2(-.08,-.22)),seg(q,vec2(-.08,-.22),vec2(.32,.2)))-.065;}
float holes(vec3 b){vec2 l=vec2((fract(b.x*8.+.5)-.5)/8.,b.y+.4);return max(length(l)-.03,abs(b.x)-.6);}

// barrel-curved faces (front z = .30 at centre, .12 at the sides) so the face shades across
float face(float x){return sqrt(2.595-x*x)-1.311;}
float body(vec3 b){
  float d=max(box(b,BB,.14),(length(vec2(b.x,abs(b.z)+1.311))-1.611)*.9);
  float fz=face(b.x);
  float k=max(tick(b.xy),fz-.09-b.z);
  if(uReceipt>.5){
    d=max(d,-BB.y+.02+.07*abs(fract(b.x*5.)-.5)*2.-b.y);
    k=min(k,max(holes(b),fz-.06-b.z));
  }
  return max(d,-k);
}
float shackle(vec3 p){
  vec3 s=p-vec3(0.,SY,0.);
  return s.y>0.?length(vec2(length(s.xy)-SR,s.z))-ST:length(vec3(abs(s.x)-SR,s.y-clamp(s.y,-.62,0.),s.z))-ST;
}
float map(vec3 p){return min(body(p-vec3(0.,BY,0.)),shackle(p));}
vec3 nrm(vec3 p){vec2 k=vec2(1,-1)*.003;return normalize(k.xyy*map(p+k.xyy)+k.yyx*map(p+k.yyx)+k.yxy*map(p+k.yxy)+k.xxx*map(p+k.xxx));}
float occ(vec3 p,vec3 n){float a=0.,w=1.;for(int i=1;i<5;i++){float h=.04*float(i);a+=w*(h-map(p+n*h));w*=.6;}return clamp(1.-a*2.5,0.,1.);}

// x lum, y highlight, z hit
vec3 shade(vec2 uv){
  vec3 rd=uRot*normalize(vec3((uv-.5)*SPAN,-6.));
  vec3 ro=uRot*(vec3(0.,0.,6.)-vec3(0.,.03+uLift,0.));
  float b=dot(ro,rd),h=b*b-dot(ro,ro)+1.69;
  if(h<0.)return vec3(0);
  h=sqrt(h);
  float t=-b-h,tm=-b+h;
  for(int i=0;i<72;i++){
    vec3 p=ro+rd*t;float d=map(p);
    if(d<.002){
      vec3 n=nrm(p),v=-rd;
      vec3 L=uRot*normalize(vec3(-.65,.55,.55)),R=uRot*normalize(vec3(.85,.3,-.4));
      vec3 q=p-vec3(0.,BY,0.);
      float sh=step(shackle(p),body(q)+.001);
      float fz=face(q.x),kz=(1.-sh)*step(q.z,fz-.008)*step(fz-.1,q.z);
      float ch=kz*step(tick(q.xy),.004);
      float hole=max(ch,kz*uReceipt*step(holes(q),.004));
      float rc=(1.-sh)*step(q.y,-.3);
      float dif=max(dot(n,L),0.),a=occ(p,n);
      float sp=pow(max(dot(n,normalize(L+v)),0.),mix(26.,64.,sh));
      float fr=pow(1.-max(dot(n,v),0.),3.)*smoothstep(-.2,.5,dot(n,R));
      float lum=(.08+.8*dif+.22*(.5+.5*n.y))*a*(1.-.85*hole);
      vec3 rw=reflect(rd,n)*uRot;   // reflection in view space
      float sd=dot(normalize(rw.xz+1e-5),normalize(vec2(-.42,1.)));
      float strip=(smoothstep(.992,.999,sd)+.25*pow(max(sd,0.),40.))*smoothstep(-.7,-.1,rw.y)*smoothstep(.9,.4,rw.y);
      float hi=(sp*mix(1.,1.5,sh)+fr*.9+strip*mix(.9,1.2,sh))*(.35+.65*a);
      hi+=ch*step(fz-.08,q.z)*.75;   // ice rim on the keyhole walls
      float f=dot(uFocus,vec3(rc,sh,ch+hole*.5));
      hi+=f*(.32+.28*sin(uTime*4.-p.y*9.));
      return vec3(lum,hi,1.);
    }
    t+=d*.8;if(t>tm)break;
  }
  return vec3(0);
}

void main(){
  vec2 uv=gl_FragCoord.xy*uCell.x+uCell.y;
  vec3 s=vec3(0);
  for(int i=0;i<4;i++){vec2 j=(vec2(i&1,i>>1)-.5)*.5*uCell.x;s+=shade(uv+j);}
  float tr=0.;
  for(int i=0;i<23;i++){
    vec3 a=uTrail[i],c=uTrail[i+1];float w=min(a.z,c.z);
    if(w>0.){float d=seg(uv,a.xy,c.xy);tr=max(tr,w*exp(-d*d/.0016));}
  }
  vec2 lh=s.z>0.?s.xy/s.z:vec2(0);
  o=vec4(lh.x,s.z*.25,lh.y,tr);
}`

export const DOTS_FS = `#version 300 es
precision highp float;
uniform sampler2D uCells;
uniform float uCols;
uniform vec3 uGeom;      // cell px, offset px, canvas px
uniform vec3 uBg,uDot,uDot2,uIceA,uIceB;
uniform vec3 uWave;      // radius (board uv), boost 0..1, ring on/off
uniform float uTime;
out vec4 o;

float hash(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec4 at(ivec2 c){int n=int(uCols);return(c.x<0||c.y<0||c.x>=n||c.y>=n)?vec4(0):texelFetch(uCells,c,0);}

void main(){
  float cs=uGeom.x;
  vec2 g=(gl_FragCoord.xy-uGeom.y)/cs;
  ivec2 ci=ivec2(floor(g));
  vec2 lc=(fract(g)-.5)*cs;
  vec4 c=at(ci),l=at(ci+ivec2(-1,0)),r=at(ci+ivec2(1,0)),u=at(ci+ivec2(0,1)),d=at(ci+ivec2(0,-1));
  float e=abs(l.g-r.g)+abs(u.g-d.g)+.7*(abs(l.r-r.r)+abs(u.r-d.r));
  float h=hash(vec2(ci)),h2=hash(vec2(ci)+71.7);
  vec2 cuv=((vec2(ci)+.5)*cs+uGeom.y)/uGeom.z;
  float dist=length(cuv-vec2(.5,.48));
  float wave=smoothstep(uWave.x,uWave.x-.08,dist);
  float ring=uWave.z*exp(-pow((dist-uWave.x)/.04,2.));
  float tr=c.a,inside=step(.5,c.g);
  float lum=c.r+tr*.25;
  float hi=c.b+tr*.95+ring*.9+uWave.y*.12;
  float imp=clamp(lum*1.1+e*.8+hi*.45+(h2-.5)*.3,0.,1.);
  float lvl=imp<.3?step(h,.3):imp<.5?1.:imp<.68?2.:imp<.84?3.:4.;
  lvl=min(4.,lvl+step(.4,tr)+step(.5,ring));
  vec3 ice=mix(uIceA,uIceB,wave);
  bool isIce=hi>.55||(e>.7&&hi>.25);
  vec3 col=isIce?ice*(.92+.08*sin(uTime*2.6+h*6.283)):(lum>.55?uDot2:uDot);
  float alpha=1.;
  if(inside<.5){lvl=(tr>.12&&h<tr*.8)?1.+step(.5,tr):0.;col=ice;alpha=.85;}
  float rad=lvl*.095*cs,sd;
  if(h>.62&&lvl>1.){float k=rad*.45;vec2 q=abs(lc)-vec2(rad*.9)+k;sd=length(max(q,0.))+min(max(q.x,q.y),0.)-k;}
  else sd=length(lc)-rad;
  float da=lvl>0.?clamp(.5-sd,0.,1.)*alpha:0.;
  float fa=smoothstep(.04,.3,texture(uCells,g/uCols).g);
  o=vec4(col,1.)*da+vec4(uBg,1.)*fa*(1.-da);
}`
