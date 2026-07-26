# ion-beam bug review — workplan

This review covers the traffic/Inspect instrumentation, the ion layout parser, the EIC and imaging pipelines (including the worker), the React context/provider, the UI components, and the mock server. It found **10 genuine defects: 2 high, 4 medium, 4 low**. They cluster in three areas: SampleFile lifecycle (a disposed wasm file handle can be reused both in the image worker and in the main-thread EIC flow), missing failure paths in the worker/image pipeline (hangs and duplicated multi-megabyte recomputation), and the mock server (three distinct ways to crash the process). The verification-heavy code came out clean: `crc32.ts` is a correct standard CRC-32, `ionLayout.ts` header offsets were checked field-by-field against the ionic v0 spec and all match (including block-directory placement after the payload and the directory CRCs at 1000/1004), the coverage-interval merge in `traffic.ts` (`addCovered`) is correct for half-open intervals, and no real defects were found in `format.ts`, `reducer.ts` state transitions, `EicPlot`, `PeakTable`, `ConfigPanel`, `SampleList`, `CompoundList`, `ImageView`, `ImageTargets`, `RamMeter`, or `vite.config.ts`.

# Findings

## 1. imageWorker keeps a disposed SampleFile after a failed open, then reuses it forever
- **Severity:** high
- **File:** `src/ms/imageWorker.ts`
- **Where:** `open()`, lines 20–29
- **Bug:** `open()` disposes the currently open file *before* attempting `parseIon` for the new URL, but only updates `openUrl` *after* `parseIon` succeeds. If `parseIon` rejects, `openUrl` still points at the old URL while `openFile` is the already-disposed old handle.
- **Why it's a bug:** Sequence: (1) imaging mode, sample A opens fine and renders images; (2) user picks sample B whose file is missing/unreadable — `openFile` (A's handle) is disposed, then `parseIon(B)` throws, the job errors out, and `openUrl` remains A's URL with `openFile` = disposed A handle; (3) user switches back to sample A and selects any target — `open(A)` sees `url === openUrl`, skips reopening, and returns the disposed handle. `getIonImage` then fails ("file has been disposed" — quantion's `assertValid` throws on any use after dispose) for **every** subsequent image of sample A, permanently, since the guard never allows a reopen of that URL.
- **How to fix:** Clear state before the risky operations: at the top of the `if (url !== openUrl)` branch do `openFile?.dispose?.(); openFile = null; openUrl = null;` and only set `openUrl = url` after `parseIon` resolves. That way a failed open leaves `openUrl === null` and the next job reopens cleanly.

## 2. Disposed SampleFile left in app state; EIC runs against it (mode toggle / sample-switch race)
- **Severity:** high
- **File:** `src/context/AppProvider.tsx` (with `src/context/reducer.ts`)
- **Where:** open-file effect lines 66–87, EIC effect lines 89–104; `fileOpened` state at `reducer.ts` line 337
- **Bug:** The open-file effect's cleanup calls `opened?.dispose?.()`, but nothing removes the now-dead `SampleFile` from `state.file`. `selectView` will happily hand that disposed handle back out whenever `state.file.url` matches the current URL again, and the EIC effect will call `getEic` on it.
- **Why it's a bug:** Two concrete triggers. (a) Mode toggle: open a sample in EIC mode (file F stored via `fileOpened`), switch to imaging (cleanup runs, F is disposed; `state.file` still holds F), switch back to EIC. On that render `selectView` returns F (url matches, status "ok"), the EIC effect's `file` dep changed (null → F during imaging → F again), so it fires `getEic(F, …)` against the disposed handle — quantion throws "file has been disposed" and the user sees a "Could not build the chromatogram" error banner (and if the async re-open then fails, the app is stuck on the error with a dead handle in state). (b) In-flight dispose: pick sample A with an m/z selected (EIC streaming block reads), then pick sample B — the cleanup disposes A's file while `calculateEic(A)` is mid-await, so the wasm-side reads run against a freed file handle (quantion's `range_read` callback returns −1 for the removed handle at best; use-after-free of native state at worst).
- **How to fix:** When the open-file effect cleans up, also clear the state — dispatch a `fileClosed`/`fileFailed`-style action (e.g. add `{ type: "fileClosed", url }` that nulls `draft.file` when the URL matches) so `selectView` can never return a disposed handle. For (b), delay `dispose()` until in-flight work completes (e.g. track a refcount/promise for the running `getEic` and dispose in a `finally`), or verify quantion tolerates dispose-during-read and at minimum guard the EIC effect from firing on a file that has been marked closed.

