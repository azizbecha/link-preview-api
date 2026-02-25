interface ImageDimensions {
  width: number;
  height: number;
}

function parsePng(buf: Uint8Array): ImageDimensions | null {
  // PNG: bytes 16-19 = width, 20-23 = height (big-endian)
  if (buf.length < 24) return null;
  const view = new DataView(buf.buffer, buf.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function parseGif(buf: Uint8Array): ImageDimensions | null {
  // GIF: bytes 6-7 = width, 8-9 = height (little-endian)
  if (buf.length < 10) return null;
  const view = new DataView(buf.buffer, buf.byteOffset);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function parseWebp(buf: Uint8Array): ImageDimensions | null {
  if (buf.length < 30) return null;
  const view = new DataView(buf.buffer, buf.byteOffset);

  // VP8 (lossy)
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x20) {
    if (buf.length < 30) return null;
    // Frame header starts at offset 26
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  // VP8L (lossless)
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x4c) {
    if (buf.length < 25) return null;
    const bits = view.getUint32(21, true);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  // VP8X (extended)
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x58) {
    if (buf.length < 30) return null;
    return {
      width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
      height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
    };
  }

  return null;
}

function parseJpeg(buf: Uint8Array): ImageDimensions | null {
  if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const view = new DataView(buf.buffer, buf.byteOffset);
  let offset = 2;

  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];

    // SOF markers (0xC0-0xCF except 0xC4 and 0xC8)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
      if (offset + 9 > buf.length) return null;
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }

    const segLen = view.getUint16(offset + 2);
    offset += 2 + segLen;
  }

  return null;
}

function parseFromBuffer(buf: Uint8Array): ImageDimensions | null {
  // PNG signature: 0x89 P N G
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return parsePng(buf);
  }
  // GIF signature: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return parseGif(buf);
  }
  // WebP signature: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return parseWebp(buf);
  }
  // JPEG signature: 0xFF 0xD8
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return parseJpeg(buf);
  }
  return null;
}

export async function fetchImageSize(
  imageUrl: string,
  timeout: number
): Promise<ImageDimensions | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { Range: "bytes=0-32767" },
    });

    if (!response.ok && response.status !== 206) return null;

    const buf = new Uint8Array(await response.arrayBuffer());
    return parseFromBuffer(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
