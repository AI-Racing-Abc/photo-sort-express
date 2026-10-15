# Photo Sort Express · 照片分拣快递

A playful Mac photo sorter: images ride a conveyor belt left → right; you drop them into drawers **A S D F** like express package sorting.

**Safety rule:** the game only **copies** into Mac drawers A/S/D/F. It never deletes or moves originals — including photos still on your iPhone.

## iPhone 14 → Mac → Game (recommended flow)

Keep originals on the phone. Import (or AirDrop) a **copy** onto the Mac first, then load that Mac folder in the game.

### 1) Get photos onto the Mac (pick one)

**A. AirDrop (fast for a few shots)**  
iPhone Photos → Share → AirDrop → your Mac. Files land in Downloads (or the folder you chose). Phone originals stay.

**B. Finder (cable / USB)**  
1. Unlock iPhone, trust the Mac if asked.  
2. Connect Lightning/USB-C cable.  
3. Finder sidebar → your iPhone → **Photos** (or Files).  
4. Import / drag selected photos into a Mac folder, e.g. `~/Desktop/inbox-photos`.  
5. Eject when done. Nothing is removed from the phone unless you use a tool that explicitly deletes — **don’t**.

**C. Image Capture.app (selective import)**  
1. Open **Image Capture** (系统自带「图像捕捉」).  
2. Select iPhone → choose a destination folder on Mac.  
3. Import selected items. Leave “Delete after import” **unchecked** (if shown).

**D. Photos.app sync / export**  
If you use iCloud Photos or a wired import into Photos: select albums → **File → Export → Export Unmodified Original** into a Mac folder. Phone/library originals remain.

### 2) Play

1. Open this app (see Quick start).  
2. Click **Load Folder** → choose the Mac inbox folder (not the iPhone itself).  
3. Sort into drawers A/S/D/F on the belt.  
4. Click **Copy to A/S/D/F on Mac** → pick a destination folder on the Mac. The game creates subfolders `A` `S` `D` `F` and **copies** files there.  
5. Source inbox folder and iPhone stay unchanged.

```
iPhone (originals kept)
    ↓ AirDrop / Finder / Image Capture / Photos export
Mac inbox folder  (e.g. ~/Desktop/inbox-photos)
    ↓ Load Folder in game
Sort on conveyor → drawers A/S/D/F
    ↓ Copy to A/S/D/F on Mac
Mac output/A · S · D · F   (copies only)
```

## Quick start (Mac)

### Option A — open in browser

1. Finder → `photo-sort-game` folder.  
2. Double-click `index.html`.  
3. If demo images don’t appear (`file://` block), use Option B.

### Option B — local server (recommended)

```bash
cd ~/Desktop/photo-sort-game
python3 -m http.server 8765
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765)

## How to play

**Hotkeys (four drawers):** `A` `S` `D` `F` — left-hand home row, like sorting packages fast.

1. **Load Demo** or **Load Folder** (images; videos show a still frame).  
2. Drag onto a drawer, or press **A S D F** (home-row keys).  
3. **Space** / **P** = pause · **U** = undo.  
4. Optional local music file.  
5. **Export JSON / CSV** for a filename→drawer list, or **Copy to A/S/D/F on Mac** (Chrome/Edge).

## Features

- Conveyor belt, **4 drawers A / S / D / F**  
- Drag-and-drop + keyboard  
- Undo, progress counter  
- Local music  
- Export JSON/CSV  
- **Copy** into Mac subfolders A/S/D/F (File System Access API)  
- Offline · EN + 中文 labels  
- iPhone-safe workflow documented above  

## Files

```
photo-sort-game/
  index.html
  style.css
  app.js
  README.md
  samples/
```

## Limits

- Always import to a **Mac folder** first; do not point the game at the live iPhone volume as a “delete” workflow — the game only reads blobs you load and copies out.  
- `file://` may block demo `samples/` fetch — use `python3 -m http.server`.  
- **Copy to A/S/D/F on Mac** needs Chrome/Edge (`showDirectoryPicker`). Safari: export CSV/JSON, then copy files manually.  
- HEIC may need conversion in some browsers.  
- Videos: thumbnail only, no full playback.  
- **Never deletes** source files or phone originals.

## Idea credit

Jeffrey / 007 — express-sorting game concept.
