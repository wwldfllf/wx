// Run with Playwright CLI run-code --filename from the workspace root, with the studio open.
async page => {
  const site = new URL(page.url()).origin;
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.emulateMedia({colorScheme:'light', reducedMotion:'reduce'});
  await page.goto(site + '/#studio');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#statusText').textContent === '图片服务已连接');
  const theme = page.getByRole('combobox', {name:'页面主题'});
  const originalTheme = await theme.inputValue();
  await theme.selectOption({label:'浅色'});
  const measure = () => page.evaluate(() => {
    const box = s => document.querySelector(s).getBoundingClientRect();
    const panel = box('#generateForm');
    const stage = box('#resultStage');
    const pane = box('.workspace');
    return {
      horizontalUse: Math.round(pane.width / innerWidth * 1000) / 10,
      bottomMargin: Math.round(innerHeight - stage.bottom),
      leftWidth: Math.round(panel.width),
      stageWidth: Math.round(stage.width),
      stageHeight: Math.round(stage.height),
      columnsStartTogether: Math.abs(panel.top - box('#imagePlatformPane .result-panel').top) < 2,
      browserWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      submitBottom: Math.round(box('#submitButton').bottom),
      previewBelow: stage.top > panel.bottom,
      aligned: Math.abs(box('#sizeMenuButton').top - box('#resolutionMenuButton').top) <= 1 && Math.abs(box('#qualityMenuButton').top - box('#formatMenuButton').top) <= 1
    };
  });
  const setViewport = async (width, height) => {
    await page.setViewportSize({width,height});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  // All four generation parameters must share the trigger and popover, not just an arrow.
  await setViewport(1440,930);
  for (const name of ['size','resolution','quality','format']) {
    const trigger = page.locator(`#${name}MenuButton`);
    assert(await trigger.count() === 1, `${name} still lacks the shared dropdown trigger`);
    await trigger.press('ArrowDown');
    const menu = page.locator(`#${name}MenuList`);
    assert(await menu.isVisible() && await menu.getByRole('option', {selected:true}).count() === 1, `${name} lacks shared list or selection state`);
    assert(await menu.evaluate(el => el.classList.contains('glass-select-popover')), `${name} is not using the shared popover styling`);
    await page.keyboard.press('Escape');
    assert(await trigger.getAttribute('aria-expanded') === 'false', `${name} must close with Escape`);
  }
  const resolution = page.locator('#resolutionMenuButton');
  await resolution.press('ArrowUp');
  await page.keyboard.press('Enter');
  assert((await resolution.innerText()).includes('最高'), 'Resolution must update the trigger after keyboard selection');
  assert(await page.locator('#resolution').inputValue() === '2048x2048', 'Resolution selection must reach the backend field');
  await resolution.click();
  await page.screenshot({path:'outputs/unified-resolution-menu.png',animations:'disabled'});
  await page.keyboard.press('Escape');
  const desktop = [];
  for (const [width, height] of [[1440,930],[1920,1080],[1366,768],[900,900]]) {
    await setViewport(width,height);
    desktop.push({width,height,...await measure()});
  }
  await setViewport(390,844);
  const mobile = await measure();
  for (const m of desktop) {
    assert(m.horizontalUse >= 95, `Workspace must occupy at least 95% of desktop width: ${JSON.stringify(m)}`);
    assert(m.bottomMargin <= 50 && m.bottomMargin >= 8, `Empty preview must fill the desktop height with a narrow bottom margin: ${JSON.stringify(m)}`);
    assert(m.stageWidth > m.leftWidth && m.leftWidth <= 490 && m.columnsStartTogether && m.aligned && m.scrollWidth === m.browserWidth, `Column proportions or alignment failed: ${JSON.stringify(m)}`);
  }
  assert(mobile.previewBelow && mobile.submitBottom <= 740 && mobile.scrollWidth === 390, `Mobile form layout regressed: ${JSON.stringify(mobile)}`);
  assert(await page.getByRole('tab', {name:'视频生成（暂未开放）'}).isDisabled(), 'Video must stay visible but closed');
  await page.screenshot({path:'outputs/paper-studio-mobile.png', animations:'disabled'});
  await setViewport(1440,930);
  await page.screenshot({path:'outputs/paper-studio-light.png', animations:'disabled'});
  await theme.selectOption({label:'深色'});
  await page.screenshot({path:'outputs/paper-studio-dark.png', animations:'disabled'});
  await page.reload();
  assert(await page.locator('html').getAttribute('data-theme') === 'dark', 'Theme preference should survive a reload');
  await theme.selectOption({label:'浅色'});
  await setViewport(1366,768);
  const scrollBeforeMenu = await page.evaluate(() => scrollY);
  const menuTrigger = page.locator('#sizeMenuButton');
  await menuTrigger.press('Enter');
  const menuBox = await page.locator('#sizeMenuList').boundingBox();
  assert(menuBox && menuBox.y >= 0 && menuBox.y + menuBox.height <= 768 && await page.evaluate(() => scrollY) === scrollBeforeMenu, 'Ratio popover must open inside the desktop viewport without scrolling the workbench');
  await page.keyboard.press('End');
  assert(await page.evaluate(() => {
    const row = document.activeElement;
    const list = document.querySelector('#sizeMenuList').getBoundingClientRect();
    return row.getAttribute('role') === 'option' && row.getBoundingClientRect().bottom <= list.bottom;
  }), 'The focused option should scroll into view within the list');
  await page.keyboard.press('Escape');
  assert(await menuTrigger.getAttribute('aria-expanded') === 'false', 'Escape must close the popover');
  await setViewport(1440,930);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await menuTrigger.click();
  await page.getByRole('option', {name:/自定义/}).click();
  await page.locator('#customWidth').fill('1024');
  await page.locator('#customHeight').fill('768');
  await page.locator('#qualityMenuButton').click();
  await page.getByRole('option', {name:'中 · 标准'}).click();
  await page.locator('#formatMenuButton').click();
  await page.getByRole('option', {name:/WebP/}).click();
  await page.locator('#prompt').fill('暖白纸面上，一扇砂岩拱门和它后面的陶红夕阳。');
  let payload;
  const makeFixture = size => page.evaluate(async ({width,height,illustration}) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (illustration) {
      const image = new Image();
      image.src = '/assets/atelier/quiet-arch.svg';
      await image.decode();
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#a45035';
      ctx.fillRect(0, 0, width, height);
    }
    return canvas.toDataURL('image/png');
  }, size);
  let artwork = await makeFixture({width:960,height:540,illustration:true});
  const result = page.locator('#resultImage');
  await page.route('**/api/generate-stream', async route => {
    payload = route.request().postData();
    await route.fulfill({
      contentType:'application/x-ndjson',
      body:JSON.stringify({type:'done',result:{images:[{src:artwork,mimeType:'image/png'}],model:'gpt-image-2.6',size:'1024x768'}})+'\n'
    });
  });
  try {
    await page.locator('#submitButton').click();
    await result.waitFor();
    await result.evaluate(img => img.decode());
    await page.waitForFunction(() => document.querySelector('#resultImage').classList.contains('reveal'));
    assert(await result.evaluate(img => getComputedStyle(img).animationName) === 'atelier-print-reveal', 'Print reveal animation was lost');
    assert(['1024x768','medium','webp'].every(v => payload?.includes(v)), 'Custom dimensions, quality and format should still be sent');
    const fitsPrint = () => result.evaluate(img => {
      const image = img.getBoundingClientRect();
      const stage = img.parentElement.getBoundingClientRect();
      return getComputedStyle(img).objectFit === 'contain' && img.naturalWidth > 0 &&
        image.left > stage.left && image.right < stage.right && image.top > stage.top && image.bottom < stage.bottom;
    });
    await result.evaluate(img => Promise.all(img.getAnimations().map(animation => animation.finished)));
    await page.evaluate(() => scrollTo(0, 0));
    assert(await fitsPrint(), 'Landscape artwork must fit inside the preview with no crop');
    await page.screenshot({path:'outputs/paper-studio-preview.png',animations:'disabled'});
    const download = page.waitForEvent('download', {timeout:5000});
    await page.locator('#downloadButton').click();
    assert((await download).suggestedFilename().endsWith('.webp'), 'The selected WebP download should work');
    artwork = await makeFixture({width:640,height:1280});
    await setViewport(390,844);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#submitButton').click();
    await page.waitForFunction(() => document.querySelector('#resultImage').naturalHeight === 1280);
    await result.evaluate(img => img.decode());
    assert(await fitsPrint(), 'Portrait artwork must fit the mobile preview with no crop');
  } finally {
    await page.unroute('**/api/generate-stream');
  }
  await setViewport(320,800);
  await page.goto(site + '/?qa=compact-menus#studio');
  await theme.selectOption({label:'深色'});
  await page.waitForFunction(() => document.querySelector('#statusText').textContent === '图片服务已连接');
  for (const name of ['size','resolution','quality','format']) {
    const trigger = page.locator(`#${name}MenuButton`);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.press('ArrowDown');
    const bounds = await page.locator(`#${name}MenuList`).boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320.5, `${name} list overflows on a 320px viewport`);
    if (name === 'resolution') {
      const allSingleLine = await page.locator('#resolutionMenuList .glass-select-option strong').evaluateAll(labels =>
        labels.every(label => label.getBoundingClientRect().height <= parseFloat(getComputedStyle(label).lineHeight) + 1)
      );
      assert(allSingleLine, 'Resolution tiers should fit on one line even on a narrow screen');
    }
    if (name === 'quality') await page.screenshot({path:'outputs/unified-quality-menu-mobile.png',animations:'disabled'});
    await page.keyboard.press('Escape');
  }
  assert(await page.locator('#modelMenu').isHidden(), 'Single-model mode should remain read-only');
  const caps = await (await page.request.get(`${site}/api/capabilities`)).json();
  const fallback = {id:'gpt-image-2',label:'GPT Image 2',sizes:['1024x1024','1536x1024'],qualities:['gateway-default'],formats:['png']};
  await page.route('**/api/capabilities', route => route.fulfill({json:{...caps, models:[...caps.models.filter(model => model.id !== fallback.id), fallback]}}));
  try {
    await page.reload();
    const modelTrigger = page.locator('#modelMenuButton');
    await modelTrigger.click();
    await page.getByRole('option', {name:fallback.label,exact:true}).click();
    assert(await page.locator('#resolutionField').isHidden(), 'The basic model must not show unsupported resolution tiers');
    assert(await page.locator('#qualityMenuButton').isDisabled(), 'One available quality should not open a menu');
    await modelTrigger.click();
    await page.getByRole('option', {name:'GPT Image 2.6',exact:true}).click();
    assert(await page.locator('#resolutionMenuButton').isEnabled(), 'Switching back must restore the shared resolution menu');
  } finally {
    await page.unroute('**/api/capabilities');
    await theme.selectOption(originalTheme);
  }
  return {desktop,mobile,preview:'Mocked landscape and portrait, print reveal and WebP download passed'};
}
