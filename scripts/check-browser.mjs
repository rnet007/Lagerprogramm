import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
const URL = process.env.BASE_URL || "http://127.0.0.1:5173",
  OUT = "/workspace/shared/lagerraum-tests";
await mkdir(OUT, { recursive: true });
const startedAt = new Date().toISOString();
for (const name of ["results.json", "failure.json", "failure.png"])
  await rm(`${OUT}/${name}`, { force: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const passed = [],
  errors = [];
let page, staticServer;
const pass = (name) => {
  passed.push(name);
  console.log("PASS:", name);
};
async function store() {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lagerraum-v2")));
}
async function active() {
  const s = await store();
  return s.warehouses.find((w) => w.id === s.activeId);
}
async function manager() {
  await page.getByRole("button", { name: /^Lagerverwaltung:/ }).click();
  return page.getByRole("dialog");
}
async function choose(name) {
  const d = await manager();
  await d
    .getByRole("button", { name: `Lager ${name} auswählen`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Lagerverwaltung: ${name}`, exact: true }),
  ).toBeVisible();
}
async function nav(name) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
async function sceneData(preview = false) {
  return page.evaluate((preview) => {
    const c = document.querySelector(
        preview ? ".draft-preview canvas" : ".viewport canvas",
      ),
      s = c?.__lagerScene;
    if (!s) return null;
    const slots = [],
      areas = [],
      racks = [];
    let selected = "";
    s.updateMatrixWorld(true);
    s.traverse((o) => {
      if (o.name.startsWith("slot:")) {
        const p = o.getWorldPosition(o.position.clone());
        slots.push({ ...o.userData, position: p.toArray() });
      }
      if (o.name.startsWith("area:"))
        areas.push({ ...o.userData, z: o.position.z });
      if (o.name.startsWith("rack:")) racks.push(o.userData);
      if (o.name === "selected-slot-outline")
        selected = o.parent.userData.slotId;
    });
    const cam = s.userData.renderCamera;
    return {
      slots,
      areas,
      racks,
      selected,
      fit: s.userData.cameraFit,
      camera: cam?.position.toArray(),
    };
  }, preview);
}
async function waitSlots(n, preview = false) {
  await expect
    .poll(async () => (await sceneData(preview))?.slots.length, {
      timeout: 20000,
    })
    .toBe(n);
}
async function fitCheck() {
  const result = await page.evaluate(() => {
    const c = document.querySelector(".viewport canvas"),
      s = c.__lagerScene,
      cam = s.userData.renderCamera,
      b = s.userData.cameraFit.bounds;
    const points = [];
    cam.updateMatrixWorld();
    for (const x of [b.minX, b.maxX])
      for (const y of [b.minY, b.maxY])
        for (const z of [b.minZ, b.maxZ]) {
          const p = cam.position.clone().set(x, y, z).project(cam);
          points.push([p.x, p.y, p.z]);
        }
    return points;
  });
  assert.ok(
    result.every(
      (p) => Math.abs(p[0]) <= 1.01 && Math.abs(p[1]) <= 1.01 && p[2] < 1,
    ),
    "actual rendered camera must fit rack bounds",
  );
}
async function search(number, code) {
  await page.getByLabel("Zentrale Suche").fill(number);
  await page
    .locator(".search-results button")
    .filter({ has: page.locator("b", { hasText: code }) })
    .click();
  await expect(
    page.getByRole("heading", { name: code, exact: true }),
  ).toBeVisible();
  await expect.poll(async () => (await sceneData())?.selected).not.toBe("");
}
async function rackFields(
  d,
  {
    name = "Prüfregal",
    number = "1",
    width = "4",
    height = "2.4",
    depth = "1",
    cols = "4",
    levels = "3",
  } = {},
) {
  for (const [label, v] of [
    ["Regalname", name],
    ["Regalnummer", number],
    ["Breite (m)", width],
    ["Höhe (m)", height],
    ["Tiefe (m)", depth],
    ["Spalten Bereich 1", cols],
    ["Ebenen Bereich 1", levels],
  ])
    await d.getByLabel(label, { exact: true }).fill(v);
}
try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await waitSlots(300);
  const legacy = (await active()).data;
  legacy.stock[0].quantity = 713;
  legacy.materials[0].name = "Erhaltenes Beispielmaterial";
  const legacyRaw = JSON.stringify(legacy);
  await page.evaluate((raw) => {
    localStorage.setItem("lagerraum-v1", raw);
    localStorage.removeItem("lagerraum-v2");
  }, legacyRaw);
  await page.reload();
  await waitSlots(300);
  assert.deepEqual((await active()).data, legacy);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("lagerraum-v1")),
    legacyRaw,
  );
  assert.equal((await store()).warehouses.length, 3);
  await fitCheck();
  await page.screenshot({ path: `${OUT}/01-gesamtansicht.png` });
  pass(
    "Migration erhält bestehende Daten, Bestände und IDs; initiale Kamera zeigt alle Regale",
  );
  await search("0087050842", "55R3H42");
  await expect
    .poll(async () =>
      page
        .locator(".viewport canvas")
        .evaluate((c) =>
          Math.abs(
            c.__lagerScene.userData.renderCamera.aspect -
              c.getBoundingClientRect().width /
                c.getBoundingClientRect().height,
          ),
        ),
    )
    .toBeLessThan(0.001);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const selected = await page.evaluate(() => {
    const c = document.querySelector(".viewport canvas"),
      s = c.__lagerScene,
      cam = s.userData.renderCamera;
    let target;
    s.traverse((o) => {
      if (o.name === "selected-slot-outline") target = o.parent;
    });
    const p = target
        .localToWorld(
          target.position.clone().set(0, 0, target.userData.depth * 0.47),
        )
        .project(cam),
      rect = c.getBoundingClientRect();
    return {
      code: target.userData.code,
      x: rect.x + ((p.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - p.y) * rect.height) / 2,
    };
  });
  assert.equal(selected.code, "55R3H42");
  await page.mouse.move(selected.x, selected.y);
  await expect(page.getByRole("tooltip")).toContainText("55R3H42");
  await expect
    .poll(async () =>
      page
        .locator(".viewport canvas")
        .evaluate((e) => e.getBoundingClientRect().width),
    )
    .toBeLessThan(900);
  const narrowWidth = await page
    .locator(".viewport canvas")
    .evaluate((e) => e.getBoundingClientRect().width);
  await page.screenshot({ path: `${OUT}/02-suchtreffer.png` });
  await page.getByRole("button", { name: "Auswahl schließen" }).click();
  await expect
    .poll(async () =>
      page
        .locator(".viewport canvas")
        .evaluate((e) => e.getBoundingClientRect().width),
    )
    .toBeGreaterThan(narrowWidth + 200);
  pass(
    "Materialsuche hebt das richtige Fach hervor, Hover zeigt den Code; Schließen gibt Ansichtsbreite frei",
  );
  await choose("Testlager · Beispiel");
  assert.equal((await active()).data.racks.length, 1);
  assert.deepEqual((await active()).buildings, ["77"]);
  await expect(page.locator(".details")).toHaveCount(0);
  await expect(page.getByLabel("Zentrale Suche")).toHaveValue("");
  await nav("Materialien");
  await expect(page.getByText("TEST-0001", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Erhaltenes Beispielmaterial", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Zentrale Suche").fill("0087050842");
  await expect(page.locator(".search-results")).toContainText(
    "0 Lagerplätze gefunden",
  );
  await page.getByLabel("Zentrale Suche").fill("");
  let d = await manager();
  await d
    .getByRole("button", {
      name: "Lager Testlager · Beispiel umbenennen",
      exact: true,
    })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Lagername", { exact: true }).fill("Testlager · Getrennt");
  await d.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Lagerverwaltung: Testlager · Getrennt",
      exact: true,
    }),
  ).toBeVisible();
  await choose("Mein Lager");
  assert.deepEqual((await active()).data, legacy);
  pass(
    "Lagerwechsel trennt Gebäude, Kennzahlen, Materialien, Suche und Fachdetails; Umbenennung und Auswahl bleiben nach Neuladen erhalten",
  );
  d = await manager();
  await d.getByLabel("Name des neuen Lagers").fill("Prüflager");
  await d
    .getByRole("button", { name: "Lager hinzufügen", exact: true })
    .click();
  assert.equal((await active()).data.racks.length, 0);
  assert.equal((await active()).data.materials.length, 0);
  await nav("Lager bearbeiten");
  await page.getByRole("button", { name: "Gebäude hinzufügen" }).click();
  d = page.getByRole("dialog");
  await d.getByLabel("Gebäudecode").fill("99");
  await d.getByRole("button", { name: "Speichern", exact: true }).click();
  await page
    .getByRole("button", { name: "Regal hinzufügen", exact: true })
    .first()
    .click();
  d = page.getByRole("dialog");
  await rackFields(d, { width: "5", height: "2.8", depth: "1.2" });
  await d
    .getByRole("button", { name: "Bereich hinzufügen", exact: true })
    .click();
  await d.getByLabel("Name Bereich 2", { exact: true }).fill("Mitte");
  await d.getByLabel("Code-Kürzel Bereich 2", { exact: true }).fill("M");
  await d.getByLabel("Spalten Bereich 2", { exact: true }).fill("4");
  await d.getByLabel("Ebenen Bereich 2", { exact: true }).fill("2");
  await d
    .getByRole("button", { name: "Bereich hinzufügen", exact: true })
    .click();
  await d.getByLabel("Name Bereich 3", { exact: true }).fill("Hinten");
  await d.getByLabel("Code-Kürzel Bereich 3", { exact: true }).fill("H");
  await d.getByLabel("Spalten Bereich 3", { exact: true }).fill("4");
  await d.getByLabel("Ebenen Bereich 3", { exact: true }).fill("4");
  await expect(d.getByTestId("preview-summary")).toContainText("36 Fächer");
  await waitSlots(36, true);
  const draftScene = await sceneData(true);
  assert.equal(draftScene.racks[0].width, 5);
  assert.equal(draftScene.racks[0].height, 2.8);
  assert.equal(draftScene.racks[0].depth, 1.2);
  assert.deepEqual(
    draftScene.areas.map((a) => [a.columns, a.levels]),
    [
      [4, 3],
      [4, 2],
      [4, 4],
    ],
  );
  await d.getByRole("button", { name: "Vorschau 2D" }).click();
  await expect(d.locator(".slots-grid button")).toHaveCount(36);
  await page.screenshot({ path: `${OUT}/03-entwurf-2d.png` });
  await d.getByRole("button", { name: "Abbrechen", exact: true }).click();
  assert.equal((await active()).data.racks.length, 0);
  await page
    .getByRole("button", { name: "Regal hinzufügen", exact: true })
    .first()
    .click();
  d = page.getByRole("dialog");
  await rackFields(d);
  await d.getByRole("button", { name: "Regal speichern", exact: true }).click();
  await expect(d).toHaveCount(0);
  assert.equal((await active()).data.racks[0].slots.length, 12);
  await page
    .locator(".rack-card")
    .getByRole("button", { name: "Bearbeiten", exact: true })
    .click();
  d = page.getByRole("dialog");
  await rackFields(d, {
    width: "5",
    height: "3",
    depth: "1.4",
    cols: "5",
    levels: "4",
  });
  await waitSlots(20, true);
  await d.getByRole("button", { name: "Regal speichern" }).click();
  await expect(d).toHaveCount(0);
  await nav("Lagerübersicht");
  await page
    .getByRole("button", { name: "2D-Regalansicht", exact: true })
    .click();
  await expect(page.locator(".rack-grids .slots-grid button")).toHaveCount(20);
  await page.getByRole("button", { name: "3D-Ansicht", exact: true }).click();
  await waitSlots(20);
  const actualScene = await sceneData();
  assert.equal(actualScene.racks[0].width, 5);
  assert.equal(actualScene.racks[0].height, 3);
  assert.equal(actualScene.racks[0].depth, 1.4);
  assert.deepEqual(
    actualScene.areas.map((a) => [a.columns, a.levels]),
    [[5, 4]],
  );
  await fitCheck();
  pass(
    "Neues Lager mit eigenem Gebäude und Regal; direkte 2D-/3D-Vorschau stimmt überein, Abbrechen verwirft, Speichern übernimmt Maße und 20 Fächer",
  );
  await nav("Materialien");
  await page
    .getByRole("button", { name: "Material hinzufügen", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Materialnummer (Text)").fill("000900");
  await d.getByLabel("Materialbezeichnung").fill("Prüfmaterial");
  await d.getByRole("button", { name: "Material speichern" }).click();
  await nav("Lagerübersicht");
  await page
    .getByRole("button", { name: "2D-Regalansicht", exact: true })
    .click();
  await page.getByRole("button", { name: "99R1V20", exact: true }).click();
  await page
    .getByRole("button", { name: "Material zuordnen", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d
    .getByLabel("Material", { exact: true })
    .selectOption({ label: "000900 · Prüfmaterial" });
  await d.getByLabel("Menge (Stück)").fill("7");
  await d.getByRole("button", { name: "Zuordnen", exact: true }).click();
  await page.getByRole("button", { name: "Entfernen", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Belegtes Fach");
  await nav("Lager bearbeiten");
  await page
    .locator(".rack-card")
    .getByRole("button", { name: "Bearbeiten", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Spalten Bereich 1", { exact: true }).fill("1");
  await d.getByLabel("Ebenen Bereich 1", { exact: true }).fill("1");
  await d.getByRole("button", { name: "Regal speichern" }).click();
  await expect(d.getByRole("alert")).toContainText("belegte Fächer");
  assert.equal((await active()).data.racks[0].slots.length, 20);
  await d.getByRole("button", { name: "Abbrechen", exact: true }).click();
  pass(
    "Materialzuordnung funktioniert; belegte Fächer sind bei Einzelentfernung und Strukturverkleinerung geschützt",
  );
  const occupiedId = (await active()).data.racks[0].slots.find(
    (s) => s.number === 20,
  ).id;
  await page
    .locator(".rack-card")
    .getByRole("button", { name: "Bearbeiten", exact: true })
    .click();
  d = page.getByRole("dialog");
  await d.getByRole("button", { name: "Vorschau 2D" }).click();
  await d.locator('.preview-raster button[title="99R1V20"]').click();
  await d.getByLabel("Fachcode in der Vorschau").fill("Prüfplatz 20");
  await d.getByRole("button", { name: "Fach aus Entwurf entfernen" }).click();
  await expect(d.getByRole("alert")).toContainText("belegt");
  await d.getByRole("button", { name: "Regal speichern", exact: true }).click();
  await expect(d).toHaveCount(0);
  assert.equal(
    (await active()).data.racks[0].slots.find((s) => s.id === occupiedId).name,
    "Prüfplatz 20",
  );
  assert.equal(
    (await active()).data.stock.find((b) => b.slotId === occupiedId).quantity,
    7,
  );
  await page
    .locator(".rack-card")
    .getByRole("button", { name: "Bearbeiten", exact: true })
    .click();
  d = page.getByRole("dialog");
  await expect(
    d.getByRole("button", { name: "Regal speichern", exact: true }),
  ).toBeInViewport();
  await expect(
    d.getByRole("button", { name: "Abbrechen", exact: true }),
  ).toBeInViewport();
  await d.getByRole("button", { name: "Vorschau 2D" }).click();
  await d.locator('.preview-raster button[title="99R1V01"]').click();
  await d.getByRole("button", { name: "Fach aus Entwurf entfernen" }).click();
  await expect(d.locator(".preview-raster .slots-grid button")).toHaveCount(19);
  await d.getByRole("button", { name: "Abbrechen", exact: true }).click();
  assert.equal((await active()).data.racks[0].slots.length, 20);
  pass(
    "Einzelfach in der Vorschau umbenannt: ID und Belegung erhalten; Entfernen belegter Fächer gesperrt; Abbrechen verwirft leere Fachentfernung und Dialogaktionen bleiben sichtbar",
  );
  const beforeDrag = (await active()).data.racks[0],
    rect = await page
      .locator(`.edit-plan-stage g[data-rack-id="${beforeDrag.id}"] > rect`)
      .boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 65,
    rect.y + rect.height / 2 + 25,
    { steps: 8 },
  );
  await page.mouse.up();
  const afterDrag = (await active()).data.racks[0];
  assert.notEqual(afterDrag.x, beforeDrag.x);
  assert.notEqual(afterDrag.z, beforeDrag.z);
  const handle = await page
    .getByRole("button", { name: "Regal 1 drehen", exact: true })
    .boundingBox();
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 60,
    handle.y + handle.height / 2 + 35,
    { steps: 8 },
  );
  await page.mouse.up();
  const afterRotate = (await active()).data.racks[0];
  assert.notEqual(afterRotate.rotation, beforeDrag.rotation);
  const planLabel = await page
    .locator(".edit-plan-stage g[data-rack-id] > text")
    .first()
    .evaluate((e) => {
      const m = e.getScreenCTM();
      return {
        px: parseFloat(getComputedStyle(e).fontSize) * Math.hypot(m.a, m.b),
        rotation: Math.abs(m.b),
      };
    });
  assert.ok(planLabel.px >= 11.5);
  assert.ok(planLabel.rotation < 0.0001);
  await page.screenshot({ path: `${OUT}/04-lagerplan-bearbeiten.png` });
  await page.reload();
  assert.equal((await active()).name, "Prüflager");
  assert.equal((await active()).data.racks[0].rotation, afterRotate.rotation);
  assert.equal((await active()).data.racks[0].x, afterRotate.x);
  pass(
    "Regal per Ziehen positioniert und am Griff gedreht; Meterposition, Drehung und aktives Lager nach Neuladen erhalten",
  );
  await choose("Mein Lager");
  await page.getByRole("button", { name: "3D-Ansicht", exact: true }).click();
  const conti = (await active()).data.racks[2];
  await page.getByLabel("Regal filtern").selectOption(conti.id);
  await waitSlots(240);
  await page.locator(".area-visibility summary").click();
  for (const [name, count] of [
    ["Vorne", 170],
    ["Mitte", 100],
    ["Hinten", 0],
  ]) {
    await page
      .getByLabel(`Bereich 3 ${name} anzeigen`, { exact: true })
      .uncheck();
    await waitSlots(count);
  }
  for (const [name, count] of [
    ["Hinten", 100],
    ["Mitte", 170],
    ["Vorne", 240],
  ]) {
    await page
      .getByLabel(`Bereich 3 ${name} anzeigen`, { exact: true })
      .check();
    await waitSlots(count);
  }
  await page.locator(".area-visibility summary").click();
  const packed = (await sceneData()).areas.map((a) => a.z),
    dataBeforeSpread = (await active()).data;
  await page.getByLabel("Bereiche auseinanderziehen", { exact: true }).check();
  await expect
    .poll(async () => Math.max(...(await sceneData()).areas.map((a) => a.z)))
    .toBeGreaterThan(Math.max(...packed));
  assert.deepEqual((await active()).data, dataBeforeSpread);
  await page.screenshot({ path: `${OUT}/05-verschiebesegmente.png` });
  pass(
    "Hinten/Mitte/Vorne separat aus- und eingeblendet (100/70/70 Fächer), Auseinanderziehen ändert nur die Darstellung",
  );
  for (const [label, mode] of [
    ["Gesamtübersicht", "overview"],
    ["Vorne", "front"],
    ["Seitlich", "side"],
    ["Oben", "top"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect.poll(async () => (await sceneData()).fit.mode).toBe(mode);
    await fitCheck();
  }
  await page
    .getByRole("button", { name: "Ansicht zurücksetzen", exact: true })
    .click();
  await fitCheck();
  const fitPosition = (await sceneData()).camera,
    cb = await page.locator(".viewport canvas").boundingBox();
  await page.mouse.move(cb.x + cb.width * 0.5, cb.y + cb.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width * 0.6, cb.y + cb.height * 0.7, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Math.hypot(
        ...(await sceneData()).camera.map((x, i) => x - fitPosition[i]),
      ),
    )
    .toBeGreaterThan(0.2);
  await page.mouse.wheel(0, -150);
  await page
    .getByRole("button", { name: "Ansicht zurücksetzen", exact: true })
    .click();
  await expect
    .poll(async () => {
      const d = await sceneData();
      return Math.hypot(...d.camera.map((x, i) => x - d.fit.position[i]));
    })
    .toBeLessThan(0.03);
  await fitCheck();
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollW: document.documentElement.scrollWidth,
    scrollH: document.documentElement.scrollHeight,
    canvas: document
      .querySelector(".viewport canvas")
      .getBoundingClientRect()
      .toJSON(),
    stats: document.querySelector(".stats").getBoundingClientRect().height,
  }));
  assert.equal(layout.scrollW, layout.width);
  assert.equal(layout.scrollH, layout.height);
  assert.ok(layout.canvas.bottom <= layout.height);
  assert.ok(layout.canvas.height > 350);
  assert.ok(layout.stats < 70);
  await page.screenshot({ path: `${OUT}/06-desktop-layout.png` });
  pass(
    "Vier Kameraansichten, Drehen/Zoomen und zuverlässiges Zurücksetzen; Desktop 1366×768 ohne Seitenüberlauf und mit kompakter Kennzahlenzeile",
  );
  const exported = await store(),
    downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadPromise,
    file = `${OUT}/roundtrip.json`;
  await download.saveAs(file);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), exported);
  await page.locator("input[type=file]").setInputFiles(file);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen" })
    .click();
  assert.deepEqual(await store(), exported);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("lagerraum-v1")),
    legacyRaw,
  );
  pass(
    "JSON-Roundtrip erhält alle Lager; unveränderte Sicherung der alten Browserdaten weiterhin vorhanden",
  );
  const contrast = await page.evaluate(() => {
    const parse = (s) => {
        const m = s.match(/[\d.]+/g)?.map(Number) || [];
        return [m[0] || 0, m[1] || 0, m[2] || 0, m[3] ?? 1];
      },
      mix = (a, b) => [
        a[0] * a[3] + b[0] * (1 - a[3]),
        a[1] * a[3] + b[1] * (1 - a[3]),
        a[2] * a[3] + b[2] * (1 - a[3]),
        1,
      ],
      lum = (c) =>
        c
          .slice(0, 3)
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          })
          .reduce((s, x, i) => s + x * [0.2126, 0.7152, 0.0722][i], 0);
    const failures = [];
    for (const el of document.querySelectorAll(
      ".sidebar *,main h1,main h2,main h3,.stats *,.scene-tools *,.viewport-title *,.viewport-footer *",
    )) {
      if (
        ![...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim(),
        ) ||
        !el.getClientRects().length
      )
        continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || el.closest("[disabled]")) continue;
      let bg = [255, 255, 255, 1];
      const parents = [];
      for (let p = el; p; p = p.parentElement) parents.unshift(p);
      for (const p of parents)
        bg = mix(parse(getComputedStyle(p).backgroundColor), bg);
      const fg = mix(parse(st.color), bg),
        a = lum(fg),
        b = lum(bg),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        large =
          parseFloat(st.fontSize) >= 24 ||
          (parseFloat(st.fontSize) >= 18.66 && Number(st.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5))
        failures.push({
          text: el.textContent.trim().slice(0, 65),
          ratio: +ratio.toFixed(2),
          color: st.color,
          bg,
        });
    }
    return failures;
  });
  await writeFile(`${OUT}/contrast.json`, JSON.stringify(contrast, null, 2));
  assert.deepEqual(contrast, []);
  pass(
    "Gemessene Textkontraste der Seitenleiste, Überschriften, Kennzahlen und Ansichtsbedienung erfüllen 4,5:1 (große Schrift 3:1)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "2D-Regalansicht", exact: true })
    .click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: `${OUT}/07-mobil.png`, fullPage: true });
  pass("Zusätzliche Prüfung bei 390×844: keine horizontale Seitenüberbreite");
  if (process.env.CHECK_STANDALONE === "1") {
    const html = await readFile(
      new globalThis.URL("../standalone/index.html", import.meta.url),
    );
    staticServer = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    await new Promise((r) => staticServer.listen(0, "127.0.0.1", r));
    const extra = await browser.newPage(),
      requests = [];
    extra.on("pageerror", (e) => errors.push(e.message));
    extra.on("request", (r) => {
      if (/^https?:/.test(r.url()) && r.resourceType() !== "document")
        requests.push(r.url());
    });
    await extra.goto(`http://127.0.0.1:${staticServer.address().port}`);
    await extra.locator("canvas").waitFor();
    await extra
      .getByRole("button", { name: "Lagerverwaltung: Mein Lager", exact: true })
      .click();
    await expect(
      extra.getByRole("heading", { name: "Lagerverwaltung", exact: true }),
    ).toBeVisible();
    await extra
      .getByRole("dialog")
      .getByRole("button", {
        name: "Lager Beispielhalle · Bauen auswählen",
        exact: true,
      })
      .click();
    await extra
      .locator("nav")
      .getByRole("button", { name: "Bauen", exact: true })
      .click();
    await extra.locator(".build-canvas canvas").waitFor();
    await extra.getByRole("button", { name: "Grundriss", exact: true }).click();
    await expect(extra.locator(".part-library details button")).toHaveCount(28);
    assert.deepEqual(requests, []);
    pass(
      "Eigenständige HTML-Ausgabe öffnet Lagerraum und den Baumodus mit 28 Bauteilen ohne externe Assets",
    );
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${OUT}/results.json`,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        baseUrl: URL,
        passed,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(`ABGESCHLOSSEN: ${passed.length} Browser-Prüfgruppen bestanden.`);
} catch (e) {
  if (page) {
    await page
      .screenshot({ path: `${OUT}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${OUT}/failure.json`,
      JSON.stringify({ passed, error: String(e), pageErrors: errors }, null, 2),
    );
  }
  throw e;
} finally {
  await browser.close();
  if (staticServer) await new Promise((r) => staticServer.close(r));
}
