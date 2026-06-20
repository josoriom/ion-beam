import { createReadStream, statSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join, basename } from "node:path";

const port = Number(process.env.MOCK_PORT) || 9000;
const data_dir = process.argv[2] ?? "/Users/josoriom/github/josoriom/streaming/data";

const cors_headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
};

function list_files() {
  return readdirSync(data_dir)
    .filter((name) => name.endsWith(".ion"))
    .sort();
}

function read_range(header, size) {
  const match = /bytes=(\d+)-(\d*)/.exec(header ?? "");
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function send_file(req, res, name) {
  const path = join(data_dir, basename(name));
  let size;
  try {
    size = statSync(path).size;
  } catch {
    res.writeHead(404, cors_headers);
    return res.end("file not found");
  }

  const range = read_range(req.headers.range, size);
  if (!range) {
    res.writeHead(200, {
      ...cors_headers,
      "Accept-Ranges": "bytes",
      "Content-Length": size,
      "Content-Type": "application/octet-stream",
    });
    if (req.method === "HEAD") return res.end();
    return createReadStream(path).pipe(res);
  }

  const length = range.end - range.start + 1;
  res.writeHead(206, {
    ...cors_headers,
    "Accept-Ranges": "bytes",
    "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
    "Content-Length": length,
    "Content-Type": "application/octet-stream",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(path, { start: range.start, end: range.end }).pipe(res);
}

createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors_headers);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${port}`);
  const name = decodeURIComponent(url.pathname.slice(1));

  if (name.endsWith(".ion")) {
    return send_file(req, res, name);
  }

  try {
    res.writeHead(200, { ...cors_headers, "Content-Type": "application/json" });
    res.end(JSON.stringify(list_files()));
  } catch (error) {
    res.writeHead(500, { ...cors_headers, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(error?.message ?? error) }));
  }
}).listen(port, () => {
  console.log(`file server on http://localhost:${port}`);
  console.log(`serving ${data_dir}`);
});
