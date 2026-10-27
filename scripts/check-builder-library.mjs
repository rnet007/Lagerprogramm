import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.BASE_URL || "http://127.0.0.1:5173",
  out = "/workspace/shared/lagerraum-baumodus-tests",
  startedAt = new Date().toISOString();
await mkdir(out, { recursive: true });
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
let page;
const pass = (s) => {
  passed.push(s);
  console.log("PASS:", s);
};
async function data() {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("lagerraum-v2"));
    return s.warehouses.find((w) => w.id === s.activeId).data;
  });
}
async function point(x, z) {
  return page.locator(".builder-plan svg").evaluate(
    (s, p) => {
      const v = new DOMPoint(p.x, p.z).matrixTransform(s.getScreenCTM());
      return { x: v.x, y: v.y };
    },
    { x, z },
  );
}
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: /^Lagerverwaltung:/ }).click();
  await page
    .getByRole("button", {
      name: "Lager Beispielhalle · Bauen auswählen",
      exact: true,
    })
    .click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Bauen", exact: true })
    .click();
  await page.locator(".build-canvas canvas").waitFor();
  await page.locator(".builder-object-list summary").click();
  await page
    .locator(".builder-object-list")
    .getByRole("checkbox", { name: "Packtisch", exact: true })
    .check();
  const table = (await data()).layout.objects.find(
    (o) => o.kind === "packingTable",
  );
  await page.getByRole("button", { name: "Verschieben", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        let c;
        document
          .querySelector(".build-canvas canvas")
          .__lagerScene.traverse((o) => {
            if (o.isTransformControls) c = o;
          });
        return !!c?.object;
      }),
    )
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const handle = await page.evaluate(() => {
    const c = document.querySelector(".build-canvas canvas"),
      s = c.__lagerScene;
    let t;
    s.traverse((o) => {
      if (o.isTransformControls) t = o;
    });
    const mesh = t.gizmo.picker.translate.children.find((m) => m.name === "X");
    mesh.geometry.computeBoundingBox();
    const v = mesh.geometry.boundingBox.getCenter(mesh.position.clone());
    mesh.localToWorld(v);
    v.project(s.userData.renderCamera);
    const r = c.getBoundingClientRect();
    return {
      x: r.x + ((v.x + 1) * r.width) / 2,
      y: r.y + ((1 - v.y) * r.height) / 2,
    };
  });
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(handle.x + 80, handle.y + 46, { steps: 15 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await data()).layout.objects.find((o) => o.id === table.id).x,
    )
    .not.toBe(table.x);
  const moved = (await data()).layout.objects.find((o) => o.id === table.id);
  assert.equal(moved.z, table.z);
  await expect(
    page.locator(".build-properties").getByLabel("X (m)", { exact: true }),
  ).toHaveValue(String(moved.x));
  await page
    .locator(".build-properties")
    .getByLabel("Drehung (°)", { exact: true })
    .fill("37");
  await page
    .locator(".build-properties")
    .getByRole("button", { name: "Eigenschaften übernehmen" })
    .click();
  assert.equal(
    (await data()).layout.objects.find((o) => o.id === table.id).rotation,
    37,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal(
    (await data()).layout.objects.find((o) => o.id === table.id).rotation,
    0,
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  assert.equal(
    (await data()).layout.objects.find((o) => o.id === table.id).x,
    table.x,
  );
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  assert.equal(
    (await data()).layout.objects.find((o) => o.id === table.id).x,
    moved.x,
  );
  pass(
    "Mit dem tatsächlichen 3D-X-Greifer per Maus verschoben und gespeichert; freier Winkel 37° übernommen; beide Änderungen rückgängig gemacht und Bewegung wiederholt",
  );
  await page.getByRole("button", { name: "Grundriss", exact: true }).click();
  const names = await page
    .locator(".part-library details button")
    .allInnerTexts();
  assert.equal(names.length, 28);
  const counts =
    (await data()).racks.length + (await data()).layout.objects.length;
  let openings = 0;
  for (let i = 0; i < names.length; i++) {
    const name = names[i].trim();
    await page
      .locator(".part-library")
      .getByRole("button", { name, exact: true })
      .click();
    const opening = [
        "Tür",
        "Personenausgang",
        "Notausgang",
        "Hallentor",
      ].includes(name),
      p = await point(
        opening ? -9 + openings++ * 4 : -8 + (i % 7) * 2.5,
        opening ? 9 : -6 + Math.floor(i / 7) * 3,
      );
    await page.mouse.move(p.x, p.y);
    await expect
      .poll(() => page.locator('.builder-plan g[opacity="0.55"]').count())
      .toBe(1);
    await page.mouse.click(p.x, p.y);
    await expect
      .poll(async () => {
        const d = await data();
        return d.racks.length + d.layout.objects.length;
      })
      .toBe(counts + i + 1);
  }
  const all = await data(),
    kinds = new Set([...all.racks, ...all.layout.objects].map((o) => o.kind));
  assert.equal(kinds.size, 28);
  pass(
    "Alle 28 angebotenen Bibliothekstypen tatsächlich mit Vorschau ausgewählt, auf dem Plan platziert und dauerhaft angelegt",
  );
  await page
    .locator(".part-library")
    .getByRole("button", { name: "Kiste", exact: true })
    .click();
  const outside = await point(14, 5);
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.click(outside.x, outside.y);
  await expect(page.locator(".layout-warnings")).toContainText("außerhalb");
  await expect
    .poll(() => page.locator(".layout-warnings button").count())
    .toBeGreaterThan(1);
  pass(
    "Außerhalb der Halle platziertes Objekt und reale Überschneidungen werden im Eigenschaftenbereich gewarnt",
  );
  await page.getByRole("button", { name: "3D bauen", exact: true }).click();
  await page.getByLabel("Wanddarstellung", { exact: true }).selectOption("all");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = document.querySelector(".build-canvas canvas")?.__lagerScene;
        if (!s) return 0;
        const kinds = new Set();
        s.traverse((o) => {
          if (o.userData.objectId || o.userData.rackId)
            kinds.add(o.userData.kind || o.userData.rackKind);
        });
        return kinds.size;
      }),
    )
    .toBeGreaterThanOrEqual(23);
  const rendered = await page.evaluate(() => {
    const s = document.querySelector(".build-canvas canvas").__lagerScene,
      roots = [];
    s.traverse((o) => {
      if (o.name.startsWith("object:") || o.name.startsWith("rack:")) {
        let meshes = 0;
        o.traverse((c) => {
          if (c.isMesh) meshes++;
        });
        roots.push({ id: o.userData.objectId || o.userData.rackId, meshes });
      }
    });
    return roots;
  });
  assert.ok(rendered.every((o) => o.meshes > 0));
  assert.equal(
    rendered.length,
    (await data()).racks.length + (await data()).layout.objects.length,
  );
  await page.screenshot({ path: `${out}/04-bibliothek-3d.png` });
  pass(
    "Alle platzierten Objekte werden als echte 3D-Geometrie gerendert, keine leeren Objekt-Platzhalter",
  );
  await page.getByRole("button", { name: "Auswahl", exact: true }).click();
  const list = page.locator(".builder-object-list");
  if ((await list.getAttribute("open")) === null)
    await list.locator("summary").click();
  for (const c of await list.locator("input:checked").all()) await c.uncheck();
  await list
    .getByRole("checkbox", { name: "Palettenregal", exact: true })
    .first()
    .check();
  const before = await data();
  await page
    .getByRole("button", { name: "Auswahl duplizieren", exact: true })
    .click();
  const after = await data(),
    copy = after.racks.at(-1);
  assert.deepEqual(after.stock, before.stock);
  assert.ok(
    copy.slots.every((s) => !after.stock.some((b) => b.slotId === s.id)),
  );
  assert.equal(after.racks.length, before.racks.length + 1);
  pass(
    "Belegtes Palettenregal im Browser dupliziert: neue Struktur und Codes, unveränderte Originalbestände, leere Kopie",
  );
  for (const c of await list.locator("input:checked").all()) await c.uncheck();
  const foot = (await data()).layout.objects.find((o) => o.kind === "footpath");
  await list
    .getByRole("checkbox", { name: "Fußweg", exact: true })
    .first()
    .check();
  const oldCount = foot.points.length;
  await page
    .getByRole("button", { name: "Stützpunkt hinzufügen", exact: true })
    .click();
  await page
    .locator(".build-properties")
    .getByLabel(`Punkt ${oldCount + 1} X`, { exact: true })
    .fill("6.5");
  await page
    .locator(".build-properties")
    .getByLabel(`Punkt ${oldCount + 1} Z`, { exact: true })
    .fill("1.5");
  await page
    .locator(".build-properties")
    .getByLabel("Wegbreite (m)", { exact: true })
    .fill("1.8");
  await page
    .locator(".build-properties")
    .getByLabel("Objektname", { exact: true })
    .fill("Fußweg Montage");
  await page
    .locator(".build-properties")
    .getByRole("button", { name: "Eigenschaften übernehmen", exact: true })
    .click();
  const path = (await data()).layout.objects.find((o) => o.id === foot.id);
  assert.equal(path.points.length, oldCount + 1);
  assert.equal(path.width, 1.8);
  assert.equal(path.name, "Fußweg Montage");
  assert.deepEqual(path.points.at(-1), { x: 6.5, z: 1.5 });
  const pathGeometry = await page.evaluate((id) => {
    let root;
    document
      .querySelector(".build-canvas canvas")
      .__lagerScene.traverse((o) => {
        if (o.name === `object:${id}`) root = o;
      });
    return root.children[0].children.map(
      (g) => g.children[0].geometry.parameters.depth,
    );
  }, foot.id);
  assert.equal(pathGeometry.length, path.points.length - 1);
  assert.ok(pathGeometry.every((w) => w === 1.8));
  pass(
    "Mehrpunktweg über die Oberfläche erweitert, benannt und auf 1,8 m verbreitert; tatsächliche 3D-Segmente entsprechen den gespeicherten Stützpunkten",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${out}/library-results.json`,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        passed,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `ABGESCHLOSSEN: ${passed.length} zusätzliche Browser-Prüfgruppen bestanden.`,
  );
} catch (e) {
  if (page) {
    await page
      .screenshot({ path: `${out}/library-failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${out}/library-failure.json`,
      JSON.stringify({ passed, error: String(e), pageErrors: errors }, null, 2),
    );
  }
  throw e;
} finally {
  await browser.close();
}
