// Verify the reference-inspired navigation uses existing clinical records unchanged.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
 try {
  const page=await browser.newPage({viewport:{width:1180,height:900}});
  await page.goto(process.env.APP_URL||'http://127.0.0.1:8000');
  const db=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cockpit_clinique_v1_data')));
  await page.locator('#listNewPatient').click();
  await page.locator('[name=name]').fill('Martin Leroy');
  await page.locator('#patientForm button[type=submit]').click();
  await page.locator('#newCaseBtn').click();
  await page.locator('[name=templateId]').selectOption('GENOU');
  await page.locator('[name=title]').fill('Rééducation du genou droit');
  await page.locator('#caseForm button[type=submit]').click();
  await page.locator('#quickPivotBtn').click();
  await page.locator('[name=test]').selectOption('Quadriceps');
  await page.locator('[name="quadriceps.affected"]').fill('600');
  await page.locator('[name="quadriceps.contralateral"]').fill('700');
  await page.locator('[name=chosenStatus]').selectOption('B');
  await page.locator('[name=decision]').fill('Adapter la charge selon la tolérance');
  await page.locator('#pivotForm button[type=submit]').click();
  const before=await db(),record=before.cases[0].pivots[0];
  await page.locator('[data-tab=qualities]').click();
  await page.locator('[data-quality-link=strength]').click();
  await page.locator('#selectedPivotPanel').getByText('Quadriceps',{exact:true}).waitFor();
  assert.equal(await page.locator('#selectedPivotPanel .status-letter').innerText(),'B');
  await page.locator('[data-focus-edit]').click();
  assert.equal(await page.locator('[name="quadriceps.affected"]').inputValue(),'600');
  await page.locator('[data-close]').click();
  await page.locator('[data-focus-add]').click();
  assert.equal(await page.locator('[name=qualityId]').inputValue(),'strength');
  await page.locator('[data-close]').click();
  assert.deepEqual(await db(),before);
  await page.locator('[data-tab=pivots]').click();
  await page.locator('[data-pivot-filter=strength]').click();
  assert.equal(await page.locator('[data-edit-pivot="'+record.id+'"]').count(),1);
  await page.locator('[data-route=archives]').click();
  await page.locator('#templateFilter').selectOption('LCA');
  assert.equal(await page.locator('[data-patient]').count(),0);
  await page.locator('#templateFilter').selectOption('GENOU');
  assert.equal(await page.locator('[data-patient]').count(),1);
  assert.equal(await page.locator('#patientCount').innerText(),'1 patient(s)');
  assert.deepEqual(await db(),before);
  console.log('PASS: template filters, selected pivot panel, existing-record edit, new measurement quality, unchanged storage');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
