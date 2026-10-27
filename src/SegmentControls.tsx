import type { Rack } from "./model";
export default function SegmentControls({
  rack,
  spread,
  setSpread,
  offsets,
  setOffsets,
  hidden,
  setHidden,
}: {
  rack: Rack;
  spread: boolean;
  setSpread: (b: boolean) => void;
  offsets: Record<string, number>;
  setOffsets: (o: Record<string, number>) => void;
  hidden: string[];
  setHidden: (v: string[]) => void;
}) {
  return (
    <section className="segment-controls">
      <h3>Schiebesegmente · nur Ansicht</h3>
      <label className="check-label">
        <input
          type="checkbox"
          checked={spread}
          onChange={(e) => setSpread(e.target.checked)}
        />{" "}
        Auseinanderziehen
      </label>
      {rack.areas.map((a) => (
        <div key={a.id}>
          <label className="check-label">
            <input
              aria-label={`Segment ${a.name} sichtbar`}
              type="checkbox"
              checked={!hidden.includes(a.id)}
              onChange={(e) =>
                setHidden(
                  e.target.checked
                    ? hidden.filter((id) => id !== a.id)
                    : [...hidden, a.id],
                )
              }
            />
            {a.name}
          </label>
          <label className="field">
            <span>
              Verschiebung {a.name}: {(offsets[a.id] || 0).toFixed(1)} m ·{" "}
              {rack.slidingDirection || "x"}
            </span>
            <input
              type="range"
              aria-label={`Segment ${a.name} verschieben`}
              min={-rack.width}
              max={rack.width}
              step=".1"
              value={offsets[a.id] || 0}
              onChange={(e) =>
                setOffsets({ ...offsets, [a.id]: Number(e.target.value) })
              }
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          setOffsets({});
          setHidden([]);
          setSpread(false);
        }}
      >
        Segmentansicht zurücksetzen
      </button>
    </section>
  );
}
