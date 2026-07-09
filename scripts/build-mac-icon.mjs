import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { spawn } from "node:child_process";

const root = process.cwd();
const assetsDir = path.join(root, "assets");
const iconsetPath = path.join(assetsDir, "icon.iconset");
const icnsPath = path.join(assetsDir, "icon.icns");
const sourcePngPath = path.join(assetsDir, "icon-1024.png");

const iconFiles = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

const background = [245, 248, 244, 255];
const mark = [33, 95, 80, 255];
const samples = 3;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function insideRoundedRect(x, y, rect) {
  const { left, top, width, height, radius } = rect;
  const right = left + width;
  const bottom = top + height;
  if (x < left || x > right || y < top || y > bottom) return false;

  const innerLeft = left + radius;
  const innerRight = right - radius;
  const innerTop = top + radius;
  const innerBottom = bottom - radius;
  if ((x >= innerLeft && x <= innerRight) || (y >= innerTop && y <= innerBottom)) return true;

  const cx = x < innerLeft ? innerLeft : innerRight;
  const cy = y < innerTop ? innerTop : innerBottom;
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function sampleColor(x, y) {
  const bgRect = { left: 0, top: 0, width: 1024, height: 1024, radius: 224 };
  const markRects = [
    { left: 308, top: 262, width: 112, height: 500, radius: 30 },
    { left: 456, top: 222, width: 112, height: 580, radius: 30 },
    { left: 604, top: 262, width: 112, height: 500, radius: 30 }
  ];

  for (const rect of markRects) {
    if (insideRoundedRect(x, y, rect)) return mark;
  }

  if (insideRoundedRect(x, y, bgRect)) return background;
  return [0, 0, 0, 0];
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    scanlines[rowStart] = 0;
    rgba.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(scanlines, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const sampleCount = samples * samples;
  const scale = 1024 / size;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const color = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = (px + (sx + 0.5) / samples) * scale;
          const y = (py + (sy + 0.5) / samples) * scale;
          const sampled = sampleColor(x, y);
          color[0] += sampled[0];
          color[1] += sampled[1];
          color[2] += sampled[2];
          color[3] += sampled[3];
        }
      }

      const offset = (py * size + px) * 4;
      rgba[offset] = Math.round(color[0] / sampleCount);
      rgba[offset + 1] = Math.round(color[1] / sampleCount);
      rgba[offset + 2] = Math.round(color[2] / sampleCount);
      rgba[offset + 3] = Math.round(color[3] / sampleCount);
    }
  }

  return encodePng(size, size, rgba);
}

await mkdir(assetsDir, { recursive: true });
await rm(iconsetPath, { recursive: true, force: true });
await mkdir(iconsetPath, { recursive: true });
await writeFile(sourcePngPath, renderIcon(1024));

for (const [fileName, size] of iconFiles) {
  await run("sips", ["-z", String(size), String(size), sourcePngPath, "--out", path.join(iconsetPath, fileName)]);
}

await run("iconutil", ["-c", "icns", iconsetPath, "-o", icnsPath]);
