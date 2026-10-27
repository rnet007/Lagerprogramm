import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:5173",
  out = "/workspace/shared/lagerraum-baumodus-tests";
await mkdir(out, { recursive: true });
await rm(`${out}/results.json`, { force: true });
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
  errors = [],
  startedAt = new Date().toISOString();
let page;
const pass = (s) => {
  passed.push(s);
  console.log("PASS:", s);
};
async function state() {
  return page.evaluate(() => JSON.parse(localStorage.getItem("lagerraum-v2")));
}
async function active() {
  const s = await state();
  return s.warehouses.find((w) => w.id === s.activeId);
}
async function nav(name) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
}
async function choose(name) {
  await page.getByRole("button", { name: /^Lagerverwaltung:/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: `Lager ${name} auswählen`, exact: true })
    .click();
}
async function world(x, z) {
  return page.locator(".builder-plan svg").evaluate(
    (svg, p) => {
      const v = new DOMPoint(p.x, p.z).matrixTransform(svg.getScreenCTM());
      return { x: v.x, y: v.y };
    },
    { x, z },
  );
}
async function place(name, x, z, opening = false) {
  const before = (await active()).data;
  await page
    .locator(".part-library")
    .getByRole("button", { name, exact: true })
    .click();
  const p = await world(x, z);
  await page.mouse.move(p.x, p.y);
  await expect
    .poll(() => page.locator('.builder-plan g[opacity="0.55"]').count())
    .toBe(1);
  assert.equal((await active()).data.racks.length, before.racks.length);
  assert.equal(
    (await active()).data.layout.objects.length,
    before.layout.objects.length,
  );
  await page.mouse.click(p.x, p.y);
  await expect
    .poll(async () => {
      const d = (await active()).data;
      return d.racks.length + d.layout.objects.length;
    })
    .toBe(before.racks.length + before.layout.objects.length + 1);
  return (await active()).data;
}
async function pick(id) {
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  await page
    .locator(`.builder-plan g[data-entity-id="${id}"]`)
    .click({ position: { x: 5, y: 5 } });
}
async function pickList(name) {
  const list = page.locator(".builder-object-list");
  if ((await list.getAttribute("open")) === null)
    await list.locator("summary").click();
  for (const input of await list.locator("input:checked").all())
    await input.uncheck();
  await list.getByRole("checkbox", { name, exact: true }).check();
}
async function scene() {
  return page.evaluate(() => {
    const c =
        document.querySelector(".build-canvas canvas") ||
        document.querySelector(".viewport canvas"),
      s = c?.__lagerScene;
    if (!s) return null;
    s.updateMatrixWorld(true);
    const objects = [],
      racks = [],
      slots = [],
      labels = [],
      areas = [];
    s.traverse((o) => {
      if (o.name.startsWith("object:"))
        objects.push({ ...o.userData, visible: o.visible });
      if (o.name.startsWith("rack:")) racks.push(o.userData);
      if (o.name.startsWith("slot:"))
        slots.push({
          ...o.userData,
          position: o.getWorldPosition(o.position.clone()).toArray(),
        });
      if (o.name.startsWith("area:"))
        areas.push({ ...o.userData, x: o.position.x, z: o.position.z });
      if (o.name === "label")
        labels.push({
          ...o.userData,
          opacity: o.material.opacity,
          depthTest: o.material.depthTest,
        });
    });
    return {
      objects,
      racks,
      slots,
      labels,
      areas,
      fit: s.userData.cameraFit,
      camera: s.userData.renderCamera?.position.toArray(),
    };
  });
}
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("button", { name: "Lagerverwaltung: Mein Lager", exact: true })
    .waitFor();
  const initial = await state(),
    legacy = {
      ...initial,
      builderExampleAdded: undefined,
      warehouses: initial.warehouses.slice(0, 2),
    };
  legacy.warehouses[0].data.stock[0].quantity = 713;
  const original = JSON.stringify(legacy);
  await page.evaluate((raw) => {
    localStorage.setItem("lagerraum-v2", raw);
    localStorage.removeItem("lagerraum-v2-vor-baumodus");
  }, original);
  await page.reload();
  const migrated = await state();
  assert.deepEqual(migrated.warehouses.slice(0, 2), legacy.warehouses);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("lagerraum-v2-vor-baumodus"),
    ),
    original,
  );
  assert.equal(migrated.warehouses.length, 3);
  pass(
    "Vorhandene Version-2-Lager mit allen IDs und Beständen erhalten; Original gesichert; Beispielhalle separat ergänzt",
  );
  await page.getByRole("button", { name: /^Lagerverwaltung:/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name des neuen Lagers").fill("Baumodus-Prüfung");
  await dialog
    .getByRole("button", { name: "Lager hinzufügen", exact: true })
    .click();
  await nav("Bauen");
  await page
    .getByRole("button", { name: "Halle erstellen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Hallenname", { exact: true })
    .fill("Browsertest-Halle");
  await dialog.getByLabel("Gebäude der Halle").fill("BAU");
  await dialog.getByLabel("Hallenbreite (m)").fill("24");
  await dialog.getByLabel("Hallentiefe (m)").fill("18");
  await dialog.getByLabel("Hallenhöhe (m)").fill("5");
  await dialog
    .getByRole("button", { name: "Halle anlegen", exact: true })
    .click();
  assert.equal((await active()).data.layout.halls.length, 1);
  assert.equal(
    (await active()).data.layout.objects.filter((o) => o.kind === "wall")
      .length,
    4,
  );
  await page.getByRole("button", { name: "Grundriss", exact: true }).click();
  pass(
    "Eigene Halle mit Maßen und vier Außenwänden angelegt, ohne vorhandene Lager zu verändern",
  );
  let d = await place("Fachbodenregal", -6, -3);
  const rackId = d.racks[0].id;
  await page
    .locator(".build-properties")
    .getByLabel("Objektname", { exact: true })
    .fill("Prüfregal");
  await page
    .locator(".build-properties")
    .getByLabel("Breite (m)", { exact: true })
    .fill("4");
  await page
    .locator(".build-properties")
    .getByRole("button", { name: "Eigenschaften übernehmen" })
    .click();
  assert.equal((await active()).data.racks[0].width, 4);
  await page.getByRole("button", { name: "Drehen", exact: true }).click();
  const rotatingRect = await page
    .locator(`g[data-entity-id="${rackId}"] > rect`)
    .first()
    .boundingBox();
  await page.mouse.move(
    rotatingRect.x + rotatingRect.width * 0.8,
    rotatingRect.y + rotatingRect.height * 0.25,
  );
  await page.mouse.down();
  await page.mouse.move(
    rotatingRect.x + rotatingRect.width * 0.4,
    rotatingRect.y + rotatingRect.height + 35,
    { steps: 8 },
  );
  await page.mouse.up();
  assert.notEqual((await active()).data.racks[0].rotation, 0);
  await page
    .locator(".build-properties")
    .getByLabel("Drehung (°)", { exact: true })
    .fill("0");
  await page
    .locator(".build-properties")
    .getByRole("button", { name: "Eigenschaften übernehmen", exact: true })
    .click();

  await page
    .getByRole("button", { name: "Auswahl um 90 Grad drehen", exact: true })
    .click();
  assert.equal((await active()).data.racks[0].rotation, 90);
  await page
    .getByRole("button", { name: "Auswahl duplizieren", exact: true })
    .click();
  assert.equal((await active()).data.racks.length, 2);
  const copy = (await active()).data.racks[1];
  assert.notEqual(copy.id, rackId);
  assert.notEqual(copy.number, (await active()).data.racks[0].number);
  assert.equal((await active()).data.stock.length, 0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal((await active()).data.racks.length, 1);
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal((await active()).data.racks.length, 2);
  pass(
    "Platzierungsvorschau vor Speichern; Regalmaße geändert, per Maus und in 90°-Schritten gedreht, ohne Bestand dupliziert und Rückgängig/Wiederholen ausgeführt",
  );
  await page
    .locator(".part-library")
    .getByRole("button", { name: "Kiste", exact: true })
    .click();
  let p = await world(0, 0);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator('.builder-plan g[opacity="0.55"]')).toHaveCount(1);
  const beforeEscape = JSON.stringify((await active()).data);
  await page.keyboard.press("Escape");
  await expect(page.locator('.builder-plan g[opacity="0.55"]')).toHaveCount(0);
  assert.equal(JSON.stringify((await active()).data), beforeEscape);
  pass("Escape verwirft eine laufende Platzierung, ohne Daten anzulegen");
  d = await place("Werkbank", 3, 3);
  const table = d.layout.objects.find((o) => o.kind === "workbench");
  await page.getByRole("button", { name: "Verschieben", exact: true }).click();
  let bounds = await page
    .locator(`g[data-entity-id="${table.id}"] > rect`)
    .first()
    .boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 35,
    bounds.y + bounds.height / 2 - 25,
    { steps: 8 },
  );
  await page.mouse.up();
  const moved = (await active()).data.layout.objects.find(
    (o) => o.id === table.id,
  );
  assert.notEqual(moved.x, table.x);
  assert.ok(Math.abs(moved.x / 0.5 - Math.round(moved.x / 0.5)) < 0.001);
  await page
    .getByRole("button", { name: "Auswahl sperren oder entsperren" })
    .click();
  await expect(
    page.locator(".build-properties").getByLabel("X (m)", { exact: true }),
  ).toBeDisabled();
  const locked = JSON.stringify(
    (await active()).data.layout.objects.find((o) => o.id === table.id),
  );
  bounds = await page
    .locator(`g[data-entity-id="${table.id}"] > rect`)
    .first()
    .boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 30,
    bounds.y + bounds.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  assert.equal(
    JSON.stringify(
      (await active()).data.layout.objects.find((o) => o.id === table.id),
    ),
    locked,
  );
  await page
    .getByRole("button", { name: "Objekt entsperren", exact: true })
    .click();
  pass(
    "Objekt im 2D-Grundriss mit Raster per Maus verschoben; Sperre verhindert weitere Bewegung und lässt sich lösen",
  );
  const crateData = await place("Kiste", 5, -1),
    crate = crateData.layout.objects.find((o) => o.kind === "crate");
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  const list = page.locator(".builder-object-list");
  if ((await list.getAttribute("open")) === null)
    await list.locator("summary").click();
  await list.getByRole("checkbox", { name: "Werkbank", exact: true }).check();
  await expect(page.locator(".build-properties")).toContainText(
    "2 Objekte ausgewählt",
  );
  const objsBefore = (await active()).data.layout.objects.length;
  await page.getByRole("button", { name: "Auswahl duplizieren" }).click();
  assert.equal((await active()).data.layout.objects.length, objsBefore + 2);
  pass(
    "Mehrfachauswahl und gemeinsame Duplikation zweier Ausstattungsteile funktionieren",
  );
  d = await place("Tür", -7, 9, true);
  const door = d.layout.objects.find((o) => o.kind === "door");
  await page
    .locator(".build-properties")
    .getByLabel("Breite (m)", { exact: true })
    .fill("1.6");
  await page
    .locator(".build-properties")
    .getByLabel("Höhe (m)", { exact: true })
    .fill("2.4");
  await page
    .locator(".build-properties")
    .getByRole("button", { name: "Eigenschaften übernehmen" })
    .click();
  d = (await active()).data;
  const changedDoor = d.layout.objects.find((o) => o.id === door.id);
  assert.equal(changedDoor.width, 1.6);
  assert.equal(changedDoor.height, 2.4);
  await page.getByRole("button", { name: "3D bauen", exact: true }).click();
  await expect
    .poll(async () => (await scene())?.objects.length)
    .toBe(d.layout.objects.length);
  const physical = await page.evaluate((id) => {
    const s = document.querySelector(".build-canvas canvas").__lagerScene;
    let wall;
    s.traverse((o) => {
      if (o.name === `object:${id}`) wall = o;
    });
    return wall.children
      .filter((c) => c.name === "wall-solid")
      .map((c) => ({
        x: c.position.x,
        y: c.position.y,
        w: c.geometry.parameters.width,
        h: c.geometry.parameters.height,
      }));
  }, changedDoor.wallId);
  assert.ok(physical.some((seg) => seg.h === 5 - 2.4));
  assert.ok(
    !physical.some(
      (seg) =>
        Math.abs(seg.x - changedDoor.offset) < 0.5 && seg.y - seg.h / 2 < 0.01,
    ),
  );
  await page.getByLabel("Wanddarstellung", { exact: true }).selectOption("all");
  await expect
    .poll(
      async () =>
        (await scene()).objects.filter((o) => o.kind === "wall" && o.visible)
          .length,
    )
    .toBe(4);
  await page
    .getByLabel("Wanddarstellung", { exact: true })
    .selectOption("none");
  await expect
    .poll(
      async () =>
        (await scene()).objects.filter((o) => o.kind === "wall" && o.visible)
          .length,
    )
    .toBe(0);
  await page
    .getByLabel("Wanddarstellung", { exact: true })
    .selectOption("cutaway");
  await page.screenshot({ path: `${out}/01-halle-und-oeffnung.png` });
  pass(
    "Tür in Wand platziert und bearbeitet; tatsächliche 3D-Wandsegmente haben eine bodenfreie Öffnung mit Sturz; Wandmodi wirken",
  );
  await nav("Materialien");
  await page
    .getByRole("button", { name: "Material hinzufügen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Materialnummer (Text)").fill("BAU-0007");
  await dialog.getByLabel("Materialbezeichnung").fill("Bautest-Material");
  await dialog.getByRole("button", { name: "Material speichern" }).click();
  await nav("Lagerübersicht");
  await page
    .getByRole("button", { name: "2D-Regalansicht", exact: true })
    .click();
  const rack = (await active()).data.racks.find((r) => r.id === rackId),
    slot = rack.slots[0],
    code = `BAUR${rack.number}V01`;
  await page.getByRole("button", { name: code, exact: true }).click();
  await page
    .getByRole("button", { name: "Material zuordnen", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Material", { exact: true })
    .selectOption({ label: "BAU-0007 · Bautest-Material" });
  await dialog.getByLabel("Menge (Stück)").fill("5");
  await dialog.getByRole("button", { name: "Zuordnen", exact: true }).click();
  await page.getByLabel("Zentrale Suche").fill("BAU-0007");
  await page
    .locator(".search-results button")
    .filter({ hasText: code })
    .click();
  await expect(
    page.getByRole("heading", { name: code, exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      return (await scene())?.slots.some((s) => s.slotId === slot.id) || false;
    })
    .toBe(true);
  const snapshot = JSON.stringify((await active()).data);
  bounds = await page.locator(".viewport canvas").boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width * 0.4,
    bounds.y + bounds.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.6,
    bounds.y + bounds.height * 0.6,
    { steps: 6 },
  );
  await page.mouse.up();
  assert.equal(JSON.stringify((await active()).data), snapshot);
  await nav("Bauen");
  await page.getByRole("button", { name: "Grundriss", exact: true }).click();
  await pickList("Prüfregal");
  await page
    .getByRole("button", { name: "Auswahl löschen", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Löschen bestätigen" })
    .click();
  await expect(page.locator(".build-status")).toContainText(
    "Belegte Lagerplätze",
  );
  assert.equal((await active()).data.racks.length, 2);
  pass(
    "Gebautes Regal direkt mit Material belegt und über Suche gefunden; normaler Lagermodus verschiebt nichts; Löschen belegter Regale ist gesperrt",
  );
  const persistent = (await active()).data;
  await page.reload();
  assert.equal((await active()).name, "Baumodus-Prüfung");
  assert.deepEqual((await active()).data, persistent);
  await choose("Mein Lager");
  assert.equal((await active()).data.stock[0].quantity, 713);
  await page.getByLabel("Zentrale Suche").fill("BAU-0007");
  await expect(page.locator(".search-results")).toContainText(
    "0 Lagerplätze gefunden",
  );
  await page.getByLabel("Zentrale Suche").fill("");
  pass(
    "Hallenlayout, Objekte, Drehungen und Bestand nach Neuladen erhalten; Lagerwechsel zeigt keine fremden Materialien",
  );
  await choose("Beispielhalle · Bauen");
  await nav("Bauen");
  await page.locator(".build-canvas canvas").waitFor();
  await expect.poll(async () => (await scene())?.slots.length).toBe(286);
  await expect
    .poll(
      async () =>
        (await scene()).labels.filter(
          (l) => l.tier === "rack" && l.labelVisible,
        ).length,
    )
    .toBe(0);
  await expect
    .poll(
      async () =>
        (await scene()).labels.filter(
          (l) => l.tier === "hall" && l.labelVisible,
        ).length,
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: `${out}/02-beispielhalle-isometrisch.png` });
  bounds = await page.locator(".build-canvas canvas").boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  for (
    let i = 0;
    i < 30 &&
    (await scene()).labels.filter((l) => l.tier === "rack" && l.labelVisible)
      .length === 0;
    i++
  ) {
    await page.mouse.wheel(0, -180);
    await page.waitForTimeout(80);
  }
  await expect
    .poll(
      async () =>
        (await scene()).labels.filter(
          (l) => l.tier === "rack" && l.labelVisible,
        ).length,
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("checkbox", { name: "Beschriftungen", exact: true })
    .uncheck();
  await expect
    .poll(
      async () => (await scene()).labels.filter((l) => l.labelVisible).length,
    )
    .toBe(0);
  await page
    .getByRole("checkbox", { name: "Beschriftungen", exact: true })
    .check();
  await page.getByRole("button", { name: "Bauansicht zurücksetzen" }).click();
  assert.ok((await scene()).labels.every((l) => l.depthTest));
  pass(
    "Zoom per Mausrad blendet Regalnamen ein/aus; Gesamtansicht zeigt Hallennamen; globaler Beschriftungsschalter wirkt und Labelmaterialien beachten Tiefe",
  );
  await pickList("Schieberegal");
  const beforeSlide = (await active()).data,
    r3 = beforeSlide.racks.find((r) => r.kind === "slidingRack"),
    front = r3.areas.find((a) => a.name === "Vorne"),
    target = r3.slots.find((s) => s.areaId === front.id),
    beforePos = (await scene()).slots.find(
      (s) => s.slotId === target.id,
    ).position;
  await page
    .getByRole("slider", { name: "Segment Vorne verschieben", exact: true })
    .focus();
  await page
    .getByRole("slider", { name: "Segment Vorne verschieben", exact: true })
    .press("End");
  await expect
    .poll(
      async () =>
        (await scene()).slots.find((s) => s.slotId === target.id).position[0] -
        beforePos[0],
    )
    .toBeCloseTo(r3.width, 2);
  assert.deepEqual((await active()).data, beforeSlide);
  await page
    .getByRole("checkbox", { name: "Segment Vorne sichtbar", exact: true })
    .uncheck();
  await expect.poll(async () => (await scene()).slots.length).toBe(216);
  await page
    .getByRole("checkbox", { name: "Segment Mitte sichtbar", exact: true })
    .uncheck();
  await expect.poll(async () => (await scene()).slots.length).toBe(146);
  await page
    .getByRole("checkbox", { name: "Segment Hinten sichtbar", exact: true })
    .uncheck();
  await expect.poll(async () => (await scene()).slots.length).toBe(46);
  for (const name of ["Vorne", "Mitte", "Hinten"])
    await page
      .getByRole("checkbox", { name: `Segment ${name} sichtbar`, exact: true })
      .check();
  await page
    .getByRole("checkbox", { name: "Auseinanderziehen", exact: true })
    .check();
  await expect
    .poll(async () =>
      Math.max(
        ...(await scene()).areas
          .filter((a) => r3.areas.some((b) => b.id === a.areaId))
          .map((a) => a.z),
      ),
    )
    .toBeGreaterThan(0.8);
  assert.deepEqual((await active()).data, beforeSlide);
  await page.screenshot({ path: `${out}/03-schieberegal.png` });
  pass(
    "Schieberegal seitlich verschoben, auseinandergezogen und Vorne/Mitte/Hinten einzeln ausgeblendet (70/70/100); Codes und Bestände unverändert",
  );
  const full = await state(),
    downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadEvent,
    file = `${out}/layout-export.json`;
  await download.saveAs(file);
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), full);
  await page.locator("input[type=file]").setInputFiles(file);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Bestätigen" })
    .click();
  assert.deepEqual(await state(), full);
  pass(
    "JSON-Export und -Import enthalten alle Hallen, Bauteile, Wege, Lager und Belegungen",
  );
  await nav("Bauen");
  await nav("Lagerübersicht");
  await page
    .getByRole("button", { name: "Regal hinzufügen", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Regalname", { exact: true })
    .fill("Normalmodus-Verknüpfung");
  await dialog.getByLabel("Regalnummer", { exact: true }).fill("99");
  await dialog
    .getByRole("button", { name: "Regal speichern", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const shared = (await active()).data,
    normalRack = shared.racks.find((r) => r.number === "99"),
    hall = shared.layout.halls[0];
  assert.equal(normalRack.hallId, hall.id);
  const originalStocks = JSON.stringify(shared.stock);
  await nav("Bauen");
  await page
    .getByRole("button", { name: "Halleneigenschaften öffnen" })
    .click();
  await page
    .locator(".build-properties")
    .getByLabel("X (m)", { exact: true })
    .fill(String(hall.x + 1.5));
  await page
    .getByRole("button", { name: "Halle übernehmen", exact: true })
    .click();
  assert.equal(
    (await active()).data.racks.find((r) => r.id === normalRack.id).x,
    normalRack.x + 1.5,
  );
  assert.equal(JSON.stringify((await active()).data.stock), originalStocks);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal(
    (await active()).data.racks.find((r) => r.id === normalRack.id).x,
    normalRack.x,
  );
  pass(
    "Im bisherigen Regaleditor angelegtes Regal automatisch mit Halle verbunden; Hallenbewegung nimmt Bauteile ohne Bestandsänderung mit und lässt sich rückgängig machen",
  );
  const dims = await page.evaluate(() => ({
    w: innerWidth,
    h: innerHeight,
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    rect: document
      .querySelector(".build-canvas")
      .getBoundingClientRect()
      .toJSON(),
  }));
  assert.equal(dims.sw, dims.w);
  assert.equal(dims.sh, dims.h);
  assert.ok(dims.rect.height > 400 && dims.rect.bottom < dims.h);
  assert.deepEqual(errors, []);
  pass(
    "Baumodus bei 1440×900 vollständig im Fenster; keine JavaScript-Laufzeitfehler",
  );
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        baseUrl: base,
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
      .screenshot({ path: `${out}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${out}/failure.json`,
      JSON.stringify({ passed, error: String(e), pageErrors: errors }, null, 2),
    );
  }
  throw e;
} finally {
  await browser.close();
}
