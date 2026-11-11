const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const KEY='cockpit_clinique_v1_data';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 try {
  const page=await browser.newPage({viewport:{width:820,height:1180},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=process.env.APP_URL||'http://127.0.0.1:8000/';
  const db=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  const select=async(name,value)=>page.locator(`[data-session-choice="${name}"] button[data-value="${value}"]`).click();
  const save=()=>page.locator('#sessionForm button[type=submit]').click();
  const close=()=>page.locator('[data-close]').click();
  const current=async()=>(await db()).cases.at(-1);
  const review=async(template,mode)=>{for(const width of [1440,1180,820,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),mode+' '+width);if(mode==='open'){await page.locator('.session-open').scrollIntoViewIfNeeded();assert.equal(await page.locator('.session-open .session-kpi').count(),0);}else{assert(await page.locator('#sessionForm').evaluate(el=>el.scrollWidth<=el.clientWidth),mode+' form '+width);await page.locator('#modal').evaluate(el=>el.scrollTop=0);}await page.screenshot({path:`${screenshotDir}/${template}-${width}-${mode}.png`,fullPage:false});}};
  await page.goto(url);
  await page.locator('#newPatientBtn').click();await page.locator('[name=name]').fill('Suivi longitudinal');await page.locator('#patientForm button[type=submit]').click();
  const screenshotDir=process.env.UI_SCREENSHOT_DIR||'/tmp/cockpit-session-review';fs.mkdirSync(screenshotDir,{recursive:true});
  for(const template of ['CHEVILLE','GENOU','LCA']) {
   await page.locator('#newCaseBtn').click();await page.locator('[name=templateId]').selectOption(template);
   if(template==='LCA')await page.locator('[name=side]').selectOption('Gauche');
   await page.locator('#caseForm button[type=submit]').click();
   const baseline=await db();
   await page.locator('#quickSessionBtn').click();
   assert.equal(await page.locator('#sessionForm #sessionCheckinTitle').innerText(),'Check-in');
   await review(template,'checkin');
   for(const name of ['sessionWork','painMax','rpe','goalAchievement','decision'])assert.equal(await page.locator(`#sessionForm [name=${name}]`).count(),0);
   await select('evolution','Mieux');await select('evolution','Stable');
   assert.equal(await page.locator('[data-session-choice=evolution] [aria-pressed=true]').count(),1);
   await select('evolution','Stable');assert.equal(await page.locator('[name=evolution]').inputValue(),'');await select('evolution','Mieux');
   await select('reaction24h','Bonne');await select('adherenceCheckin','Fait');
   await page.locator('[name=note]').fill('Reprise entraînement collectif');
   if(template==='LCA'){const marker=page.locator('[name="clinicalValues.reactionStatus"]');await marker.locator('xpath=ancestor::details').evaluate(el=>el.open=true);await marker.selectOption('pass');await page.locator('[name="clinicalValues.weightBearing"]').fill('Source structurée conservée');}
   await save();
   let open=(await current()).sessions[0];assert.equal(open.status,'open');assert.equal(open.n,1);
   for(const key of ['sessionWork','painMax','rpe','goalAchievement','decision'])assert(!Object.hasOwn(open,key));
   assert.equal(await page.locator('.session-open').count(),1);assert.equal(await page.locator('.session-end-kpis').count(),0);
   await review(template,'open');
   assert.equal(await page.locator('#addSession').innerText(),'Reprendre / clôturer la séance en cours');
   const storedOpen=await db();await page.reload();assert.deepEqual(await db(),storedOpen);
   await page.locator('[data-patient]').click();await page.locator('[data-case]').last().click();await page.locator('[data-tab=sessions]').click();
   await page.locator('#quickSessionBtn').click();assert.equal(await page.locator('#sessionForm h2').innerText(),'Fin de séance');
   assert.equal(await page.locator('#sessionForm [name=evolution]').count(),0);assert.equal(await page.locator('#sessionForm [name=note]').count(),0);await close();
   assert.equal((await current()).sessions.length,1);assert.equal((await current()).sessions[0].status,'open');
   await page.locator(`[data-edit-session="${open.id}"]`).click();await page.locator('[name=note]').fill('Reprise entraînement collectif');await save();assert.equal((await current()).sessions.length,1);
   await page.locator('[data-close-session]').click();
   await review(template,'checkout');
   assert.equal(await page.getByLabel('RPE séance').count(),1);assert.equal(await page.locator('#sessionForm .session-end-inputs > *').count(),3);
   assert.equal(await page.locator('#sessionForm .session-clinical').count(),0);
   await page.locator('[name=sessionWork]').fill('Presse unilatérale · Split squat · Pogos · Course 2 × 8 min');
   await page.locator('[name=painMax]').fill('11');assert.equal(await page.locator('[name=painMax]').evaluate(el=>el.checkValidity()),false);
   await page.locator('[name=painMax]').fill('2');await page.locator('[name=rpe]').fill('7');await select('goalAchievement','Partiellement');
   await page.locator('[name=decision]').fill('Augmenter la charge prochaine séance');await save();
   const closed=(await current()).sessions[0];assert.equal(closed.status,'closed');for(const key of ['id','n','date','evolution','reaction24h','adherenceCheckin','note','clinicalValues'])assert.deepEqual(closed[key],open[key]);assert.equal((await current()).sessions.length,1);
   let c=await current(),full=c.sessions[0];
   for(const [key,value] of Object.entries({evolution:'Mieux',reaction24h:'Bonne',adherenceCheckin:'Fait',painMax:2,rpe:7,goalAchievement:'Partiellement',decision:'Augmenter la charge prochaine séance'}))assert.equal(full[key],value);
   assert.equal(await page.locator('.session-end-kpis .session-kpi').count(),3);
   await page.getByText('2/10',{exact:true}).waitFor();await page.getByText('7/10',{exact:true}).waitFor();
   // An entirely optional session must save without invented default values.
   await page.locator('#quickSessionBtn').click();await save();assert.equal((await current()).sessions[1].status,'open');await page.locator('[data-close-session]').click();await save();c=await current();const partial=c.sessions[1];
   for(const key of ['evolution','reaction24h','adherenceCheckin','sessionWork','goalAchievement','decision','note'])assert.equal(partial[key],'');
   assert.equal(partial.painMax,null);assert.equal(partial.rpe,null);
   await page.locator(`[data-edit-session="${partial.id}"]`).click();await page.locator('[name=painMax]').fill('0');await page.locator('[name=rpe]').fill('0');await select('goalAchievement','Non');await save();
   const zero=(await current()).sessions[1];assert.equal(zero.painMax,0);assert.equal(zero.rpe,0);assert.equal(zero.goalAchievement,'Non');
   assert.equal(await page.locator('.session-card').filter({has:page.locator(`[data-edit-session="${partial.id}"]`)}).locator('.session-kpi .badge.a').innerText(),'Non');
   await page.locator(`[data-edit-session="${full.id}"]`).click();
   assert.equal(await page.locator('[name=painMax]').inputValue(),'2');assert.equal(await page.locator('[name=rpe]').inputValue(),'7');
   await select('goalAchievement','Oui');await page.locator('[name=decision]').fill('Maintenir le volume');await save();
   const changed=(await current()).sessions[0];assert.equal(changed.id,full.id);assert.equal(changed.date,full.date);assert.equal(changed.n,full.n);assert.equal(changed.goalAchievement,'Oui');
   // Insert genuine legacy shapes; reading must never rewrite the stored database.
   const legacy={id:'legacy-'+template,n:20,date:'2026-10-01T10:00:00.000Z',pain:'↑ pire',symptoms:['Symptôme historique inédit'],exposure:['Course','Terrain spécifique'],tolerance:['Réaction >24 h'],adherence:['Partielle'],decision:'Retester',note:'Note historique',customData:{preserved:true},clinicalValues:{reactionStatus:'unknown',customMarker:'conserver'}};
   const numeric={id:'numeric-'+template,n:21,date:'2026-10-02T10:00:00.000Z',pain:'3',symptoms:[],exposure:[],tolerance:[],adherence:['Consignes respectées','Auto-charge excessive'],decision:'Maintenir',note:''};
   await page.evaluate(([key,legacy,numeric])=>{const data=JSON.parse(localStorage.getItem(key));data.cases.at(-1).sessions.push(legacy,numeric);localStorage.setItem(key,JSON.stringify(data));},[KEY,legacy,numeric]);
   const beforeReload=await db();await page.reload();assert.deepEqual(await db(),beforeReload);
   await page.locator('[data-patient]').click();await page.locator('[data-case]').last().click();await page.locator('[data-tab=sessions]').click();
   const legacyCard=page.locator('.session-card').filter({has:page.locator(`[data-edit-session="${legacy.id}"]`)});
   assert.equal(await legacyCard.locator('.session-kpi').first().innerText(),'Douleur max\n—');
   await legacyCard.locator('summary').click();await legacyCard.getByText('↑ pire',{exact:false}).waitFor();await legacyCard.getByText('Symptôme historique inédit',{exact:false}).waitFor();
   await page.locator(`[data-edit-session="${legacy.id}"]`).click();
   assert.equal(await page.locator('[name=painMax]').inputValue(),'');assert.equal(await page.locator('[name=evolution]').inputValue(),'');assert.equal(await page.locator('[name=reaction24h]').inputValue(),'');assert.equal(await page.locator('[name=adherenceCheckin]').inputValue(),'Partiel');assert.equal(await page.locator('[name=sessionWork]').inputValue(),'Course · Terrain spécifique');
   await page.locator('[name=painMax]').fill('4');await save();
   let edited=(await current()).sessions.find(s=>s.id===legacy.id);for(const key of Object.keys(legacy))assert.deepEqual(edited[key],legacy[key]);assert.equal(edited.painMax,4);
   await page.locator(`[data-edit-session="${numeric.id}"]`).click();assert.equal(await page.locator('[name=painMax]').inputValue(),'3');assert.equal(await page.locator('[name=adherenceCheckin]').inputValue(),'');
   await page.locator('[name=painMax]').fill('');await save();assert.equal((await current()).sessions.find(s=>s.id===numeric.id).pain,'3');assert.equal((await current()).sessions.find(s=>s.id===numeric.id).painMax,null);
   for(const width of [1440,1180,820,390]) {
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),template+' timeline '+width);
    await page.screenshot({path:`${screenshotDir}/${template}-${width}-timeline.png`,fullPage:true});
    await page.locator(`[data-edit-session="${full.id}"]`).click();
    await page.locator('[name=note]').fill('CommentaireSansEspace'.repeat(40));await page.locator('[name=sessionWork]').fill('TravailLongSansEspace'.repeat(30));
    assert(await page.locator('#sessionForm').evaluate(el=>el.scrollWidth<=el.clientWidth),template+' form '+width);
    assert(await page.locator('#sessionForm').evaluate(el=>[...el.querySelectorAll('input,textarea,button')].filter(x=>x.getClientRects().length).every(x=>x.getBoundingClientRect().right<=innerWidth)),template+' controls '+width);
    await page.screenshot({path:`${screenshotDir}/${template}-${width}-form.png`,fullPage:true});await close();
   }
   page.once('dialog',d=>d.dismiss());await page.locator(`[data-delete-session="${partial.id}"]`).click();assert((await current()).sessions.some(s=>s.id===partial.id));
   page.once('dialog',d=>d.accept());await page.locator(`[data-delete-session="${partial.id}"]`).click();assert(!(await current()).sessions.some(s=>s.id===partial.id));
   const result=await db();for(let i=0;i<result.cases.length;i++){const before={...baseline.cases[i]},after={...result.cases[i]};if(i===result.cases.length-1){delete before.sessions;delete after.sessions;delete before.updatedAt;delete after.updatedAt;}assert.deepEqual(after,before);}
   await page.locator('#backBtn').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS: 3 templates, check-in/open/reload/check-out on one record, no duplicate open session, full/empty sessions, three KPIs, single-select/deselect, bounds, edit/delete/cancel, legacy qualitative/numeric compatibility, preservation of unknown data and other cases, reload and 4 responsive widths');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
