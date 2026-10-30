// Builds a minimal but structurally-real .pptx for exercising the Rust
// importer against an actual OOXML zip: two slides, a title + body text box
// with mixed runs and colours, an image, and a decorative background rect.
import { deflateRawSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const enc = new TextEncoder();

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBytes.length, 26);
    local.push(lh, Buffer.from(nameBytes), comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBytes.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, Buffer.from(nameBytes));
    offset += 30 + nameBytes.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuf, end]);
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const slide1 = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="BG"/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:solidFill><a:srgbClr val="102040"/></a:solidFill></p:spPr></p:sp>
    <p:sp><p:nvSpPr><p:cNvPr id="3" name="Title"/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="10363200" cy="1143000"/></a:xfrm></p:spPr>
      <p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/>
        <a:r><a:rPr sz="4400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>Welcome</a:t></a:r>
      </a:p></p:txBody></p:sp>
    <p:pic><p:nvPicPr><p:cNvPr id="4" name="Logo"/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
      <p:spPr><a:xfrm><a:off x="5486400" y="4572000"/><a:ext cx="1219200" cy="1219200"/></a:xfrm></p:spPr></p:pic>
  </p:spTree></p:cSld>
</p:sld>`;

const slide2 = `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="1A2B3C"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/></p:nvSpPr>
      <p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="10363200" cy="5029200"/></a:xfrm></p:spPr>
      <p:txBody><a:bodyPr/><a:p><a:pPr algn="l"/>
        <a:r><a:rPr sz="2400" i="1"><a:solidFill><a:srgbClr val="00C8C8"/></a:solidFill></a:rPr><a:t>Italic line</a:t></a:r>
        <a:br/>
        <a:r><a:rPr sz="2400"/><a:t>Second line</a:t></a:r>
      </a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

const entries = [
  {
    name: "ppt/presentation.xml",
    data: Buffer.from(`<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>
</p:presentation>`),
  },
  {
    name: "ppt/_rels/presentation.xml.rels",
    data: Buffer.from(`<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="slide" Target="slides/slide2.xml"/>
</Relationships>`),
  },
  { name: "ppt/slides/slide1.xml", data: Buffer.from(slide1) },
  {
    name: "ppt/slides/_rels/slide1.xml.rels",
    data: Buffer.from(`<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId2" Type="image" Target="../media/image1.png"/>
</Relationships>`),
  },
  { name: "ppt/slides/slide2.xml", data: Buffer.from(slide2) },
  { name: "ppt/media/image1.png", data: png },
];

mkdirSync("fixtures", { recursive: true });
writeFileSync("fixtures/sample.pptx", zip(entries));
console.log("wrote fixtures/sample.pptx");
