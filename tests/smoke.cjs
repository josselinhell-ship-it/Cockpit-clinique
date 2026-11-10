// Run with Node and Playwright available in the development environment.
// Start: python3 -m http.server 8000 --bind 127.0.0.1
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const KEY = 'cockpit_clinique_v1_data';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true});
  try {
    const context = await browser.newContext({viewport:{width:820,height:1180},hasTouch:true});
    let page = await context.newPage();
    const errors = [];
    const attach = p => p.on('pageerror', e => errors.push(e.message)); attach(page);
    const go = () => page.goto(process.env.APP_URL || 'http://127.0.0.1:8000/');
    const db = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)),KEY);
    await go();
    await page.locator('#newPatientBtn').click();
    await page.locator('[name=name]').fill('Patient test');
    await page.locator('#patientForm button[type=submit]').click();
    assert.equal((await db()).cases.length,0);
    const createCase = async title => {
      await page.locator('#newCaseBtn').click();
      assert.equal(await page.locator('[name=templateId] option').count(),2);
      await page.locator('[name=title]').fill(title);
      await page.locator('[name=side]').selectOption('Droit');
      await page.locator('[name=subtype]').selectOption('Syndesmose');
      await page.locator('[name=objective]').fill('Reprise course');
      await page.locator('#caseForm button[type=submit]').click();
    };
    await createCase('Premier épisode');
    await page.locator('[data-tab=qualities]').click();
    for (const status of ['A','B','C']) await page.locator(`[data-quality=mobility][data-status=${status}]`).click();
    await page.locator('#quickSessionBtn').click();
    await page.locator('[data-chip-group=symptoms] .chip').first().click();
    await page.locator('[name=note]').fill('Séance test');
    await page.locator('#sessionForm button[type=submit]').click();
    await page.locator('#quickPivotBtn').click();
    await page.locator('[name=result]').fill('9 cm');
    await page.locator('#pivotForm button[type=submit]').click();
    const first = (await db()).cases[0];
    assert.equal(first.qualityStatus.mobility,'C'); assert.equal(first.statusHistory.length,3);
    assert.equal(first.sessions[0].note,'Séance test'); assert.equal(first.pivots[0].result,'9 cm');
    assert(!('sessions' in (await db()).patients[0]));
    await page.close(); page = await context.newPage(); attach(page); await go();
    await page.locator('[data-patient]').click(); await page.locator('[data-case]').click();
    await page.locator('#editPatientBtn').click(); page.once('dialog', d => d.accept()); await page.locator('#archiveCaseBtn').click();
    await createCase('Deuxième épisode');
    let saved = await db(); assert.equal(saved.patients.length,1); assert.equal(saved.cases.length,2);
    assert.equal(saved.cases[0].status,'archived'); assert.equal(saved.cases[1].status,'active');
    assert.deepEqual(saved.cases[0].sessions,first.sessions); assert.equal(saved.cases[1].sessions.length,0);
    assert.equal(saved.cases[1].qualityStatus.mobility,'D');
    await page.locator('#backBtn').click(); await page.locator('#backBtn').click();
    assert.equal(await page.locator('[data-patient]').count(),1);
    // Export / restore v2 with a full copy kept before replacement.
    await page.locator('#settingsBtn').click();
    const download = page.waitForEvent('download'); await page.locator('#exportBtn').click();
    const file = await download; const path = await file.path();
    page.on('dialog', d => d.accept());
    await page.locator('#importInput').setInputFiles(path);
    await page.locator('#modal').waitFor({state:'hidden'});
    assert.deepEqual((await db()).cases,saved.cases);
    // Old data: active and archived patients, full histories and unknown fields.
    const legacy = {version:1,patients:[{id:'old',name:'Ancien',lesion:'Médiale',context:'Diagnostic',objective:'Objectif',targetFunction:'Marche',constraints:'Notes',archived:false,createdAt:'2025-01-01',updatedAt:'2025-01-02',status:{mobility:'A'},statusHistory:[{id:'h',qualityId:'mobility',from:'D',to:'A',date:'2025-01-02'}],sessions:first.sessions,pivots:first.pivots,custom:'préserver'}, {id:'old-archive',name:'Archive',archived:true,status:{},sessions:[],pivots:[],statusHistory:[]}]};
    await page.evaluate(([key,value])=>localStorage.setItem(key,JSON.stringify(value)),[KEY,legacy]); await page.reload();
    saved = await db(); assert.equal(saved.version,2); assert.equal(saved.cases.length,2);
    assert.equal(saved.cases[0].subtype,'Médiale'); assert.equal(saved.cases[0].qualityStatus.mobility,'A');
    for(const field of ['context','objective','targetFunction','constraints','sessions','pivots','statusHistory','custom']) assert.deepEqual(saved.cases[0][field],legacy.patients[0][field]);
    assert.deepEqual(saved.legacySnapshot,legacy); assert.equal(saved.cases[1].status,'archived');
    await page.reload(); assert.deepEqual(await db(),saved);
    // Legacy import also migrates and does not duplicate cases.
    await page.locator('#settingsBtn').click();
    await page.locator('#importInput').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
    await page.locator('#modal').waitFor({state:'hidden'}); assert.equal((await db()).cases.length,2);
    // Invalid input never overwrites stored data.
    await page.locator('#settingsBtn').click(); const before = await db();
    await page.locator('#importInput').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":2,"patients":[],"cases":[{}]}')});
    await page.getByText('Fichier de sauvegarde invalide',{exact:true}).waitFor(); assert.deepEqual(await db(),before);
    await page.locator('[data-close]').click();
    for(const width of [390,820,1180]) {await page.setViewportSize({width,height:900}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    assert.deepEqual(errors,[]);
    // Corrupt/future databases and full storage must never be silently reset.
    for (const raw of ['{invalid', JSON.stringify({version:99,patients:[]})]) {
      await page.evaluate(([key,value])=>localStorage.setItem(key,value),[KEY,raw]);
      await page.reload(); await page.getByText('Lecture ou migration impossible.',{exact:false}).waitFor();
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),raw);
    }
    const quotaContext = await browser.newContext(); const quotaPage = await quotaContext.newPage();
    await quotaPage.addInitScript(([key,legacy]) => {
      localStorage.setItem(key,JSON.stringify(legacy));
      Storage.prototype.setItem = function(){throw new DOMException('Full','QuotaExceededError');};
    },[KEY,legacy]);
    await quotaPage.goto(process.env.APP_URL || 'http://127.0.0.1:8000/');
    await quotaPage.getByText('Lecture ou migration impossible.',{exact:false}).waitFor();
    assert.deepEqual(await quotaPage.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY),legacy);
    await quotaContext.close();
    await context.close(); console.log('PASS: patient, two isolated cases, statuses/history, session, pivot, reopen, archive, export/import v1/v2, idempotent migration, preserved legacy data, invalid import, responsive layouts.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
