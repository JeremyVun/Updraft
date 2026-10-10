// The actual star shader must keep its light as the camera crosses pixel boundaries, including Ultra at 2x.
// Needs the Vite dev server. Usage: node tools/sky-mirror-star-check.mjs [/tmp/updraft-mirror-stars.json]
// STAR_FRAGMENT=/path/to/saved.frag compares an earlier shader with the same camera and renderer.
// SOFTWARE=1 runs SwiftShader without taking the shared GPU lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { openBrowser } from './lib/browser.mjs';

const session = process.env.SOFTWARE==='1' ? await (async()=>{
  const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu']});
  return {browser,close:()=>browser.close()};
})() : await openBrowser();
const { browser, close } = session;
try {
  const page = await browser.newPage();
  await page.route('**/__mirror_star_probe__', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Mirror star sampling</title>'}));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:5230/'}__mirror_star_probe__`);
  const results = await page.evaluate(async reference => {
    const source = await (await fetch('/src/world/mirror-soap.ts')).text();
    const THREE = await import(source.match(/from ["']([^"']*three[^"']*)["']/)[1]);
    const { starLight } = await import('/src/world/mirror-soap.ts');
    const renderer = new THREE.WebGLRenderer();
    const scene = new THREE.Scene(), star = starLight(true);
    if(reference)star.material.fragmentShader=reference;
    scene.add(star);
    const camera = new THREE.PerspectiveCamera(38, 1600/900, 0.5, 7000);
    const result = [];
    for(const ratio of [1,2]) {
      const width=1600*ratio,height=900*ratio;
      const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,samples:ratio>=1.75?2:4});
      const pixels=new Uint16Array(128*128*4);
      for(const distance of [27,60,100]) {
        const field=Math.tan(THREE.MathUtils.degToRad(38)/2);
        const from=new THREE.Vector3(-0.92,0,0.39).normalize();
        const eye=from.clone().multiplyScalar(distance).setY(5);
        const look=from.clone().multiplyScalar(distance-27).setY(1.8);
        camera.position.copy(eye);camera.lookAt(look);camera.updateMatrixWorld();
        const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
        const depth=-star.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
        const pixel=2*depth*field/height,energies=[];
        for(let phase=0;phase<24;phase++) {
          const shift=up.clone().multiplyScalar(pixel*phase/24);
          camera.position.copy(eye).add(shift);camera.lookAt(look.clone().add(shift));camera.updateMatrixWorld();
          renderer.setRenderTarget(target);renderer.render(scene,camera);
          const p=star.position.clone().project(camera);
          renderer.readRenderTargetPixels(target,Math.round((p.x+1)*width/2)-64,Math.round((p.y+1)*height/2)-64,128,128,pixels);
          renderer.setRenderTarget(null);
          let energy=0;
          for(let i=0;i<pixels.length;i+=4)energy+=THREE.DataUtils.fromHalfFloat(pixels[i]);
          energies.push(energy);
        }
        result.push({ratio,distance,min:Math.min(...energies),max:Math.max(...energies),variation:Math.max(...energies)/Math.min(...energies)-1});
      }
      target.dispose();
    }
    renderer.dispose();star.geometry.dispose();star.material.dispose();
    return result;
  },process.env.STAR_FRAGMENT?fs.readFileSync(process.env.STAR_FRAGMENT,'utf8'):null);
  console.log(JSON.stringify(results,null,2));
  fs.writeFileSync(process.argv[2] ?? '/tmp/updraft-mirror-stars.json',JSON.stringify(results,null,2));
  for(const result of results)assert(result.min>0 && result.variation<0.1,`star brightness changes across pixels: ${JSON.stringify(result)}`);
} finally { await close(); }
