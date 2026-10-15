(() => {
  "use strict";

  const DRAWERS = ["A", "S", "D", "F"];
  const DEMO_FILES = [
    "samples/demo_red_sunset.png",
    "samples/demo_blue_ocean.png",
    "samples/demo_green_forest.png",
    "samples/demo_purple_neon.png",
    "samples/demo_orange_city.png",
    "samples/demo_teal_drone.png",
    "samples/demo_pink_robot.png",
    "samples/demo_gold_hqb.png",
  ];

  const stage = document.getElementById("stage");
  const emptyHint = document.getElementById("emptyHint");
  const progressChip = document.getElementById("progressChip");
  const toastEl = document.getElementById("toast");
  const fileInput = document.getElementById("fileInput");
  const musicInput = document.getElementById("musicInput");
  const musicName = document.getElementById("musicName");
  const btnMusicToggle = document.getElementById("btnMusicToggle");
  const vol = document.getElementById("vol");

  /** @type {{id:string, name:string, url:string, type:'image'|'video', file?:File, el?:HTMLElement, x:number, sorted:boolean, drawer?:string}[]} */
  let queue = [];
  /** @type {{id:string, name:string, drawer:string, url:string, file?:File}[]} */
  let sorted = [];
  /** @type {{id:string, drawer:string}[]} */
  let undoStack = [];

  let activeId = null;
  let paused = false;
  let beltSpeed = 55; // px per second
  let lastTs = 0;
  let raf = 0;
  let dragState = null;
  let audio = null;
  let musicUrl = null;
  let toastTimer = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function revokeIfBlob(url) {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  }

  function updateProgress() {
    const total = queue.length + sorted.length;
    const done = sorted.length;
    const left = queue.length;
    progressChip.textContent = `${done} / ${total} sorted · ${left} left`;
    emptyHint.style.display = total === 0 ? "flex" : "none";
    const hasSorted = sorted.length > 0;
    document.getElementById("btnExportJson").disabled = !hasSorted;
    document.getElementById("btnExportCsv").disabled = !hasSorted;
    document.getElementById("btnExportFolders").disabled = !hasSorted;
    document.getElementById("btnUndo").disabled = undoStack.length === 0;
    DRAWERS.forEach((d) => {
      const count = sorted.filter((s) => s.drawer === d).length;
      const el = document.querySelector(`.drawer[data-id="${d}"] [data-count]`);
      if (el) el.textContent = String(count);
    });
  }

  function setActive(id) {
    activeId = id;
    queue.forEach((item) => {
      if (item.el) item.el.classList.toggle("active", item.id === id);
    });
  }

  function pickActive() {
    if (!queue.length) {
      activeId = null;
      return;
    }
    // Prefer item nearest center of stage
    const mid = stage.clientWidth / 2;
    let best = queue[0];
    let bestDist = Infinity;
    for (const item of queue) {
      const dist = Math.abs(item.x + 75 - mid);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    setActive(best.id);
  }

  function makeItemEl(item) {
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.id = item.id;
    if (item.type === "video") {
      const v = document.createElement("video");
      v.src = item.url;
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      // seek a bit for poster-like frame
      v.addEventListener("loadeddata", () => {
        try { v.currentTime = 0.1; } catch (_) {}
      });
      el.appendChild(v);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.name;
      img.draggable = false;
      el.appendChild(img);
    }
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = item.name;
    el.appendChild(badge);

    el.addEventListener("pointerdown", (e) => onPointerDown(e, item));
    el.addEventListener("click", () => setActive(item.id));
    return el;
  }

  function spawnItems(filesOrDemo) {
    // clear previous on-belt only when loading fresh batch that replaces?
    // User may want to append — for MVP replace unfinished + keep sorted.
    queue.forEach((item) => {
      if (item.el) item.el.remove();
      if (!item.sorted) revokeIfBlob(item.url);
    });
    queue = [];

    const startX = -160;
    filesOrDemo.forEach((entry, i) => {
      const item = {
        id: `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        name: entry.name,
        url: entry.url,
        type: entry.type,
        file: entry.file,
        x: startX - i * 180,
        sorted: false,
      };
      item.el = makeItemEl(item);
      item.el.style.left = `${item.x}px`;
      stage.appendChild(item.el);
      queue.push(item);
    });
    pickActive();
    updateProgress();
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(tick);
    }
    toast(`Loaded ${filesOrDemo.length} items · 已加载 ${filesOrDemo.length} 项`);
  }

  function fileToEntry(file) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(file.name);
    if (!isImage && !isVideo) return null;
    return {
      name: file.name,
      url: URL.createObjectURL(file),
      type: isVideo ? "video" : "image",
      file,
    };
  }

  async function loadDemo() {
    const entries = [];
    for (const path of DEMO_FILES) {
      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(path);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        entries.push({
          name: path.split("/").pop(),
          url,
          type: "image",
          file: new File([blob], path.split("/").pop(), { type: blob.type || "image/png" }),
        });
      } catch (err) {
        // file:// may block fetch — fall back to relative img src
        entries.push({
          name: path.split("/").pop(),
          url: path,
          type: "image",
        });
      }
    }
    spawnItems(entries);
  }

  async function loadFolderPicker() {
    // Prefer File System Access API directory picker
    if (window.showOpenFilePicker) {
      try {
        // Also try directory
        if (window.showDirectoryPicker) {
          const dir = await window.showDirectoryPicker();
          const entries = [];
          for await (const [, handle] of dir.entries()) {
            if (handle.kind !== "file") continue;
            const file = await handle.getFile();
            const entry = fileToEntry(file);
            if (entry) entries.push(entry);
          }
          entries.sort((a, b) => a.name.localeCompare(b.name));
          if (!entries.length) {
            toast("No images/videos in folder · 文件夹里没有图片/视频");
            return;
          }
          spawnItems(entries);
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
        // fall through to input
      }
    }
    fileInput.value = "";
    fileInput.click();
  }

  function onFilesSelected(fileList) {
    const entries = [];
    for (const file of fileList) {
      const entry = fileToEntry(file);
      if (entry) entries.push(entry);
    }
    if (!entries.length) {
      toast("No supported media · 没有支持的文件");
      return;
    }
    spawnItems(entries);
  }

  function sortItem(item, drawerId, animateToEl) {
    if (!item || item.sorted) return;
    item.sorted = true;
    item.drawer = drawerId;

    const el = item.el;
    if (el && animateToEl) {
      const ir = el.getBoundingClientRect();
      const dr = animateToEl.getBoundingClientRect();
      const dx = dr.left + dr.width / 2 - (ir.left + ir.width / 2);
      const dy = dr.top + dr.height / 2 - (ir.top + ir.height / 2);
      el.classList.add("fly-out");
      el.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
      setTimeout(() => el.remove(), 360);
    } else if (el) {
      el.remove();
    }

    queue = queue.filter((q) => q.id !== item.id);
    sorted.push({
      id: item.id,
      name: item.name,
      drawer: drawerId,
      url: item.url,
      file: item.file,
    });
    undoStack.push({ id: item.id, drawer: drawerId });
    pickActive();
    updateProgress();

    if (!queue.length && sorted.length) {
      toast(`All sorted! · 全部分完 · Export when ready`);
    }
  }

  function sortActiveTo(drawerId) {
    const item = queue.find((q) => q.id === activeId) || queue[0];
    if (!item) {
      toast("Nothing on the belt · 传送带上没有东西");
      return;
    }
    const drawerEl = document.querySelector(`.drawer[data-id="${drawerId}"]`);
    sortItem(item, drawerId, drawerEl);
  }

  function undo() {
    const last = undoStack.pop();
    if (!last) return;
    const idx = sorted.findIndex((s) => s.id === last.id);
    if (idx < 0) return;
    const rec = sorted.splice(idx, 1)[0];
    const item = {
      id: rec.id,
      name: rec.name,
      url: rec.url,
      type: (rec.file && rec.file.type.startsWith("video/")) ? "video" : "image",
      file: rec.file,
      x: -160,
      sorted: false,
    };
    item.el = makeItemEl(item);
    item.el.style.left = `${item.x}px`;
    stage.appendChild(item.el);
    queue.unshift(item);
    setActive(item.id);
    updateProgress();
    toast(`Undid → back on belt · 已撤销 ${rec.name}`);
  }

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (paused || dragState) return;

    const width = stage.clientWidth;
    for (const item of queue) {
      if (!item.el || item.el.classList.contains("dragging")) continue;
      item.x += beltSpeed * dt;
      // loop back when off right edge
      if (item.x > width + 20) {
        item.x = -160;
      }
      item.el.style.left = `${item.x}px`;
    }
    // refresh active occasionally toward center
    if (queue.length && Math.random() < 0.02) pickActive();
  }

  // Drag
  function onPointerDown(e, item) {
    if (e.button !== 0) return;
    e.preventDefault();
    setActive(item.id);
    const el = item.el;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    const rect = el.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    dragState = {
      item,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      stageRect,
    };
    // position absolute within stage using client coords
    el.style.top = `${rect.top - stageRect.top}px`;
    el.style.marginTop = "0";
    el.style.left = `${rect.left - stageRect.left}px`;
  }

  function onPointerMove(e) {
    if (!dragState) return;
    const { item, offsetX, offsetY, stageRect } = dragState;
    const el = item.el;
    const x = e.clientX - stageRect.left - offsetX;
    const y = e.clientY - stageRect.top - offsetY;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    item.x = x;

    // highlight drawers
    document.querySelectorAll(".drawer").forEach((d) => d.classList.remove("drop-target"));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const drawer = under && under.closest && under.closest(".drawer");
    if (drawer) drawer.classList.add("drop-target");
  }

  function onPointerUp(e) {
    if (!dragState) return;
    const { item } = dragState;
    const el = item.el;
    el.classList.remove("dragging");
    document.querySelectorAll(".drawer").forEach((d) => d.classList.remove("drop-target"));

    const under = document.elementFromPoint(e.clientX, e.clientY);
    const drawer = under && under.closest && under.closest(".drawer");
    dragState = null;

    if (drawer) {
      sortItem(item, drawer.dataset.id, drawer);
    } else {
      // snap back to belt midline
      el.style.top = "50%";
      el.style.marginTop = "-75px";
      el.style.left = `${item.x}px`;
      el.style.transform = "";
    }
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const key = e.key.toLowerCase();
    if (key === " " || key === "p") {
      e.preventDefault();
      togglePause();
      return;
    }
    if (key === "u" || (e.metaKey && key === "z") || (e.ctrlKey && key === "z")) {
      e.preventDefault();
      undo();
      return;
    }
    const map = { a: "A", s: "S", d: "D", f: "F" };
    if (map[key]) {
      e.preventDefault();
      sortActiveTo(map[key]);
    }
  });

  function togglePause() {
    paused = !paused;
    document.getElementById("btnPause").textContent = paused ? "▶ Resume" : "⏸ Pause";
    document.getElementById("beltTrack").style.animationPlayState = paused ? "paused" : "running";
  }

  // Drawer click assigns active
  document.querySelectorAll(".drawer").forEach((drawer) => {
    drawer.addEventListener("click", () => sortActiveTo(drawer.dataset.id));
  });

  // Music
  document.getElementById("btnMusic").addEventListener("click", () => musicInput.click());
  musicInput.addEventListener("change", () => {
    const file = musicInput.files && musicInput.files[0];
    if (!file) return;
    if (musicUrl) URL.revokeObjectURL(musicUrl);
    if (audio) {
      audio.pause();
      audio = null;
    }
    musicUrl = URL.createObjectURL(file);
    audio = new Audio(musicUrl);
    audio.loop = true;
    audio.volume = Number(vol.value);
    musicName.textContent = file.name;
    btnMusicToggle.disabled = false;
    btnMusicToggle.textContent = "▶ Play";
    toast(`Music ready · 音乐已加载`);
  });
  btnMusicToggle.addEventListener("click", async () => {
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        btnMusicToggle.textContent = "⏸ Pause";
      } catch (_) {
        toast("Click again to play · 再点一次播放");
      }
    } else {
      audio.pause();
      btnMusicToggle.textContent = "▶ Play";
    }
  });
  vol.addEventListener("input", () => {
    if (audio) audio.volume = Number(vol.value);
  });

  // Export
  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportJson() {
    const data = {
      exportedAt: new Date().toISOString(),
      results: sorted.map((s) => ({ filename: s.name, drawer: s.drawer })),
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "photo-sort-results.json");
    toast("JSON exported · 已导出 JSON");
  }

  function exportCsv() {
    const lines = ["filename,drawer"];
    sorted.forEach((s) => {
      const name = `"${String(s.name).replace(/"/g, '""')}"`;
      lines.push(`${name},${s.drawer}`);
    });
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), "photo-sort-results.csv");
    toast("CSV exported · 已导出 CSV");
  }

  async function exportFolders() {
    if (!sorted.length) return;

    // COPY ONLY into Mac folders A/S/D/F. Never delete/move source files (iPhone originals stay on phone / import folder).
    // Prefer File System Access: user picks destination folder, we create A–E and write file copies
    if (window.showDirectoryPicker) {
      try {
        const root = await window.showDirectoryPicker({ mode: "readwrite" });
        for (const d of DRAWERS) {
          const subset = sorted.filter((s) => s.drawer === d);
          if (!subset.length) continue;
          const sub = await root.getDirectoryHandle(d, { create: true });
          for (const s of subset) {
            if (!s.file) continue;
            const fh = await sub.getFileHandle(s.name, { create: true });
            const w = await fh.createWritable();
            await w.write(s.file);
            await w.close();
          }
        }
        toast("Copied into A/S/D/F on Mac · 已复制到 Mac 四抽屉（原文件保留）");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        console.warn(err);
        toast("Copy failed — use JSON/CSV · 复制失败，请导出清单");
        return;
      }
    }

    // Fallback: try JSZip if we embed a tiny zip builder — keep zero deps: instruct + CSV
    toast("Safari: export CSV/JSON, then copy files manually. Sources stay untouched. · Safari 请导出清单后手动复制");
    exportCsv();
  }

  // Drag files onto stage
  ;["dragenter", "dragover"].forEach((ev) => {
    stage.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  stage.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      onFilesSelected(e.dataTransfer.files);
    }
  });

  // Buttons
  document.getElementById("btnLoadDemo").addEventListener("click", loadDemo);
  document.getElementById("btnLoadFolder").addEventListener("click", loadFolderPicker);
  document.getElementById("btnPause").addEventListener("click", togglePause);
  document.getElementById("btnUndo").addEventListener("click", undo);
  document.getElementById("btnExportJson").addEventListener("click", exportJson);
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
  document.getElementById("btnExportFolders").addEventListener("click", exportFolders);
  fileInput.addEventListener("change", () => {
    if (fileInput.files) onFilesSelected(fileInput.files);
  });

  updateProgress();
  raf = requestAnimationFrame(tick);

  // Auto-load demo for first paint convenience
  loadDemo().catch(() => {});
})();
