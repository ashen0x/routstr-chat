(()=>{"use strict";var e;let t,a,s,r,i,o,l,u,n,h,f,_,c,m=`#version 300 es
precision highp float;
layout(location=0) in float a_s;
layout(location=1) in float a_side;
layout(location=2) in vec4 a_seed;
layout(location=3) in float a_lane;
uniform float u_time, u_from, u_to, u_mix, u_width, u_rush, u_blur;
uniform mat4 u_mvp;
uniform vec2 u_res;
uniform vec2 u_touch;
uniform vec3 u_burst;
uniform vec2 u_home;
out float v_side;
out float v_s;
out vec4 v_seed;
out float v_depth;
out float v_ends;
out float v_soft;
out float v_hit;
out float v_near;
out float v_closed;
out vec2 v_mark;
out float v_pour;
const float TAU = 6.2831853;

vec3 form(float k, float s, vec4 sd, float lane, float t) {
  if (k < 0.5) {
    // cable: every fibre twisted into one line
    float x = (s - 0.5) * 9.0;
    float r = 0.02 + 0.2 * sd.x * sd.x;
    float a = sd.y * TAU + s * (5.0 + 5.0 * sd.z) + t * 0.4;
    float sag = 0.26 * sin(x * 0.62 + t * 0.2);
    return vec3(x, sag + r * cos(a), r * sin(a));
  }
  if (k < 1.5) {
    // ball: each fibre a great circle
    float th = s * TAU + t * 0.06 * (sd.w - 0.5);
    float a1 = sd.y * TAU;
    float a2 = acos(2.0 * sd.z - 1.0);
    vec3 n = vec3(sin(a2) * cos(a1), cos(a2), sin(a2) * sin(a1));
    vec3 u = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 v = cross(n, u);
    return (1.08 + 0.03 * sd.x) * (cos(th) * u + sin(th) * v);
  }
  // lanes: side by side, facing you, a little alive; the ₿ is cut from them in the fragment shader
  float x = (s - 0.5) * 3.0;
  float y = (lane - 0.5) * 2.5;
  return vec3(x, y + 0.01 * sin(x * 5.0 + t * 0.9 + lane * 40.0), 0.05 * sin(x * 2.2 + t * 0.6 + y * 3.0));
}

/* 1 for a shape that comes back round to where it began (the ball), 0 for one that runs off its ends. */
float closed(float k) {
  return clamp(1.0 - abs(k - 1.0), 0.0, 1.0);
}

/* Poured: each point of a lane leaves the ₿ in turn, the lane's head first, and arcs into the
   balance (u_home, in the ₿'s own units); q is how far along it is. */
float pouring(float s, float m) {
  float q = clamp(m * 1.3 - (1.0 - s) * 0.3, 0.0, 1.0);
  return q * q * (3.0 - 2.0 * q);
}
vec3 pour(float s, float m) {
  vec3 p = form(2.0, s, a_seed, a_lane, u_time);
  float q = pouring(s, m);
  vec2 d = u_home - p.xy;
  vec2 bow = (p.xy + u_home) * 0.5 + vec2(-d.y, d.x) * 0.22;
  return vec3(mix(mix(p.xy, bow, q), mix(bow, u_home, q), q), p.z * (1.0 - q));
}

vec3 at(float s, float m) {
  // (once poured it stays poured)
  if (u_to > 2.5) return pour(s, u_from > 2.5 ? 1.0 : m);
  vec3 p;
  if (m <= 0.0) p = form(u_from, s, a_seed, a_lane, u_time);
  else if (m >= 1.0) p = form(u_to, s, a_seed, a_lane, u_time);
  else p = mix(form(u_from, s, a_seed, a_lane, u_time), form(u_to, s, a_seed, a_lane, u_time), m);
  // held, the whole thing winds up along its length (round a ball, so its loops stay closed)
  float loops = mix(closed(u_from), closed(u_to), m);
  float w = u_rush * 0.9 * mix(s - 0.5, 0.5 * sin(s * TAU), loops);
  float c = cos(w);
  float n = sin(w);
  return vec3(p.x, p.y * c - p.z * n, p.y * n + p.z * c);
}

/* How far this point of the fibre is from where the gift was opened, on screen (squared). */
float miss(float s, float m, vec2 spot) {
  vec4 p = u_mvp * vec4(at(s, m), 1.0);
  vec2 d = p.xy / p.w - spot;
  d.x *= u_res.x / u_res.y;
  return dot(d, d);
}

void main() {
  // fibres set off one after another, so a change of shape reads as a flow
  float m = clamp(u_mix * 1.4 - a_seed.w * 0.4, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec4 here = u_mvp * vec4(at(a_s, m), 1.0);
  vec4 next = u_mvp * vec4(at(a_s + 1.0 / 132.0, m), 1.0);
  vec2 dir = (next.xy / next.w - here.xy / here.w) * u_res;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);

  // the fibres part softly around the pointer
  vec2 away = here.xy / here.w - u_touch;
  away.x *= u_res.x / u_res.y;
  here.xy += away * vec2(u_res.y / u_res.x, 1.0) * exp(-dot(away, away) * 6.5) * 0.13 * here.w;

  // out of the plane of focus a fibre gets wider and fainter
  float off = clamp(abs(here.w - 6.0) / 2.4, 0.0, 1.0);
  float spread = 1.0 + off * off * u_blur * 3.2;
  float width = u_width * (0.55 + 0.95 * a_seed.x) * clamp(5.6 / here.w, 0.5, 2.4) * spread;
  here.xy += vec2(-dir.y, dir.x) * a_side * width / u_res * 2.0 * here.w;
  gl_Position = here;

  v_side = a_side;
  v_s = a_s;
  v_seed = a_seed;
  v_depth = here.w;
  v_soft = 1.0 / spread;
  v_closed = mix(closed(u_from), closed(u_to), m);
  v_pour = u_to > 2.5 ? pouring(a_s, u_from > 2.5 ? 1.0 : m) : 0.0;
  // where this point of the fibre sits in the ₿'s square
  vec3 plane = form(2.0, a_s, a_seed, a_lane, 0.0);
  v_mark = plane.xy / 2.3 + 0.5;
  v_ends = mix(smoothstep(0.0, 0.14, a_s) * smoothstep(1.0, 0.86, a_s), 1.0, v_closed);

  // opened: find where along itself this fibre passes nearest to that spot (a coarse walk, then a finer one)
  v_hit = 0.0;
  v_near = 0.0;
  if (u_burst.z < 1.7) {
    float best = 0.0;
    float least = 1e9;
    for (int i = 0; i < 10; i++) {
      float s = (float(i) + 0.5) / 10.0;
      float d = miss(s, m, u_burst.xy);
      if (d < least) {
        least = d;
        best = s;
      }
    }
    float around = best;
    for (int i = -2; i <= 2; i++) {
      float s = clamp(around + float(i) / 40.0, 0.0, 1.0);
      float d = miss(s, m, u_burst.xy);
      if (d < least) {
        least = d;
        best = s;
      }
    }
    v_hit = best;
    v_near = exp(-least / 0.008);
  }
}`,d=`#version 300 es
precision highp float;
in float v_side;
in float v_s;
in vec4 v_seed;
in float v_depth;
in float v_ends;
in float v_soft;
in float v_hit;
in float v_near;
in float v_closed;
in vec2 v_mark;
in float v_pour;
uniform float u_flow, u_gain, u_pulse, u_gold, u_mark;
uniform sampler2D u_coin;
uniform vec3 u_burst;
out vec4 o;
void main() {
  float edge = 1.0 - smoothstep(0.3 * v_soft, 1.0, abs(v_side));
  // one fibre in three carries a pulse of gold
  float carries = step(0.66, v_seed.y);
  float phase = fract(v_s * (1.0 + floor(v_seed.x * 2.0)) - u_flow * (0.03 + 0.05 * v_seed.z) + v_seed.w);
  float pulse = smoothstep(0.0, 0.012, phase) * smoothstep(0.075, 0.012, phase) * carries;
  vec3 cool = mix(vec3(0.56, 0.68, 1.0), vec3(0.88, 0.93, 1.0), v_seed.z);
  vec3 gold = vec3(1.0, 0.68, 0.26);
  vec3 col = mix(cool * (0.035 + 0.3 * v_seed.x * v_seed.x), gold * (0.12 + 0.4 * v_seed.x * v_seed.x), u_gold);
  col += gold * pulse * u_pulse * 1.9;

  // opened: the fibres under that spot light up there, and the gold runs away along each of them, both ways
  float age = u_burst.z;
  float since = age - v_seed.w * 0.12;
  float apart = abs(v_s - v_hit);
  apart = mix(apart, min(apart, 1.0 - apart), v_closed);
  float gone = 0.46 * (1.0 - exp(-2.3 * max(since, 0.0))) * (0.7 + 0.6 * v_seed.z);
  float head = (1.0 - smoothstep(gone, gone + 0.012, apart)) * exp(-(gone - apart) * 12.0);
  float burst = head * v_near * step(0.0, since) * exp(-since * 1.1) * (1.0 - smoothstep(0.9, 1.6, age));
  col += gold * min(burst, 1.7) * 2.5;

  float fog = mix(1.0, 0.22, smoothstep(4.4, 8.2, v_depth));
  // the ₿: bright inside its shape, gone outside it
  vec2 q = v_mark;
  float inside = texture(u_coin, q).r * step(0.0, q.x) * step(q.x, 1.0) * step(0.0, q.y) * step(q.y, 1.0);
  // poured: brighter in flight, gone as it reaches the balance
  float flight = (1.0 + 1.6 * sin(v_pour * 3.14159)) * (1.0 - smoothstep(0.8, 1.0, v_pour));
  o = vec4(col * edge * fog * v_ends * v_soft * mix(1.0, inside, u_mark) * flight * u_gain, 1.0);
}`,p=`#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`,v=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_step;
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb * 0.227027;
  c += (texture(u_tex, v_uv + u_step * 1.3846).rgb + texture(u_tex, v_uv - u_step * 1.3846).rgb) * 0.316216;
  c += (texture(u_tex, v_uv + u_step * 3.2308).rgb + texture(u_tex, v_uv - u_step * 3.2308).rgb) * 0.070270;
  o = vec4(c, 1.0);
}`,g=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene, u_glow, u_haze;
out vec4 o;
void main() {
  // a lens: colours part a hair toward the edges of the frame
  vec2 out2 = (v_uv - 0.5) * dot(v_uv - 0.5, v_uv - 0.5) * 0.014;
  vec3 sharp = vec3(texture(u_scene, v_uv + out2).r, texture(u_scene, v_uv).g, texture(u_scene, v_uv - out2).b);
  vec3 c = sharp + texture(u_glow, v_uv).rgb * 0.55 + texture(u_haze, v_uv).rgb * 0.5;
  c = 1.0 - exp(-c * 1.35);
  o = vec4(c, max(c.r, max(c.g, c.b)));
}`,x=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);function b(e,t){let a=new Float32Array(16);for(let s=0;s<4;s++)for(let r=0;r<4;r++)a[4*s+r]=e[r]*t[4*s]+e[4+r]*t[4*s+1]+e[8+r]*t[4*s+2]+e[12+r]*t[4*s+3];return a}function w(e,t,a){let s=x();return s[12]=e,s[13]=t,s[14]=a,s}function E(e,t){let a=x(),s=Math.cos(t),r=Math.sin(t),[i,o]=0===e?[1,2]:1===e?[2,0]:[0,1];return a[4*i+i]=s,a[4*o+o]=s,a[4*i+o]=r,a[4*o+i]=-r,a}let T=(e,t,a)=>Math.min(a,Math.max(t,e)),y=e=>e*e*(3-2*e),R=6*Math.tan(.3);class A{get arrived(){return this.dead||this.still||this.time>=2.6}constructor(e,t,a,s){if(this.canvas=e,this.scenes=t,this.counts=a,this.programs={},this.fibreVao=null,this.quadVao=null,this.coin=null,this.targets=[],this.float=!1,this.frame=0,this.time=0,this.flow=0,this.stage=0,this.rush=0,this.pointer=[0,0],this.lean=[0,0],this.touch=[-9,-9],this.touchTarget=[-9,-9],this.opened=new Float32Array([0,0,9]),this.quality=1,this.slow=0,this.age=0,this.w=1,this.h=1,this.dpr=1,this.frugal=!1,this.still=!1,this.target=0,this.onFrame=null,this.home=[0,0],this.still=s,this.gl=e.getContext("webgl2",{antialias:!1,alpha:!0,premultipliedAlpha:!0}),this.dead=!this.gl,!this.gl)return;const r=this.gl;this.float=!!r.getExtension("EXT_color_buffer_float")||!!r.getExtension("EXT_color_buffer_half_float");const i=r.getExtension("WEBGL_debug_renderer_info");this.frugal=/swiftshader|llvmpipe|software|basic render/i.test(String(r.getParameter(i?i.UNMASKED_RENDERER_WEBGL:r.RENDERER))),this.frugal&&(this.quality=.5,this.still=!0),this.programs.fibre=this.program(m,d,["u_time","u_flow","u_from","u_to","u_mix","u_width","u_rush","u_blur","u_mvp","u_res","u_touch","u_gain","u_pulse","u_gold","u_burst","u_mark","u_coin","u_home"]),this.programs.blur=this.program(p,v,["u_tex","u_step"]),this.programs.final=this.program(p,g,["u_scene","u_glow","u_haze"]),this.build(),this.coin=r.createTexture(),r.bindTexture(r.TEXTURE_2D,this.coin),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!0),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,r.RGBA,r.UNSIGNED_BYTE,function(){let e=new OffscreenCanvas(512,512),t=e.getContext("2d");return t.fillStyle="#000",t.fillRect(0,0,512,512),t.filter="blur(1px)",t.setTransform(10.986782600112228,0,0,10.986782600112228,-83.22789956106516,-89.14428199122557),t.fillStyle="#fff",t.fill(new Path2D("m46.103,27.444c0.637-4.258-2.605-6.547-7.038-8.074l1.438-5.768-3.511-0.875-1.4,5.616c-0.923-0.23-1.871-0.447-2.813-0.662l1.41-5.653-3.509-0.875-1.439,5.766c-0.764-0.174-1.514-0.346-2.242-0.527l0.004-0.018-4.842-1.209-0.934,3.75s2.605,0.597,2.55,0.634c1.422,0.355,1.679,1.296,1.636,2.042l-1.638,6.571c0.098,0.025,0.225,0.061,0.365,0.117-0.117-0.029-0.242-0.061-0.371-0.092l-2.296,9.205c-0.174,0.432-0.615,1.08-1.609,0.834,0.035,0.051-2.552-0.637-2.552-0.637l-1.743,4.019,4.569,1.139c0.85,0.213,1.683,0.436,2.503,0.646l-1.453,5.834,3.507,0.875,1.439-5.772c0.958,0.26,1.888,0.5,2.798,0.726l-1.434,5.745,3.511,0.875,1.453-5.823c5.987,1.133,10.489,0.676,12.384-4.739,1.527-4.36-0.076-6.875-3.226-8.515,2.294-0.529,4.022-2.038,4.483-5.155zm-8.022,11.249c-1.085,4.36-8.426,2.003-10.806,1.412l1.928-7.729c2.38,0.594,10.012,1.77,8.878,6.317zm1.086-11.312c-0.99,3.966-7.1,1.951-9.082,1.457l1.748-7.01c1.982,0.494,8.365,1.416,7.334,5.553z")),e}()),r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,!1),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE)}program(e,t,a){let s=this.gl,r=s.createProgram();for(let[a,i]of[[s.VERTEX_SHADER,e],[s.FRAGMENT_SHADER,t]]){let e=s.createShader(a);s.shaderSource(e,i),s.compileShader(e),s.getShaderParameter(e,s.COMPILE_STATUS)||console.warn(s.getShaderInfoLog(e)),s.attachShader(r,e)}s.linkProgram(r);let i={};for(let e of a)i[e]=s.getUniformLocation(r,e);return{p:r,u:i}}build(){let e=this.gl,{wrap:t,coin:a}=this.counts,s=t+a,r=new Float32Array(133*s*14),i=new Uint32Array(132*s*6),o=0,l=0;for(let e=0;e<s;e++){let s=[Math.random(),Math.random(),Math.random(),Math.random()],u=e<t?-1:(e-t)/Math.max(1,a-1);for(let t=0;t<133;t++){for(let e of[-1,1])r.set([t/132,e,...s,u],o),o+=7;if(t<132){let a=(133*e+t)*2;i.set([a,a+1,a+2,a+1,a+3,a+2],l),l+=6}}}this.fibreVao=e.createVertexArray(),e.bindVertexArray(this.fibreVao),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,r,e.STATIC_DRAW),[[0,1,0],[1,1,4],[2,4,8],[3,1,24]].forEach(([t,a,s])=>{e.enableVertexAttribArray(t),e.vertexAttribPointer(t,a,e.FLOAT,!1,28,s)}),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ELEMENT_ARRAY_BUFFER,i,e.STATIC_DRAW),this.quadVao=e.createVertexArray(),e.bindVertexArray(this.quadVao),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.bindVertexArray(null)}makeTarget(e,t){let a=this.gl,s=a.createTexture();a.bindTexture(a.TEXTURE_2D,s),this.float?a.texImage2D(a.TEXTURE_2D,0,a.RGBA16F,e,t,0,a.RGBA,a.HALF_FLOAT,null):a.texImage2D(a.TEXTURE_2D,0,a.RGBA8,e,t,0,a.RGBA,a.UNSIGNED_BYTE,null),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE);let r=a.createFramebuffer();return a.bindFramebuffer(a.FRAMEBUFFER,r),a.framebufferTexture2D(a.FRAMEBUFFER,a.COLOR_ATTACHMENT0,a.TEXTURE_2D,s,0),{fbo:r,tex:s,w:e,h:t}}resize(e=this.w,t=this.h,a=this.dpr){if(!this.gl)return;let s=this.gl;this.w=Math.max(1,e),this.h=Math.max(1,t),this.dpr=a;let r=Math.min(a||1,2)*this.quality,i=Math.max(2,Math.round(this.w*r)),o=Math.max(2,Math.round(this.h*r));for(let e of(this.canvas.width=i,this.canvas.height=o,this.targets))s.deleteFramebuffer(e.fbo),s.deleteTexture(e.tex);let l=[Math.ceil(i/2),Math.ceil(o/2)],u=[Math.ceil(i/6),Math.ceil(o/6)];this.targets=[this.makeTarget(i,o),this.makeTarget(l[0],l[1]),this.makeTarget(l[0],l[1]),this.makeTarget(u[0],u[1]),this.makeTarget(u[0],u[1])],this.draw(0)}point(e,t){this.pointer=[e,t],this.touchTarget=[2*e,-(2*t)],this.touch[0]<-8&&(this.touch=[2*e,-(2*t)])}burst(e,t){this.opened.set([2*e,-(2*t),0])}start(){if(cancelAnimationFrame(this.frame),this.dead)return;let e=performance.now(),t=e,a=!0,s=r=>{if(this.frame=requestAnimationFrame(s),this.onFrame?.(r-t),t=r,this.frugal&&!a&&(.002>Math.abs(this.target-this.stage)||r-e<140))return;let i=Math.min(this.frugal?.3:.05,(r-e)/1e3);e=r,a=!1,this.draw(i)};this.frame=requestAnimationFrame(s)}stop(){cancelAnimationFrame(this.frame)}blur(e,t,a,s){let r=this.gl;r.bindFramebuffer(r.FRAMEBUFFER,t.fbo),r.viewport(0,0,t.w,t.h),r.bindTexture(r.TEXTURE_2D,e.tex),r.uniform2f(this.programs.blur.u.u_step,a/t.w,s/t.h),r.drawArrays(r.TRIANGLES,0,3)}draw(e){var t;let a,s,r,i,o,l=this.gl;if(!l||!this.targets.length)return;if(this.age+=e,this.slow=e>.03&&this.age>4?this.slow+1:Math.max(0,this.slow-1),!this.frugal&&this.slow>24&&this.quality>.5){this.slow=0,this.quality*=.78,this.resize();return}let u=this.stage;this.stage+=(this.target-this.stage)*(e?1-Math.exp(-(5*e)):1);let n=e?T((this.stage-u)/e*.55,-1,1):0;this.rush+=(n-this.rush)*.08,this.still||(this.time+=e,this.flow+=e*(1+7*Math.abs(this.rush))),this.opened[2]=Math.min(9,this.opened[2]+e),this.lean[0]+=(this.pointer[0]-this.lean[0])*.05,this.lean[1]+=(this.pointer[1]-this.lean[1])*.05,this.touch[0]+=(this.touchTarget[0]-this.touch[0])*.12,this.touch[1]+=(this.touchTarget[1]-this.touch[1])*.12;let{opening:h,list:f}=this.scenes(this.w,this.h),_=1,c=this.still?1:Math.min(1,this.time/2.6);if(c<1&&this.stage<.25)a=h,s=f[0],r=y(T((c-.22)/.78,0,1)),_=Math.min(1,6*c)*(1+.9*Math.exp(-Math.pow((c-.4)/.16,2)));else{let e=Math.min(f.length-1,Math.floor(this.stage));a=f[e],s=f[Math.min(f.length-1,e+1)],r=y(T((this.stage-e-.22)/.56,0,1))}let[m,d,p,v,g]=this.targets,R=b((t=this.w/this.h,i=1/Math.tan(.3),(o=new Float32Array(16))[0]=i/t,o[5]=i,o[10]=-1.003338898163606,o[11]=-1,o[14]=-.2003338898163606,o),w(0,0,-6)),A=this.programs.fibre;for(let{from:e,to:t,count:i,first:o,gold:u,burst:n}of(l.bindFramebuffer(l.FRAMEBUFFER,m.fbo),l.viewport(0,0,m.w,m.h),l.clearColor(0,0,0,0),l.clear(l.COLOR_BUFFER_BIT),l.enable(l.BLEND),l.blendFunc(l.ONE,l.ONE),l.useProgram(A.p),l.uniform1f(A.u.u_time,this.time),l.uniform1f(A.u.u_flow,this.flow),l.uniform1f(A.u.u_mix,r),l.uniform1f(A.u.u_width,1.15*(m.w/this.w)),l.uniform1f(A.u.u_rush,this.rush),l.uniform2f(A.u.u_res,m.w,m.h),l.uniform2f(A.u.u_touch,this.touch[0],this.touch[1]),l.activeTexture(l.TEXTURE0),l.bindTexture(l.TEXTURE_2D,this.coin),l.uniform1i(A.u.u_coin,0),l.bindVertexArray(this.fibreVao),[{from:a.wrap,to:s.wrap,count:this.counts.wrap,first:0,gold:0,burst:this.opened},{from:a.coin,to:s.coin,count:this.counts.coin,first:this.counts.wrap,gold:1,burst:[0,0,9]}])){let a=a=>e[a]+(t[a]-e[a])*r,s=a("gain")*_*(560/i)*(1+.5*Math.abs(this.rush));if(s<=5e-4)continue;let h=[w(a("x"),a("y"),0),E(1,a("yaw")+.1*Math.sin(.11*this.time)+.22*this.lean[0]),E(0,a("pitch")+.14*this.lean[1]),E(2,a("roll")),function(e){let t=x();return t[0]=t[5]=t[10]=e,t}(a("scale"))].reduce(b);l.uniform1f(A.u.u_from,e.form),l.uniform1f(A.u.u_to,t.form),l.uniform1f(A.u.u_blur,a("blur")),l.uniform1f(A.u.u_gold,u),l.uniform1f(A.u.u_mark,a("mark")),l.uniform2f(A.u.u_home,this.home[0],this.home[1]),l.uniform1f(A.u.u_gain,s),l.uniform1f(A.u.u_pulse,a("pulse")*(1+1.5*Math.abs(this.rush))),l.uniformMatrix4fv(A.u.u_mvp,!1,b(R,h)),l.uniform3fv(A.u.u_burst,n),l.drawElements(l.TRIANGLES,132*i*6,l.UNSIGNED_INT,132*o*24)}l.disable(l.BLEND),l.bindVertexArray(this.quadVao),l.useProgram(this.programs.blur.p),l.activeTexture(l.TEXTURE0),l.uniform1i(this.programs.blur.u.u_tex,0),this.blur(m,d,1,0),this.blur(d,p,0,1),this.blur(p,v,1.6,0),this.blur(v,g,0,1.6),this.blur(g,v,1.6,0),this.blur(v,g,0,1.6);let F=this.programs.final;l.bindFramebuffer(l.FRAMEBUFFER,null),l.viewport(0,0,this.canvas.width,this.canvas.height),l.clearColor(0,0,0,0),l.clear(l.COLOR_BUFFER_BIT),l.useProgram(F.p),[m,p,g].forEach((e,t)=>{l.activeTexture(l.TEXTURE0+t),l.bindTexture(l.TEXTURE_2D,e.tex)}),l.uniform1i(F.u.u_scene,0),l.uniform1i(F.u.u_glow,1),l.uniform1i(F.u.u_haze,2),l.drawArrays(l.TRIANGLES,0,3),l.activeTexture(l.TEXTURE0)}}let F=self,M=(e=e=>F.postMessage(e),t=null,a=null,s={w:1,h:1},r={light:{x:0,y:0,r:1},wallet:null},i={on:!1,auto:!1,h:0,x:0,y:0,opened:!1},o=[],l=null,u=!1,n="",h=null,f=(e,s)=>{let i=`${e}/${s}/${a}/${r.light.x}/${r.light.y}/${r.light.r}/${r.wallet?.x}/${r.wallet?.y}`;if(h&&n===i)return h;n=i;let o=2*R/s,l=t=>({x:(t.x-e/2)*o,y:(s/2-t.y)*o}),{x:u,y:f}=l(r.light),_=r.light.r*o,c=_/1.08,m=1.2*_/2,d=r.wallet?l(r.wallet):{x:u,y:f+3*_},p={form:1,x:u,y:f,yaw:.5,pitch:.5,roll:-.12,scale:c,gain:.32,pulse:1.2,blur:.6,mark:0},v={...p,yaw:2.1,pitch:.62,roll:-.22,scale:.84*c,gain:.42,pulse:3,blur:.35},g={...v,yaw:3.6,scale:2.6*c,gain:0,blur:1},x={form:2,x:u,y:f,yaw:0,pitch:.08,roll:0,scale:m,gain:.1,pulse:1.2,blur:.4,mark:1},b={...x,scale:.94*m,gain:.2,pulse:2.6},w={...x,scale:1.3*m,gain:.9,pulse:1.6,blur:.3},E={...w,form:3};t&&(t.home=[(d.x-u)/w.scale,(d.y-f)/w.scale]);let T=e=>({...e,gain:0}),y={wrap:{...p,gain:.18,pulse:0},coin:T(x)},A={wrap:p,coin:x},F={wrap:v,coin:b},M={wrap:T(p),coin:T(x)},U="landed"===a?[A,F,{wrap:g,coin:w},{wrap:g,coin:E},{wrap:g,coin:T(E)}]:"spent"===a?[A,F,y,y,M]:[A,F,A,A,M],D={form:0,x:0,y:f,yaw:0,pitch:.1,roll:-.04,scale:e*o*1.1/9,gain:.3,pulse:4,blur:.3,mark:0};return h={opening:{wrap:D,coin:{...D,gain:.16,mark:1}},list:U}},_=()=>({x:r.light.x/s.w-.5,y:r.light.y/s.h-.5}),c=s=>{if(!t)return;let r=performance.now();for(!i.opened&&!a&&t.arrived&&(i.on||i.auto?i.h=Math.min(1,i.h+s/(i.auto?700:900)):i.h=Math.max(0,i.h-s/380),t.target=i.h,i.h>=1&&(i.opened=!0,e({t:"opened"})));o.length&&o[0].at<=r;){let a=o.shift();a.say?("done"===a.say.t&&(u=!0,t.stop()),e(a.say)):l={from:t.target,to:a.to,t0:a.at,ms:a.ms}}if(l){let e=Math.min(1,(r-l.t0)/l.ms);t.target=l.from+(l.to-l.from)*e,e>=1&&(l=null)}},l=>{if("init"===l.t)return(s={w:l.w,h:l.h},r=l.place,(t=new A(l.canvas,f,l.small?{wrap:240,coin:280}:{wrap:440,coin:440},l.reduced)).dead)?(t=null,e({t:"dead"})):(t.onFrame=c,t.resize(l.w,l.h,l.dpr),void t.start());if(t){if("size"===l.t)s={w:l.w,h:l.h},r=l.place,t.resize(l.w,l.h,l.dpr);else if("point"===l.t)t.point(l.x,l.y),i.on&&Object.assign(i,{x:l.x,y:l.y});else if("press"===l.t)Object.assign(i,{on:!0,x:l.x,y:l.y});else if("release"===l.t)Object.assign(i,{on:!1,auto:i.auto||l.tap});else if("open"===l.t)Object.assign(i,{auto:!0,..._()});else if("run"===l.t)l.on&&!u?t.start():t.stop();else if("end"===l.t){let e=performance.now();if("back"===l.how)return void Object.assign(i,{on:!1,auto:!1,opened:!1});if(a=l.how,"landed"===l.how){let a=_(),l=(i.x-a.x)*s.w,u=(i.y-a.y)*s.h,n=Math.hypot(l,u)/(.7*r.light.r),h=n>1?1/n:1;t.burst(a.x+l*h/s.w,a.y+u*h/s.h),o=[{at:e,to:2,ms:1e3},{at:e+2400,to:3,ms:2600},{at:e+3400,say:{t:"leaving"}},{at:e+3800,say:{t:"arrived"}},{at:e+5e3,to:4,ms:300},{at:e+5500,say:{t:"done"}}]}else o=[{at:e,to:2,ms:900},{at:e+2600,say:{t:"leaving"}},{at:e+2600,to:4,ms:1300},{at:e+4e3,say:{t:"done"}}]}}});F.onmessage=e=>M(e.data)})(),_N_E={};