## 3. imageClient never handles worker failure — a crashed worker hangs the UI forever
- **Severity:** medium
- **File:** `src/ms/imageClient.ts`
- **Where:** `requestImage()`, lines 40–64
- **Bug:** The returned promise only settles when a `message` event arrives with a matching id. There is no `error` or `messageerror` listener on the worker and no timeout.
- **Why it's a bug:** The image worker holds a 256 MB cache and decompresses whole imaging datasets; if it dies from OOM, or its module fails to load/instantiate (wasm init failure), no `message` event with the pending id ever fires. The promise never settles, the `.catch` in `AppProvider`'s image effect never runs, no `imageFailed` is dispatched, and the user is stuck watching `ComputeProgress` indefinitely with no error. Every subsequently posted job also silently vanishes because the dead worker object is cached in `worker` and reused.
- **How to fix:** In `getWorker()`, attach `worker.onerror` / `worker.onmessageerror` handlers that reject all pending requests (keep a `Map<number, {resolve, reject}>` instead of per-request `addEventListener`), then null out `worker` so the next `requestImage` spawns a fresh one.

## 4. Inspect panel records nothing in imaging mode — worker fetches bypass the monkeypatch
- **Severity:** medium
- **File:** `src/ms/traffic.ts` (with `src/ms/imageWorker.ts`)
- **Where:** `watchDownloads()`, lines 106–118
- **Bug:** `watchDownloads` patches `globalThis.fetch` on the main thread only. All imaging downloads happen inside the module worker (`imageWorker.ts` → quantion's `fetch` in worker scope), which has its own global `fetch` that is never wrapped. Meanwhile `AppProvider` still calls `trackSample(url)` for the imaging sample (line 62–64).
- **Why it's a bug:** Open imaging mode, select a target, and open the Inspect panel: the worker streams tens of megabytes of block data, yet the panel shows the imaging sample's name with "Downloaded 0 B", 0 requests, and "Waiting for the file header…" forever. The feature's stated purpose (tracking downloaded bytes per section for the tracked sample) reports a flatly wrong result — zero — for the entire imaging path.
- **How to fix:** Instrument the worker too: either wrap `fetch` inside `imageWorker.ts` and `postMessage` the served ranges (url, Content-Range triplet) back to the main thread where `record`-equivalent accounting runs, or move traffic accounting into a shared module the worker reports into. Alternatively, make the panel explicit that imaging traffic is not tracked instead of silently showing zeros.

## 5. mock-server: malformed percent-encoding in the URL crashes the whole server process
- **Severity:** medium
- **File:** `mock-server.mjs`
- **Where:** request handler, line 71 (`decodeURIComponent(url.pathname.slice(1))`)
- **Bug:** `decodeURIComponent` throws `URIError: URI malformed` on invalid escape sequences, and the call sits outside any try/catch inside the HTTP request callback.
- **Why it's a bug:** `curl 'http://localhost:9000/%zz'` (or any client/scanner sending a bad escape) throws an uncaught exception in the `request` handler, which terminates the Node process — one bad request takes down the file server for everyone. (Path traversal, by contrast, is handled: `join(data_dir, basename(name))` strips directories.)
- **How to fix:** Wrap the decode: `let name; try { name = decodeURIComponent(url.pathname.slice(1)); } catch { res.writeHead(400, cors_headers); return res.end("bad url"); }` — and consider wrapping the whole handler body in try/catch as a safety net.

## 6. mock-server: headers written before the listing is computed — a listing error double-writes headers and crashes
- **Severity:** medium
- **File:** `mock-server.mjs`
- **Where:** request handler, lines 77–83
- **Bug:** `res.writeHead(200, …)` executes before `list_files()` runs (it's evaluated inside the `res.end(JSON.stringify(list_files()))` expression). If `readdirSync(data_dir)` throws, the catch block calls `res.writeHead(500, …)` after the 200 headers were already sent, which throws `ERR_HTTP_HEADERS_SENT` — uncaught, killing the process.
- **Why it's a bug:** `data_dir` is a hardcoded absolute path (`/Users/josorio/Documents/Projects/quantion/tripletof6600`). On any machine where that directory doesn't exist — i.e. anyone else running the mock server — the very first `GET /` (the sample-listing request the app issues on load) crashes the server instead of returning an error.
- **How to fix:** Compute first, write second: `let body; try { body = JSON.stringify(list_files()); } catch (e) { res.writeHead(500, {...}); return res.end(JSON.stringify({error: String(e?.message ?? e)})); } res.writeHead(200, {...}); res.end(body);`

## 7. Image effect has no "pending" marker — re-selecting a target queues duplicate full computations
- **Severity:** low
- **File:** `src/context/AppProvider.tsx`
- **Where:** image effect, lines 134–179 (guard at line 137: `if (images[key]) return undefined`)
- **Bug:** The only dedupe is `images[key]`, which is set when a result *arrives* (`imageReady`/`imageFailed`). While a job is in flight there is no record of it, so re-triggering the effect posts a second identical job.
- **Why it's a bug:** Select target A (job posted, minutes of block streaming begin), click target B, click back to A: the third effect run sees `images[keyA]` still unset and posts a *second* full job for A. The worker chain is strictly serial with no cancellation, so A is computed twice end-to-end (the first result is discarded because its effect closure went inactive). Rapidly flipping between targets/samples stacks up a long queue of redundant multi-megabyte computations, during which nothing selected can render.
- **How to fix:** Track in-flight keys — e.g. dispatch an `imagePending` marker into `images[key]` (status "pending") before calling `requestImage`, or keep a module-level `Set<string>` of in-flight keys in `imageClient.ts` and return the existing promise for a duplicate request. Ideally also support cancelling superseded jobs in the worker.

## 8. useDrag: releasing the mouse outside the window leaves the drag stuck; offset is unclamped
- **Severity:** low
- **File:** `src/utilities/useDrag.ts`
- **Where:** `onGrab()`, lines 15–36
- **Bug:** Plain `mousemove`/`mouseup` window listeners without pointer capture: if the user drags the Inspect panel, moves the cursor outside the browser window, and releases the button there, the `mouseup` never fires — listeners stay attached and `dragging` stays on `document.body`. Additionally the computed offset is never clamped to the viewport.
- **Why it's a bug:** After releasing outside the window and moving the cursor back in, the panel glues itself to the cursor with no button held (every `mousemove` keeps repositioning it) until the user performs another click; the `dragging` body class also sticks. And because offsets are unbounded, the panel (header included) can be dropped entirely off-screen, leaving no drag handle visible — recoverable only by toggling the panel closed/open.
- **How to fix:** Use pointer events with `setPointerCapture` on the header (then `pointerup` is always delivered), or at minimum bail out in `move` when `moveEvent.buttons === 0` and also listen for `window` `blur`. Clamp the applied offset so the header always stays within the viewport (e.g. clamp against `window.innerWidth/innerHeight` in `move`).

## 9. traffic: error responses are counted as downloaded file bytes
- **Severity:** low
- **File:** `src/ms/traffic.ts`
- **Where:** fetch wrapper line 111–117 and `readServed()`, lines 256–270 (`record()` never checks `response.ok`)
- **Bug:** Any response whose URL ends in the tracked filename is recorded — including 4xx/5xx. `readServed` falls back to `Content-Length` and fabricates `{start: 0, end: length, total: length}` for non-range responses.
- **Why it's a bug:** If a tracked sample's range fetch fails (file deleted server-side → mock server returns 404 with body "file not found", Content-Length 14), `record` counts 14 downloaded bytes at offset 0–14 and — because this happens before any header arrives — sets `fileSize = 14`. The Inspect panel then reports "Downloaded 14 B of 14 B — 100%" for a file that was never read, and each retry inflates `requests`/`downloaded` with error-page bytes.
- **How to fix:** In the fetch wrapper (or at the top of `record`), skip accounting unless `response.ok` (and only trust the Content-Length fallback for `status === 200`; range accounting should require `status === 206` with a valid `Content-Range`).

## 10. mock-server: no error handler on the file read stream — a stream error crashes the process
- **Severity:** low
- **File:** `mock-server.mjs`
- **Where:** `send_file()`, lines 49 and 61 (`createReadStream(path).pipe(res)`)
- **Bug:** `pipe` does not forward or handle `error` events on the source stream; an unhandled `error` on a `ReadStream` is an uncaught exception.
- **Why it's a bug:** The file is `statSync`-ed, then opened lazily by `createReadStream`. If the file is deleted or becomes unreadable between the stat and the open (or an I/O error occurs mid-transfer of a multi-gigabyte .ion file), the stream emits `error` with no listener and the Node process dies, killing all concurrent transfers.
- **How to fix:** Attach a handler: `const stream = createReadStream(...); stream.on("error", () => res.destroy()); stream.pipe(res);` (destroying the response aborts the transfer without taking down the server).
