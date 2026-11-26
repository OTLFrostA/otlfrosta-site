/* Generate website samples with the pinned released renderer, not look-alike files.
 * Run after installing the pinned exporter checkout's dependencies:
 * node -r ./.exporter/tests/ts_register.js scripts/generate-examples.cjs .exporter public/demo
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { deflateSync } = require('node:zlib');
const { execFileSync } = require('node:child_process');
const root = path.resolve(process.argv[2] || '.exporter');
const out = path.resolve(process.argv[3] || 'public/demo');
const load = (file) => require(path.join(root, file));
const { historicalFixture } = load('tests/helpers/nativeFixture.js');
const { composeFixture } = load('tests/helpers/documentFixture.js');
const { renderDocumentDocx } = load('src/l4/format/docx/renderDocx.js');
const JSZip = load('lib/jszip.min.js');
const { renderDocumentHtml } = load('src/l4/format/html/renderHtml.js');
const { renderDocumentMarkdown } = load('src/l4/format/markdown/renderMarkdown.js');
const { serializeDomainJson } = load('src/l4/format/json/serializeDomainJson.js');
const { renderTypstFixture } = load('tests/helpers/renderTypstFixture.js');
const { convertMathForTest } = load('tests/helpers/mathConversion.js');
const { TypstSandboxCompiler } = load('src/l4/format/pdf/typst/typstSandboxCompiler.js');
const { RealWasmSandboxHost } = load('tests/helpers/realWasmSandbox.js');
const { extractPdfText } = load('tests/helpers/pdfTextExtract.js');
const version = load('package.json').version;
assert.equal(version, '2.1.1', 'Do not silently change the published sample version');

// Synthetic illustration: five bars, generated offline. No user data or third-party image.
function chartPng() {
  const w = 480, h = 220;
  const pixels = Buffer.alloc((w * 3 + 1) * h, 255);
  for (let y = 0; y < h; y++) pixels[y * (w * 3 + 1)] = 0;
  const rect = (x, y, width, height, color) => {
    for (let j=y; j<y+height; j++) for (let i=x; i<x+width; i++) {
      const p=j*(w*3+1)+1+i*3; pixels[p]=color[0]; pixels[p+1]=color[1]; pixels[p+2]=color[2];
    }
  };
  rect(0,0,w,h,[247,249,252]);
  for(const y of [39,78,117,156,195]) rect(38,y,410,1,[220,228,240]);
  [78,112,149,131,96].forEach((v,i)=>rect(58+i*78,195-v,46,v,[55,95,211]));
  rect(38,195,410,2,[135,153,184]);
  const crc32 = data => {let c=0xffffffff;for(const n of data){c^=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  const chunk = (type, data) => { const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]); };
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}

async function main() {
  const body = [
    '## Estimate daily energy',
    'A solar array turns sunlight into electricity. A simple estimate uses rated panel capacity, equivalent full-sun hours, and an efficiency factor.',
    '',
    '$$',
    'E = P \\times H \\times \\eta',
    '$$',
    '',
    'For a 4 kW system with five sun-hours and 80% efficiency, the estimated output is **16 kWh** per day.',
    '',
    '## Compare three conditions',
    '',
    '| Sun hours | Efficiency | Daily energy |',
    '| --- | --- | --- |',
    '| 3 | 80% | 9.6 kWh |',
    '| 5 | 80% | 16.0 kWh |',
    '| 7 | 80% | 22.4 kWh |',
    '',
    '## Calculate it in Python',
    '',
    '```python',
    'def daily_energy(capacity_kw, sun_hours, efficiency=0.8):',
    '    return capacity_kw * sun_hours * efficiency',
    '',
    'print(daily_energy(4, 5))  # 16.0 kWh',
    '```',
    '',
    'The example image illustrates relative daily output. The attached CSV contains synthetic readings. Actual production varies with weather, orientation, and shading.',
  ].join('\n');
  const native = historicalFixture({
    id:'website-demo-solar',title:'Solar energy at home',createdAt:1795564800000,
    messages:[
      {role:'user',content:'Explain how to estimate the daily energy from a rooftop solar system. Include a formula, a comparison table, a Python example, and sample data.'},
      {role:'model',content:body,attachments:[
        {type:'image',name:'daily-output.png',localName:'assets/daily-output.png'},
        {type:'file',name:'daily-output.csv',title:'daily-output.csv',localName:'files/daily-output.csv'}
      ]}
    ]
  }, {providerId:'gemini'});
  const { document, resources } = await composeFixture(native.conversation, native.resourceHints, native.sourceVersion, native.acquisitionHints);
  const inputs = {'daily-output.png':chartPng(),'daily-output.csv':Buffer.from('day,kwh\nMon,10\nTue,14\nWed,19\nThu,17\nFri,12\n')};
  const stage = fs.mkdtempSync(path.join(os.tmpdir(),'gemini-site-example-'));
  const store = {};
  fs.mkdirSync(out,{recursive:true});
  const write = (relative, value) => {
    const dest = path.resolve(stage,relative);
    assert(dest.startsWith(stage+path.sep),'resource escaped example directory');
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,value);
  };
  for(const [id,relative] of Object.entries(resources)){
    const bytes=inputs[path.basename(relative)];
    assert(bytes,'Unexpected sample resource '+relative);
    store[id]=new Uint8Array(bytes);write(relative,bytes);
  }
  assert.equal(Object.keys(store).length,2,'Both synthetic attachments must be bound');
  const html=renderDocumentHtml(document,resources,{locale:'en'});
  const md=renderDocumentMarkdown(document,resources,{locale:'en'});
  const json=serializeDomainJson(native.conversation,native.account,resources);
  assert(!html.diagnostics.some(d=>d.severity==='error'),'HTML render error');
  for(const needle of ['gem-table','gem-code-block','gem-math','gem-image-block']) assert(html.html.includes(needle),'Missing HTML content '+needle);
  assert(md.includes('daily_energy') && md.includes('daily-output.png') && md.includes('daily-output.csv'),'Markdown omitted sample content');
  assert.equal(JSON.parse(json).format,'gemini-exporter-domain');
  const prepared = new Map(Object.entries(resources).map(([id,relative])=>[id,{ok:true,resourceId:id,value:{bytes:store[id],mediaType:relative.endsWith('.png')?'image/png':'text/csv'}}]));
  const word = Buffer.from(await renderDocumentDocx(document,resources,prepared,{locale:'en'}));
  const wordZip = await JSZip.loadAsync(word);
  const wordXml = await wordZip.file('word/document.xml').async('string');
  assert(wordXml.includes('daily_energy') && wordXml.includes('<w:tbl>'),'Word lost sample code or table');
  assert(Object.keys(wordZip.files).some(name=>name.startsWith('word/media/') && name.endsWith('.png')),'Word lost the sample image');
  assert(wordXml.includes('<m:oMath'),'Word lost native mathematical notation');
  console.log('Generated genuine sample DOCX with native math, table and image.');
  const {payload,diagnostics}=renderTypstFixture(document,resources,{locale:'en',convertMath:convertMathForTest});
  const compiler=new TypstSandboxCompiler({host:new RealWasmSandboxHost(root)});
  let pdf;
  try {
    const result=await compiler.compile({rendererSchemaVersion:1,document:payload,assetPaths:new Map(Object.entries(resources))},{
      assets:{resolve:async id=>store[id]?{bytes:store[id]}:null},
      locale:'en',signal:new AbortController().signal,reportProgress:()=>undefined
    });
    assert(![...diagnostics,...result.diagnostics].some(d=>d.severity==='error'),'PDF render error');
    pdf=Buffer.from(result.pdfBytes);
    assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
    const proof=extractPdfText(pdf);
    assert(proof.pageCount>=1 && proof.imageXObjectCount>=1,'PDF must contain the example image');
    assert(proof.text.replace(/\s+/g,'').includes('daily_energy'),'PDF lost the code example');
    console.log('Generated genuine sample PDF: '+proof.pageCount+' pages, '+proof.imageXObjectCount+' image XObjects.');
  } finally {compiler.dispose();}
  try {
    for(const [name,value] of Object.entries({'solar-energy.pdf':pdf,'solar-energy.docx':word,'solar-energy.md':md,'solar-energy.html':html.html,'solar-energy.json':json})) write(name,value);
    for(const ext of ['pdf','docx','md','json']) fs.copyFileSync(path.join(stage,'solar-energy.'+ext),path.join(out,'solar-energy.'+ext));
    const resourcePaths=Object.values(resources);
    execFileSync('zip',['-q',path.join(out,'solar-energy.zip'),'solar-energy.pdf','solar-energy.docx','solar-energy.md','solar-energy.html','solar-energy.json',...resourcePaths],{cwd:stage});
    execFileSync('zip',['-q',path.join(out,'solar-energy-html.zip'),'solar-energy.html',...resourcePaths],{cwd:stage});
    execFileSync('pdftoppm',['-f','1','-l','1','-singlefile','-scale-to','1188','-png',path.join(out,'solar-energy.pdf'),path.join(out,'pdf-preview')]);
    fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({version,sourceCommit: '67c7dc5eb5e4d1cac2a8cf0171bf684b1474b152',input:'synthetic website demonstration',renderers:['PDF','Word','Markdown','HTML','JSON'],resourceCount:Object.keys(store).length},null,2)+'\n');
  } finally {fs.rmSync(stage,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
