// The stairs in the clouds, played to a moment with real pointer gestures (as tools/stairs-check.mjs plays them):
// waiting (the first loose flight, from the grass), climb (the last flight below the cloud), loop (the Penrose loop in
// its clearing), cloud (following the bird on up through the white after the loop), top (the swans over the cloud sea, before boarding), sail
// (140 m out over the cloud) and fog (in the bank of mist at the end of the sail). Later moments restore the
// checkpoint with every flight home and climb from there. fast(on) lowers the render scale while it plays.
export async function stairsFixture(page, fixture, fast) {
  const state=()=>page.evaluate(()=>{const g=__game,s=g.story.current;return {chapter:g.story.name,beat:s.beat,t:+(s.now-s.beatStart).toFixed(1),sailed:Math.round(s.sailed??0)};});
  const until=async(test,ms,act)=>{const end=Date.now()+ms;for(;;){const s=await state();if(test(s))return s;
    if(Date.now()>end)throw Error('Stairs fixture '+fixture+' stuck at '+JSON.stringify(s));if(act)await act(s);else await page.waitForTimeout(250);}};
  const swipe=async(from,to,ms)=>{const n=Math.max(2,Math.round(ms/8));await page.mouse.move(from[0],from[1]);
    for(let i=1;i<=n;i++){await page.mouse.move(from[0]+(to[0]-from[0])*i/n,from[1]+(to[1]-from[1])*i/n);await page.waitForTimeout(ms/n);}};
  await fast(true);
  try {
    if(fixture==='waiting'){await until(s=>s.beat==='waiting'&&s.t>2,90000);return;}
    await page.evaluate(()=>__game.story.current.restoreCheckpoint('flight-3',[3]));
    if(fixture==='climb'){await until(s=>s.beat==='climb'&&s.t>2.5||s.beat==='hesitate',60000);return;}
    await until(s=>s.beat==='loop',180000);
    if(fixture==='loop'){await until(s=>s.beat==='loop'&&s.t>8,60000);return;}
    // Round the loop until the sweep is drawn over the cloud on its far corner, then blow it off.
    await until(s=>s.beat!=='loop',180000,async()=>{
      await page.waitForTimeout(1500);
      const bank=await page.evaluate(()=>{const g=__game,hint=g.story.current.windInvitation;if(!hint)return null;
        const p=hint.clone().project(g.rig.camera);return [(p.x*0.5+0.5)*innerWidth,(0.5-p.y*0.5)*innerHeight];});
      if(bank)await swipe([bank[0]-160,bank[1]+40],[bank[0]+180,bank[1]-30],450);
    });
    if(fixture==='cloud'){await until(s=>s.beat==='follow'&&s.t>6,120000);return;}
    if(fixture==='top'){await until(s=>s.beat==='skein'&&s.t>10,180000);return;}
    await until(s=>s.beat==='sail',240000);
    // Over the cloud: sweeps through the hull the way it is going keep it sailing.
    const sweep=async()=>{
      const at=await page.evaluate(()=>{const g=__game,b=g.boat,cam=g.rig.camera,w=innerWidth,h=innerHeight;
        const scr=v=>{const q=v.clone().project(cam);return [(q.x*0.5+0.5)*w,(0.5-q.y*0.5)*h];};
        const f={x:Math.sin(b.yaw),y:0,z:Math.cos(b.yaw)},p=b.position.clone();p.y+=0.3;
        return {at:scr(p),back:scr(p.clone().addScaledVector(f,-3)),fore:scr(p.clone().addScaledVector(f,4)),w,h};});
      let a=at.back,z=at.fore;
      if(Math.hypot(z[0]-a[0],z[1]-a[1])<120){a=[at.at[0]-180,at.at[1]+30];z=[at.at[0]+180,at.at[1]-30];}
      const inside=q=>[Math.min(Math.max(q[0],20),at.w-20),Math.min(Math.max(q[1],20),at.h-20)];
      await swipe(inside(a),inside(z),380);await page.waitForTimeout(250);
    };
    if(fixture==='sail'){await until(s=>s.sailed>=140||s.beat!=='sail',300000,sweep);return;}
    if(fixture==='fog'){await until(s=>s.beat==='fog'&&s.t>3||s.chapter!=='stairs'||s.beat==='thin',400000,sweep);return;}
    throw Error('Unknown stairs fixture '+fixture);
  } finally {await fast(false);}
}
