import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import "./App.css";

const STORAGE_PREFIX = "osrs-bingo-visualizer";
const COMPLETION_STORAGE_KEY = `${STORAGE_PREFIX}:completed-tiles`;
const SLOT_HEADERS = ["Helm", "Left", "Necklace", "Ammo", "Main Hand", "Chest", "Off Hand", "Legs", "Gloves", "Boots", "Ring"] as const;

type ProgressFieldProps = {
  initialValue: string;
};

type SubChecklistProps = {
  tileId: string;
  items: string[];
};

function ProgressField({ initialValue }: ProgressFieldProps) {
  const parsed = initialValue.trim().match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
  const hasCounter = parsed !== null;
  const max = hasCounter ? Number(parsed[2]) : 0;
  const suffix = hasCounter ? parsed[3] : "";

  const [count, setCount] = useState(hasCounter ? Number(parsed[1]) : 0);
  const [text, setText] = useState(initialValue);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const counterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = hasCounter ? counterRef.current : inputRef.current;
    const tile = element?.closest(".tile");

    if (!tile?.id) {
      return;
    }

    const key = `${STORAGE_PREFIX}:progress:${tile.id}`;
    setStorageKey(key);

    const saved = localStorage.getItem(key);
    if (saved === null) {
      return;
    }

    if (hasCounter) {
      const savedCount = Number(saved);
      if (Number.isFinite(savedCount)) {
        setCount(Math.max(0, Math.min(max, savedCount)));
      }
      return;
    }

    setText(saved);
  }, [hasCounter, max]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    if (hasCounter) {
      localStorage.setItem(storageKey, String(count));
      return;
    }

    localStorage.setItem(storageKey, text);
  }, [count, hasCounter, storageKey, text]);

  useEffect(() => {
    const element = hasCounter ? counterRef.current : inputRef.current;
    const tile = element?.closest(".tile");
    if (!tile) {
      return;
    }

    if (hasCounter) {
      tile.classList.toggle("in-progress", count > 0);
      return;
    }

    tile.classList.toggle("in-progress", text.trim() !== initialValue.trim());
  }, [count, hasCounter, initialValue, text]);

  if (!hasCounter) {
    return (
      <input
        ref={inputRef}
        className="tile-progress-input"
        value={text}
        aria-label="Task progress"
        onChange={(event) => setText(event.currentTarget.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      />
    );
  }

  function decrement(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setCount((current) => Math.max(0, current - 1));
  }

  function increment(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setCount((current) => Math.min(max, current + 1));
  }

  return (
    <div ref={counterRef} className="progress-counter" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button type="button" className="counter-btn" aria-label="Decrease progress" onClick={decrement}>
        -
      </button>
      <span className="counter-value">{`${count} / ${max}${suffix}`}</span>
      <button type="button" className="counter-btn" aria-label="Increase progress" onClick={increment}>
        +
      </button>
    </div>
  );
}

function SubChecklist({ tileId, items }: SubChecklistProps) {
  const storageKey = `${STORAGE_PREFIX}:subcheck:${tileId}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      return {};
    }

    try {
      return JSON.parse(saved) as Record<string, boolean>;
    } catch {
      localStorage.removeItem(storageKey);
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checkedItems));
  }, [checkedItems, storageKey]);

  function toggleItem(item: string) {
    setCheckedItems((current) => ({
      ...current,
      [item]: !current[item],
    }));
  }

  return (
    <div className="tile-subchecklist" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      {items.map((item) => (
        <label key={item} className="tile-subcheck-item">
          <input type="checkbox" checked={Boolean(checkedItems[item])} onChange={() => toggleItem(item)} />
          <span>{item}</span>
        </label>
      ))}
    </div>
  );
}

export default function App() {
  const [totalPoints, setTotalPoints] = useState(0);
  const [completedColumns, setCompletedColumns] = useState<number[]>([]);
  const [completedRows, setCompletedRows] = useState<number[]>([]);

  function pointsForTileId(tileId: string): number {
    if (tileId.startsWith("r1") || tileId.startsWith("r2")) {
      return 1;
    }

    if (tileId.startsWith("r3")) {
      return 2;
    }

    return 5;
  }

  function completedColumnNumbers(completedTiles: NodeListOf<HTMLDivElement>): number[] {
    const rowsByColumn = new Map<number, Set<number>>();

    completedTiles.forEach((tile) => {
      const match = tile.id.match(/^r(\d+)c(\d+)$/);
      if (!match) {
        return;
      }

      const row = Number(match[1]);
      const column = Number(match[2]);
      const rows = rowsByColumn.get(column) ?? new Set<number>();
      rows.add(row);
      rowsByColumn.set(column, rows);
    });

    return Array.from(rowsByColumn.entries())
      .filter(([, rows]) => rows.size === 4)
      .map(([column]) => column)
      .sort((a, b) => a - b);
  }

  function completedRowNumbers(completedTiles: NodeListOf<HTMLDivElement>): number[] {
    const columnsByRow = new Map<number, Set<number>>();

    completedTiles.forEach((tile) => {
      const match = tile.id.match(/^r(\d+)c(\d+)$/);
      if (!match) {
        return;
      }

      const row = Number(match[1]);
      const column = Number(match[2]);
      const columns = columnsByRow.get(row) ?? new Set<number>();
      columns.add(column);
      columnsByRow.set(row, columns);
    });

    return Array.from(columnsByRow.entries())
      .filter(([, columns]) => columns.size === 11)
      .map(([row]) => row)
      .sort((a, b) => a - b);
  }

  function recalculateTotalPoints() {
    const completedTiles = document.querySelectorAll<HTMLDivElement>(".tile.completed");
    let nextTotal = 0;

    completedTiles.forEach((tile) => {
      nextTotal += pointsForTileId(tile.id);
    });

    const columnsWithBonus = completedColumnNumbers(completedTiles);
    nextTotal += columnsWithBonus.length;
    setCompletedColumns(columnsWithBonus);

    const rowsWithBonus = completedRowNumbers(completedTiles);
    nextTotal += rowsWithBonus.length * 5;
    setCompletedRows(rowsWithBonus);

    setTotalPoints(nextTotal);
  }

  function persistCompletedTiles() {
    const completedTiles = document.querySelectorAll<HTMLDivElement>(".tile.completed");
    const completedTileIds = Array.from(completedTiles, (tile) => tile.id);
    localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completedTileIds));
  }

  useEffect(() => {
    const saved = localStorage.getItem(COMPLETION_STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const completedTileIds = JSON.parse(saved) as string[];
      completedTileIds.forEach((tileId) => {
        const tile = document.getElementById(tileId);
        tile?.classList.add("completed");
      });
    } catch {
      localStorage.removeItem(COMPLETION_STORAGE_KEY);
    }

    recalculateTotalPoints();
  }, []);

  function toggleComplete(id: string) {
    const tile = document.getElementById(id);
    if (tile) {
      tile.classList.toggle("completed");
      persistCompletedTiles();
      recalculateTotalPoints();
    }
  }

  function handleTileKeyDown(event: KeyboardEvent<HTMLDivElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleComplete(id);
    }
  }
  return (
    <main className="app-shell">
      <header className="board-header">
        <h1>OSRS Bingo Visualizer</h1>
        <p>Click any task tile to toggle completion. Update task text/progress directly in this file.</p>
      </header>

      <section className="board-wrap">
        <div className="bingo-board" aria-label="OSRS Bingo Board">
          <div className="column-header-row" aria-hidden="true">
            <div className="column-header-corner">Slot</div>
            {SLOT_HEADERS.map((slot) => (
              <div key={slot} className="column-header-cell">
                {slot}
              </div>
            ))}
          </div>

          <div className="bingo-row">
            <div className="row-label">
              <span className="label-title">Skilling Board</span>
              <span className="label-subtitle">1 Point Tasks</span>
            </div>

            <div id="r1c1" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c1")} onKeyDown={(event) => handleTileKeyDown(event, "r1c1")}>
              <span className="tile-title">6 Wintertodt Uniques</span>
              <ProgressField initialValue="0 / 6" />
            </div>
            <div id="r1c2" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c2")} onKeyDown={(event) => handleTileKeyDown(event, "r1c2")}>
              <span className="tile-title">Boat Paint</span>
              <ProgressField initialValue="0 / 1" />
            </div>
            <div id="r1c3" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c3")} onKeyDown={(event) => handleTileKeyDown(event, "r1c3")}>
              <span className="tile-title">4 Tempoross uniques</span>
              <ProgressField initialValue="0 / 4" />
            </div>
            <div id="r1c4" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c4")} onKeyDown={(event) => handleTileKeyDown(event, "r1c4")}>
              <span className="tile-title">Big Fish</span>
              <ProgressField initialValue="Not found" />
            </div>
            <div id="r1c5" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c5")} onKeyDown={(event) => handleTileKeyDown(event, "r1c5")}>
              <span className="tile-title">2 MTA uniques</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r1c6" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c6")} onKeyDown={(event) => handleTileKeyDown(event, "r1c6")}>
              <span className="tile-title">125M skill XP milestone</span>
              <ProgressField initialValue="In progress" />
            </div>
            <div id="r1c7" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c7")} onKeyDown={(event) => handleTileKeyDown(event, "r1c7")}>
              <span className="tile-title">20 BA queen kills</span>
              <ProgressField initialValue="0 / 20" />
            </div>
            <div id="r1c8" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c8")} onKeyDown={(event) => handleTileKeyDown(event, "r1c8")}>
              <span className="tile-title">4 Varlamore totems</span>
              <ProgressField initialValue="0 / 4" />
            </div>
            <div id="r1c9" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c9")} onKeyDown={(event) => handleTileKeyDown(event, "r1c9")}>
              <span className="tile-title">Zalcano unique</span>
              <ProgressField initialValue="0 / 1" />
            </div>
            <div id="r1c10" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c10")} onKeyDown={(event) => handleTileKeyDown(event, "r1c10")}>
              <span className="tile-title">2 GOTR uniques</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r1c11" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r1c11")} onKeyDown={(event) => handleTileKeyDown(event, "r1c11")}>
              <span className="tile-title">10 metal sheets</span>
              <ProgressField initialValue="0 / 10" />
            </div>
          </div>

          <div className="bingo-row">
            <div className="row-label">
              <span className="label-title">Bossing Board</span>
              <span className="label-subtitle">1 Point Tasks</span>
            </div>

            <div id="r2c1" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c1")} onKeyDown={(event) => handleTileKeyDown(event, "r2c1")}>
              <span className="tile-title">Shaman Mask</span>
              <ProgressField initialValue="0 / 1" />
            </div>
            <div id="r2c2" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c2")} onKeyDown={(event) => handleTileKeyDown(event, "r2c2")}>
              <span className="tile-title">4 Titan Drops</span>
              <ProgressField initialValue="0 / 4" />
            </div>
            <div id="r2c3" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c3")} onKeyDown={(event) => handleTileKeyDown(event, "r2c3")}>
              <span className="tile-title">2 Hueycoatl uniques</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r2c4" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c4")} onKeyDown={(event) => handleTileKeyDown(event, "r2c4")}>
              <span className="tile-title">2 Wilderness rings</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r2c5" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c5")} onKeyDown={(event) => handleTileKeyDown(event, "r2c5")}>
              <span className="tile-title">All Nagua weapons</span>
              <ProgressField initialValue="0 / 3" />
            </div>
            <div id="r2c6" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c6")} onKeyDown={(event) => handleTileKeyDown(event, "r2c6")}>
              <span className="tile-title">8 Moons pieces</span>
              <ProgressField initialValue="0 / 8" />
            </div>
            <div id="r2c7" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c7")} onKeyDown={(event) => handleTileKeyDown(event, "r2c7")}>
              <span className="tile-title">2 Shellbane drops</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r2c8" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c8")} onKeyDown={(event) => handleTileKeyDown(event, "r2c8")}>
              <span className="tile-title">2 Barrows sets</span>
              <ProgressField initialValue="0 / 2 sets" />
            </div>
            <div id="r2c9" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c9")} onKeyDown={(event) => handleTileKeyDown(event, "r2c9")}>
              <span className="tile-title">3 Synapse drops</span>
              <ProgressField initialValue="0 / 3" />
            </div>
            <div id="r2c10" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c10")} onKeyDown={(event) => handleTileKeyDown(event, "r2c10")}>
              <span className="tile-title">6 Scurrius spines</span>
              <ProgressField initialValue="0 / 6" />
            </div>
            <div id="r2c11" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r2c11")} onKeyDown={(event) => handleTileKeyDown(event, "r2c11")}>
              <span className="tile-title">Unique DKs Ring </span>
              <ProgressField initialValue="0/4" />
              <SubChecklist tileId="r2c11" items={["B ring", "A ring", "S ring", "W ring"]} />
            </div>
          </div>

          <div className="bingo-row">
            <div className="row-label">
              <span className="label-title">Mid-Game Board</span>
              <span className="label-subtitle">2 Point Tasks</span>
            </div>

            <div id="r3c1" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c1")} onKeyDown={(event) => handleTileKeyDown(event, "r3c1")}>
              <span className="tile-title">3 Kraken uniques</span>
              <ProgressField initialValue="0 / 3" />
            </div>
            <div id="r3c2" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c2")} onKeyDown={(event) => handleTileKeyDown(event, "r3c2")}>
              <span className="tile-title">Doom cloth or Staff</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r3c3" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c3")} onKeyDown={(event) => handleTileKeyDown(event, "r3c3")}>
              <span className="tile-title">6 Muspah uniques</span>
              <ProgressField initialValue="0 / 6" />
            </div>
            <div id="r3c4" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c4")} onKeyDown={(event) => handleTileKeyDown(event, "r3c4")}>
              <span className="tile-title">3 Thermy uniques</span>
              <ProgressField initialValue="0 / 3" />
            </div>
            <div id="r3c5" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c5")} onKeyDown={(event) => handleTileKeyDown(event, "r3c5")}>
              <span className="tile-title">Complete one godsword</span>
              <ProgressField initialValue="0 / 1" />
              <SubChecklist tileId="r3c5" items={["Hilt", "Shard 1", "Shard 2", "Shard 3"]} />
            </div>
            <div id="r3c6" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c6")} onKeyDown={(event) => handleTileKeyDown(event, "r3c6")}>
              <span className="tile-title">3 GWD armor pieces</span>
              <ProgressField initialValue="0 / 3" />
            </div>
            <div id="r3c7" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c7")} onKeyDown={(event) => handleTileKeyDown(event, "r3c7")}>
              <span className="tile-title">Corrupted Gauntlet unique</span>
              <ProgressField initialValue="0 / 6" />
            </div>
            <div id="r3c8" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c8")} onKeyDown={(event) => handleTileKeyDown(event, "r3c8")}>
              <span className="tile-title">2 Yama armor pieces</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r3c9" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c9")} onKeyDown={(event) => handleTileKeyDown(event, "r3c9")}>
              <span className="tile-title">5 Zulrah uniques</span>
              <ProgressField initialValue="0 / 5" />
            </div>
            <div id="r3c10" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c10")} onKeyDown={(event) => handleTileKeyDown(event, "r3c10")}>
              <span className="tile-title">5 Cerberus uniques</span>
              <ProgressField initialValue="0 / 5" />
            </div>
            <div id="r3c11" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r3c11")} onKeyDown={(event) => handleTileKeyDown(event, "r3c11")}>
              <span className="tile-title">4 Zenyte shards</span>
              <ProgressField initialValue="0 / 4" />
            </div>
          </div>

          <div className="bingo-row">
            <div className="row-label">
              <span className="label-title">Endgame Board</span>
              <span className="label-subtitle">5 Point Tasks</span>
            </div>

            <div id="r4c1" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c1")} onKeyDown={(event) => handleTileKeyDown(event, "r4c1")}>
              <span className="tile-title">Any mega-rare</span>
              <ProgressField initialValue="0 / 1" />
            </div>
            <div id="r4c2" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c2")} onKeyDown={(event) => handleTileKeyDown(event, "r4c2")}>
              <span className="tile-title">3 non-armor raid drops</span>
              <ProgressField initialValue="0 / 3" />
            </div>
            <div id="r4c3" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c3")} onKeyDown={(event) => handleTileKeyDown(event, "r4c3")}>
              <span className="tile-title">Nightmare unique</span>
              <ProgressField initialValue="0 / 1" />
            </div>
            <div id="r4c4" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c4")} onKeyDown={(event) => handleTileKeyDown(event, "r4c4")}>
              <span className="tile-title">5 raid common drops</span>
              <ProgressField initialValue="0 / 5" />
            </div>
            <div id="r4c5" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c5")} onKeyDown={(event) => handleTileKeyDown(event, "r4c5")}>
              <span className="tile-title">Ralos</span>
              <ProgressField initialValue="0 /1" />
            </div>
            <div id="r4c6" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c6")} onKeyDown={(event) => handleTileKeyDown(event, "r4c6")}>
              <span className="tile-title">4 raid armor pieces</span>
              <ProgressField initialValue="0 / 4" />
            </div>
            <div id="r4c7" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c7")} onKeyDown={(event) => handleTileKeyDown(event, "r4c7")}>
              <span className="tile-title">4 Araxxor uniques</span>
              <ProgressField initialValue="0 / 4" />
            </div>
            <div id="r4c8" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c8")} onKeyDown={(event) => handleTileKeyDown(event, "r4c8")}>
              <span className="tile-title">2 Nex uniques</span>
              <ProgressField initialValue="0 / 2" />
            </div>
            <div id="r4c9" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c9")} onKeyDown={(event) => handleTileKeyDown(event, "r4c9")}>
              <span className="tile-title">4 Hydra uniques</span>
              <ProgressField initialValue="0 / 4" />
            </div>
            <div id="r4c10" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c10")} onKeyDown={(event) => handleTileKeyDown(event, "r4c10")}>
              <span className="tile-title">Doom boots</span>
              <ProgressField initialValue="0 / 1" />
            </div>
            <div id="r4c11" className="tile" role="button" tabIndex={0} onClick={() => toggleComplete("r4c11")} onKeyDown={(event) => handleTileKeyDown(event, "r4c11")}>
              <span className="tile-title">2x vestige or axe pieces</span>
              <ProgressField initialValue="0 / 2" />
            </div>
          </div>
        </div>
      </section>

      <footer className="points-footer">
        <div className="points-summary">
          Total points: <span>{totalPoints}</span>
        </div>
        <div className="bonus-lines">
          {completedColumns.length === 0 && completedRows.length === 0 && <div className="bonus-pill bonus-pill-muted">No bonus yet</div>}
          {completedRows.map((row) => (
            <div key={`row-${row}`} className="bonus-pill">{`Row/Board ${row} +5`}</div>
          ))}
          {completedColumns.map((column) => (
            <div key={`col-${column}`} className="bonus-pill">{`Col/Slot ${column}`}</div>
          ))}
        </div>
      </footer>
    </main>
  );
}


