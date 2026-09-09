import { test, expect } from '@playwright/test';
import { defaultScene } from '../../game/studio/document.ts';
import { useDragLook } from './game-input.ts';

test('scene editor: select, edit, undo, save, reload, play and return to unchanged document',async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/scene-editor.html');
  await expect(page.getByRole('heading',{name:'SCENE STUDIO'})).toBeVisible();
  await expect(page.getByRole('region',{name:'シーンプレビュー'})).toHaveAttribute('data-ready','true',{timeout:30_000});
  await page.getByRole('button',{name:'hangar-a',exact:true}).click();
  await page.getByLabel('位置 X',{exact:true}).fill('-30');
  await page.getByRole('button',{name:'元に戻す',exact:true}).click();
  await expect(page.getByLabel('位置 X',{exact:true})).toHaveValue('-28');
  await page.getByRole('button',{name:'やり直す',exact:true}).click();
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'hangar-a',exact:true}).click();
  await expect(page.getByLabel('位置 X',{exact:true})).toHaveValue('-30');
  await page.getByRole('button',{name:'試遊',exact:true}).click();
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await useDragLook(page);
  await page.getByRole('button',{name:/出撃する/}).click();
  await expect(page.locator('#audio-telemetry')).toHaveAttribute('data-ready','true',{timeout:20_000});
  await expect(page.locator('#audio-telemetry')).toHaveAttribute('data-playing','true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#audio-telemetry')).toHaveAttribute('data-playing','false');
  await page.getByRole('button',{name:'編集に戻る',exact:true}).click();
  await expect(page.getByLabel('位置 X',{exact:true})).toHaveValue('-30');
  expect(errors).toEqual([]);
});

test('import rejects invalid contracts; valid short mission times out, pauses and retries',async({page})=>{
  test.setTimeout(120_000);
  await page.goto('/scene-editor.html');
  const doc=defaultScene();doc.mission.timeLimit=10;
  const load=async(value:unknown)=>page.getByLabel('シーンJSONを読み込む').setInputFiles({name:'scene.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await load({...doc,version:99});
  await expect(page.getByRole('alert')).toContainText('設定が不正');
  await load(doc);
  await expect(page.getByLabel('制限時間（秒）')).toHaveValue('10');
  await page.getByRole('button',{name:'試遊',exact:true}).click();
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await useDragLook(page,false);
  await page.getByRole('button',{name:/出撃する/}).click();
  await expect(page.locator('#mission-telemetry')).toHaveAttribute('data-phase','playing');
  await page.keyboard.press('Escape');
  const elapsed=await page.locator('#mission-telemetry').getAttribute('data-elapsed');
  await page.waitForTimeout(250);
  expect(await page.locator('#mission-telemetry').getAttribute('data-elapsed')).toBe(elapsed);
  await page.getByRole('button',{name:/操作を再開/}).click();
  await expect(page.getByRole('heading',{name:'UNIT LOST'})).toBeVisible({timeout:60_000});
  await expect(page.locator('.subtitle')).toContainText('制限時間');
  await page.getByRole('button',{name:/再出撃する/}).click();
  await expect(page.locator('#mission-telemetry')).toHaveAttribute('data-phase','playing');
  expect(Number(await page.locator('#mission-telemetry').getAttribute('data-elapsed'))).toBeLessThan(2);
});

test('action preview supports silent backwards seeking and damage editing',async({page})=>{
  await page.goto('/scene-editor.html');
  await page.getByRole('button',{name:'攻撃・エフェクト',exact:true}).click();
  await expect(page.getByRole('region',{name:'攻撃プレビュー'})).toHaveAttribute('data-ready','true');
  const seek=async(value:string)=>page.getByLabel('攻撃の時間').fill(value);
  await seek('0.5');
  await expect(page.getByTestId('attack-result')).toHaveAttribute('data-hits','1');
  await seek('0');
  await expect(page.getByTestId('attack-result')).toHaveAttribute('data-shots','0');
  await page.getByLabel('ダメージ',{exact:true}).fill('180');
  await seek('0.5');
  await expect(page.getByTestId('attack-result')).toHaveAttribute('data-hp','0');
  await page.screenshot({path:'test-results/attack-preview.png'});
});

test('three imported waves reach victory through real rifle hits and restart cleanly',async({page})=>{
  test.setTimeout(120_000);
  const doc=defaultScene();doc.stage.solids=[];doc.action.damage=180;
  doc.stage.targets=[0,1,2].map(i=>({id:`T-${i}`,position:[0,0,-10],yaw:Math.PI}));
  doc.mission.waves=doc.stage.targets.map((t,i)=>({id:`w-${i}`,targets:[t.id]}));
  await page.goto('/scene-editor.html');
  await page.getByLabel('シーンJSONを読み込む').setInputFiles({name:'mission.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await expect(page.getByRole('status')).toContainText('読み込みました');
  await page.getByRole('button',{name:'試遊',exact:true}).click();
  await expect(page.locator('.arena')).toHaveAttribute('data-ready','true',{timeout:30_000});
  await useDragLook(page,false);
  await page.getByRole('button',{name:/出撃する/}).click();
  for(let wave=0;wave<3;wave++) {
    const marker=page.locator(`[data-target="T-${wave}"]`);
    await expect(marker).toBeVisible({timeout:10_000});
    for(let attempt=0;attempt<8;attempt++) {
      if(Number(await page.locator('#combat-telemetry').getAttribute('data-kills'))>wave)break;
      const box=await marker.boundingBox();if(!box)continue;
      const dx=box.x+box.width/2-640,dy=box.y+box.height/2-450;
      await page.mouse.move(640,450);await page.mouse.down({button:'right'});
      await page.mouse.move(640+dx*.6,450+dy,{steps:3});await page.mouse.up({button:'right'});
      await page.mouse.down();await page.waitForTimeout(250);await page.mouse.up();
    }
    await expect.poll(async()=>Number(await page.locator('#combat-telemetry').getAttribute('data-kills'))).toBeGreaterThan(wave);
  }
  await expect(page.getByRole('heading',{name:'MISSION COMPLETE',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/もう一度出撃する/}).click();
  await expect(page.locator('#mission-telemetry')).toHaveAttribute('data-wave','1');
  await expect(page.locator('#combat-telemetry')).toHaveAttribute('data-kills','0');
});
