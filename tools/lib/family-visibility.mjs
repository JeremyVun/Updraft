import assert from 'node:assert/strict';

export async function watchFamilyVisibility(page) {
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = __game, enabled = { value: 0 }, copies = new Map();
    g.washing.group.traverse(object => {
      const material = object.material;
      if (!material?.fragmentShader?.includes('in float vRole;')) return;
      if (!copies.has(material)) {
        const copy = material.clone();
        copy.uniforms = { ...material.uniforms, uFamilyProbe: enabled };
        copy.fragmentShader = copy.fragmentShader.replace('void main() {', 'uniform float uFamilyProbe;\nvoid main() {');
        const end = copy.fragmentShader.lastIndexOf('}');
        copy.fragmentShader = copy.fragmentShader.slice(0,end) + '\nif (uFamilyProbe > 0.5 && vRole > -0.5) gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);\n' + copy.fragmentShader.slice(end);
        copies.set(material,copy);
      }
      object.material = copies.get(material);
    });
    const w=480,h=Math.round(w/innerWidth*innerHeight);
    const target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true});
    const pixels=new Uint8Array(w*h*4);
    window.__familyVisibility={samples:0,leaks:[],revealedMax:0};
    window.__sampleFamily=()=>{
      const c=g.story.current;
      if(g.story.name!=='lines'||['throughDoor','shore','walk','haul'].includes(c.beat))return;
      const previous=g.renderer.getRenderTarget();
      enabled.value=1;
      try {
        g.renderer.setRenderTarget(target);g.renderer.render(g.scene,g.rig.camera);
        g.renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
      } finally {enabled.value=0;g.renderer.setRenderTarget(previous);}
      let visible=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i]>250&&pixels[i+1]<3&&pixels[i+2]>250)visible++;
      const before=!g.curtains[2].cleared,report=window.__familyVisibility;
      report.samples++;
      if(before&&visible)report.leaks.push({beat:c.beat,gate:c.gate,visible,eye:g.rig.camera.position.toArray()});
      if(c.beat==='family')report.revealedMax=Math.max(report.revealedMax,visible);
      return visible;
    };
    window.__familyTimer=setInterval(window.__sampleFamily,700);
  });
}

export async function checkFamilyVisibility(page) {
  const report=await page.evaluate(()=>{clearInterval(window.__familyTimer);return window.__familyVisibility;});
  assert(report.samples>20,'sample preceding camera transitions');
  assert.deepEqual(report.leaks,[],'family is physically occluded until the last curtain is complete');
  assert(report.revealedMax>25,'family becomes visible at its reveal');
  return report;
}
