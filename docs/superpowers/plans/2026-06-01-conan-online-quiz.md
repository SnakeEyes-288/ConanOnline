# Conan Online Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable Thai-language Detective Conan realtime quiz where players race to be the first correct answer in 10-round rooms.

**Architecture:** Create a small npm workspace with `client`, `server`, and `shared` packages. The React client renders the Detective Board UI and connects to the Render Socket.IO server; the Node server owns rooms, timers, answer validation, and scoring; shared data exposes the 50-character roster and clues.

**Tech Stack:** npm workspaces, Vite, React, Socket.IO, Express, Vitest, plain CSS, Vercel frontend deployment, Render backend deployment.

---

## File Structure

- Create `package.json`: workspace root scripts for installing, testing, and checking both apps.
- Create `.gitignore`: ignore dependencies, build output, env files, and brainstorm artifacts.
- Create `shared/package.json`: shared package metadata.
- Create `shared/characters.js`: 50 Thai-language character records with ids, display names, alternate names, and five clues.
- Create `shared/gameRules.js`: constants and pure helpers for round count, timers, room limits, search, validation, and scoring.
- Create `shared/gameRules.test.js`: Vitest tests for shared rules.
- Create `server/package.json`: backend scripts and dependencies.
- Create `server/src/roomStore.js`: pure room lifecycle and answer race logic.
- Create `server/src/roomStore.test.js`: backend unit tests.
- Create `server/src/index.js`: Express health endpoint and Socket.IO event wiring.
- Create `server/.env.example`: local backend environment example.
- Create `client/package.json`: frontend scripts and dependencies.
- Create `client/index.html`: Vite entry document.
- Create `client/src/main.jsx`: React bootstrap.
- Create `client/src/socket.js`: Socket.IO client factory.
- Create `client/src/App.jsx`: app state machine and screens.
- Create `client/src/App.css`: Detective Board responsive styling.
- Create `client/.env.example`: local frontend environment example.
- Create `vercel.json`: Vercel build settings for the client package.
- Create `render.yaml`: Render web service Blueprint for the server package.
- Create `README.md`: local dev and deployment instructions.

---

### Task 1: Root Workspace Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create the npm workspace root**

Write `package.json`:

```json
{
  "name": "conan-online",
  "private": true,
  "type": "module",
  "workspaces": [
    "client",
    "server",
    "shared"
  ],
  "scripts": {
    "test": "npm test --workspace shared && npm test --workspace server",
    "check": "npm run build --workspace client && npm test --workspace shared && npm test --workspace server",
    "dev:server": "npm run dev --workspace server",
    "dev:client": "npm run dev --workspace client"
  }
}
```

- [ ] **Step 2: Create ignore rules**

Write `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.local
.DS_Store
.superpowers/
```

- [ ] **Step 3: Commit workspace setup**

Run:

```bash
git add package.json .gitignore
git commit -m "chore: set up npm workspace"
```

Expected: commit succeeds if the directory has been initialized as a git repository.

---

### Task 2: Shared Game Data and Rules

**Files:**
- Create: `shared/package.json`
- Create: `shared/characters.js`
- Create: `shared/gameRules.js`
- Create: `shared/gameRules.test.js`

- [ ] **Step 1: Create shared package metadata**

Write `shared/package.json`:

```json
{
  "name": "@conan-online/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "characters.js",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Add the first 50-character seed**

Write `shared/characters.js` with this exact shape. Keep all ids stable because room answers use them:

```js
export const characters = [
  { id: 'edogawa-conan', name: 'เอโดงาวะ โคนัน', aliases: ['โคนัน', 'Conan'], clues: ['เด็กประถมที่มีความสามารถด้านสืบสวนเกินวัย', 'มักใช้แว่นตาและอุปกรณ์ช่วยไขคดี', 'อาศัยอยู่ใกล้สำนักงานนักสืบโมริ', 'คอยช่วยคลี่คลายคดีโดยไม่เปิดเผยตัวจริง', 'มีความเกี่ยวข้องลึกซึ้งกับคุโด้ ชินอิจิ'] },
  { id: 'kudo-shinichi', name: 'คุโด้ ชินอิจิ', aliases: ['ชินอิจิ', 'Shinichi'], clues: ['นักสืบมัธยมปลายชื่อดัง', 'มีทักษะสังเกตและอนุมานสูงมาก', 'ชื่นชอบฟุตบอล', 'เป็นคนสำคัญของโมริ รัน', 'คดีใหญ่ทำให้ชีวิตเปลี่ยนไป'] },
  { id: 'mouri-ran', name: 'โมริ รัน', aliases: ['รัน', 'Ran'], clues: ['นักเรียนมัธยมปลายที่เก่งคาราเต้', 'เป็นเพื่อนสนิทของชินอิจิ', 'มีนิสัยอ่อนโยนแต่กล้าหาญ', 'อยู่กับพ่อที่เปิดสำนักงานนักสืบ', 'มักเป็นแรงใจสำคัญของหลายคน'] },
  { id: 'mouri-kogoro', name: 'โมริ โคโกโร่', aliases: ['โคโกโร่', 'Kogoro'], clues: ['นักสืบเอกชนเจ้าของสำนักงานโมริ', 'เคยเป็นตำรวจมาก่อน', 'มักถูกเรียกว่านักสืบหลับ', 'เป็นพ่อของโมริ รัน', 'ชอบการแข่งม้าและไอดอลบางคน'] },
  { id: 'haibara-ai', name: 'ไฮบาระ ไอ', aliases: ['ไอ', 'Haibara', 'ชิโฮะ'], clues: ['เด็กหญิงที่ดูสุขุมเกินวัย', 'มีความรู้ด้านวิทยาศาสตร์และยา', 'อยู่กับดอกเตอร์อากาสะ', 'มักระวังภัยจากองค์กรลึกลับ', 'มีบุคลิกนิ่งและพูดตรง'] },
  { id: 'agasa-hiroshi', name: 'ดอกเตอร์อากาสะ', aliases: ['อากาสะ', 'Agasa'], clues: ['นักประดิษฐ์ใจดี', 'สร้างอุปกรณ์ช่วยสืบสวนหลายอย่าง', 'เป็นเพื่อนบ้านของบ้านคุโด้', 'ดูแลเด็ก ๆ ในหลายเหตุการณ์', 'ชอบทายปริศนา'] },
  { id: 'hattori-heiji', name: 'ฮัตโตริ เฮย์จิ', aliases: ['เฮย์จิ', 'Heiji'], clues: ['นักสืบมัธยมปลายจากโอซาก้า', 'พูดสำเนียงคันไซ', 'มีความสามารถด้านเคนโด้', 'มักแข่งขันฝีมือกับชินอิจิ', 'สนิทกับโทยามะ คาซึฮะ'] },
  { id: 'toyama-kazuha', name: 'โทยามะ คาซึฮะ', aliases: ['คาซึฮะ', 'Kazuha'], clues: ['เพื่อนสนิทของฮัตโตริ เฮย์จิ', 'มาจากโอซาก้า', 'มีเครื่องรางสำคัญติดตัว', 'นิสัยจริงใจและอารมณ์ชัดเจน', 'มักห่วงเฮย์จิมากเป็นพิเศษ'] },
  { id: 'kaitou-kid', name: 'จอมโจรคิด', aliases: ['คิด', 'Kaitou Kid', 'Kid'], clues: ['จอมโจรชุดขาวผู้ชอบประกาศล่วงหน้า', 'เชี่ยวชาญมายากลและการปลอมตัว', 'มักเล็งอัญมณีล้ำค่า', 'มีลีลาการหลบหนีโดดเด่น', 'เป็นคู่ปรับที่ทำให้โคนันต้องคิดหนัก'] },
  { id: 'kuroba-kaito', name: 'คุโรบะ ไคโตะ', aliases: ['ไคโตะ', 'Kaito'], clues: ['นักเรียนมัธยมปลายที่เก่งมายากล', 'มีนิสัยขี้เล่นและมั่นใจ', 'เกี่ยวข้องกับตัวตนของจอมโจรชุดขาว', 'มักใช้กลเม็ดหลอกสายตา', 'มีคนใกล้ตัวชื่ออาโอโกะ'] },
  { id: 'nakamori-aoko', name: 'นากาโมริ อาโอโกะ', aliases: ['อาโอโกะ', 'Aoko'], clues: ['เพื่อนสนิทของคุโรบะ ไคโตะ', 'ลูกสาวตำรวจที่ไล่ล่าจอมโจรคิด', 'นิสัยตรงไปตรงมา', 'มักไม่ชอบพฤติกรรมกวน ๆ ของไคโตะ', 'เกี่ยวข้องกับฝั่งมายากลและจอมโจร'] },
  { id: 'gin', name: 'ยิน', aliases: ['Gin'], clues: ['สมาชิกองค์กรชุดดำที่น่าเกรงขาม', 'ไว้ผมยาวสีอ่อน', 'มีบุคลิกเย็นชาและโหดเหี้ยม', 'มักทำงานร่วมกับวอดก้า', 'เป็นภัยสำคัญในเงามืดของเรื่อง'] },
  { id: 'vodka', name: 'วอดก้า', aliases: ['Vodka'], clues: ['สมาชิกองค์กรชุดดำ', 'มักสวมแว่นกันแดด', 'ทำงานคู่กับยินอยู่บ่อยครั้ง', 'มีรูปร่างใหญ่', 'รับคำสั่งจากคนที่เหนือกว่าในองค์กร'] },
  { id: 'vermouth', name: 'เบลม็อท', aliases: ['Vermouth'], clues: ['สมาชิกองค์กรชุดดำที่เชี่ยวชาญการปลอมตัว', 'มีเสน่ห์และลึกลับ', 'เกี่ยวข้องกับวงการบันเทิง', 'มักเก็บความลับของตัวเองไว้มาก', 'มีท่าทีซับซ้อนต่อโคนันและรัน'] },
  { id: 'amuro-toru', name: 'อามุโร่ โทรุ', aliases: ['อามุโร่', 'ฟุรุยะ เรย์', 'เบอร์เบิน'], clues: ['ชายหนุ่มมากความสามารถที่ทำงานร้านปัวโรต์', 'มีทักษะขับรถและต่อสู้สูง', 'ใช้หลายบทบาทในโลกสืบสวน', 'เกี่ยวข้องกับชื่อเบอร์เบิน', 'เป็นคู่แข่งทางความคิดของอากาอิ'] },
  { id: 'akai-shuichi', name: 'อากาอิ ชูอิจิ', aliases: ['อากาอิ', 'Shuichi'], clues: ['มือสไนเปอร์ฝีมือสูง', 'เกี่ยวข้องกับ FBI', 'มีสายตานิ่งและอ่านเกมเก่ง', 'เป็นศัตรูสำคัญขององค์กรชุดดำ', 'มีความเชื่อมโยงกับครอบครัวอากาอิ'] },
  { id: 'sato-miwako', name: 'ซาโต้ มิวาโกะ', aliases: ['ซาโต้', 'Miwako'], clues: ['ตำรวจหญิงแผนกสืบสวน', 'กล้าหาญและขับรถเก่ง', 'เป็นที่ชื่นชมของเพื่อนร่วมงานหลายคน', 'ทำงานใกล้ชิดกับทาคางิ', 'จริงจังกับความยุติธรรม'] },
  { id: 'takagi-wataru', name: 'ทาคางิ วาตารุ', aliases: ['ทาคางิ', 'Wataru'], clues: ['ตำรวจหนุ่มนิสัยดี', 'มักร่วมสืบคดีกับซาโต้', 'มีความพยายามและจริงใจ', 'บางครั้งประหม่าในสถานการณ์สำคัญ', 'เป็นหนึ่งในตำรวจที่โคนันพบประจำ'] },
  { id: 'megure-juuzo', name: 'เมงูเระ จูโซ', aliases: ['สารวัตรเมงูเระ', 'Megure'], clues: ['สารวัตรตำรวจที่สวมหมวกเป็นเอกลักษณ์', 'ปรากฏในคดีฆาตกรรมหลายครั้ง', 'รู้จักโคโกโร่มาตั้งแต่สมัยตำรวจ', 'มีท่าทีจริงจังกับงาน', 'มักเป็นผู้ควบคุมสถานที่เกิดเหตุ'] },
  { id: 'shiratori-ninzaburo', name: 'ชิราโทริ นินซาบุโร่', aliases: ['ชิราโทริ', 'Shiratori'], clues: ['ตำรวจจากครอบครัวมีฐานะ', 'สุภาพและเจ้าระเบียบ', 'ทำงานร่วมกับทีมสืบสวนโตเกียว', 'เคยมีความรู้สึกต่อซาโต้', 'มีบทบาทในคดีเกี่ยวกับตำรวจหลายครั้ง'] },
  { id: 'chiba-kazunobu', name: 'ชิบะ คาซึโนบุ', aliases: ['ชิบะ', 'Chiba'], clues: ['ตำรวจนิสัยเป็นกันเอง', 'รูปร่างท้วมและใจดี', 'ชอบของกินและงานอดิเรกสายบันเทิง', 'ทำงานในทีมเดียวกับทาคางิ', 'มีเรื่องราวเกี่ยวกับรักวัยเด็ก'] },
  { id: 'kobayashi-sumiko', name: 'โคบายาชิ ซูมิโกะ', aliases: ['ครูโคบายาชิ', 'Kobayashi'], clues: ['ครูประจำชั้นของกลุ่มนักสืบเยาวชน', 'จริงจังกับหน้าที่ครู', 'บางครั้งมีท่าทีคล้ายตำรวจหญิงคนหนึ่ง', 'ห่วงใยเด็ก ๆ มาก', 'เกี่ยวข้องกับชิราโทริในบางช่วง'] },
  { id: 'yoshida-ayumi', name: 'โยชิดะ อายูมิ', aliases: ['อายูมิ', 'Ayumi'], clues: ['สมาชิกกลุ่มนักสืบเยาวชน', 'นิสัยสดใสและกล้าหาญ', 'ชื่นชมโคนันมาก', 'มักช่วยเพื่อน ๆ ในคดีเล็กใหญ่', 'เป็นเด็กประถมที่มีน้ำใจ'] },
  { id: 'tsuburaya-mitsuhiko', name: 'ซึบุรายะ มิซึฮิโกะ', aliases: ['มิซึฮิโกะ', 'Mitsuhiko'], clues: ['สมาชิกกลุ่มนักสืบเยาวชน', 'ชอบความรู้และวิทยาศาสตร์', 'พูดสุภาพกว่าวัย', 'มักวิเคราะห์ข้อมูลอย่างตั้งใจ', 'มีความรู้สึกดีต่อเพื่อนผู้หญิงในกลุ่ม'] },
  { id: 'kojima-genta', name: 'โคจิมะ เก็นตะ', aliases: ['เก็นตะ', 'Genta'], clues: ['สมาชิกกลุ่มนักสืบเยาวชน', 'ตัวใหญ่และพลังเยอะ', 'ชอบกินข้าวหน้าปลาไหล', 'มักพูดตรงและใจร้อน', 'เป็นเพื่อนร่วมทีมที่รักพวกพ้อง'] },
  { id: 'suzuki-sonoko', name: 'ซึซึกิ โซโนโกะ', aliases: ['โซโนโกะ', 'Sonoko'], clues: ['เพื่อนสนิทของโมริ รัน', 'มาจากตระกูลซึซึกิที่ร่ำรวย', 'นิสัยร่าเริงและชอบความรัก', 'มักเกี่ยวข้องกับงานหรูหรืออัญมณี', 'บางครั้งถูกใช้เป็นนักสืบหลับจำเป็น'] },
  { id: 'kyogoku-makoto', name: 'เคียวโกคุ มาโคโตะ', aliases: ['มาโคโตะ', 'Kyogoku'], clues: ['นักคาราเต้ฝีมือสูงมาก', 'มีบุคลิกสุภาพและจริงจัง', 'เป็นคนสำคัญของซึซึกิ โซโนโกะ', 'มักแข็งแกร่งจนเกินคนทั่วไป', 'มีฉายาเกี่ยวกับความไร้พ่าย'] },
  { id: 'kisaki-eri', name: 'คิซากิ เอริ', aliases: ['เอริ', 'Eri'], clues: ['ทนายความฝีมือดี', 'เป็นแม่ของโมริ รัน', 'แยกกันอยู่กับโคโกโร่', 'ฉลาดและมีเหตุผล', 'มักเข้มงวดแต่รักครอบครัว'] },
  { id: 'kudo-yusaku', name: 'คุโด้ ยูซากุ', aliases: ['ยูซากุ', 'Yusaku'], clues: ['นักเขียนนิยายสืบสวนชื่อดัง', 'เป็นพ่อของคุโด้ ชินอิจิ', 'มีความสามารถอนุมานสูงมาก', 'สุขุมและมองเกมขาด', 'มักช่วยจากเบื้องหลัง'] },
  { id: 'kudo-yukiko', name: 'คุโด้ ยูกิโกะ', aliases: ['ยูกิโกะ', 'Yukiko'], clues: ['อดีตนักแสดงชื่อดัง', 'เป็นแม่ของคุด้อ ชินอิจิ', 'เชี่ยวชาญการแสดงและปลอมตัว', 'นิสัยร่าเริงและชอบแกล้งลูก', 'มีความสัมพันธ์กับคนในวงการบันเทิง'] },
  { id: 'akai-mary', name: 'อากาอิ แมรี่', aliases: ['แมรี่', 'Mary'], clues: ['หญิงผู้มีบุคลิกเข้มงวดและระวังตัว', 'เกี่ยวข้องกับครอบครัวอากาอิ', 'มีทักษะด้านข่าวกรองและการต่อสู้', 'มีรูปลักษณ์ที่ทำให้หลายคนตั้งคำถาม', 'มักประเมินสถานการณ์อย่างเยือกเย็น'] },
  { id: 'sera-masumi', name: 'เซระ มาสึมิ', aliases: ['เซระ', 'Masumi'], clues: ['นักสืบหญิงมัธยมปลาย', 'มีทักษะเจี๋ยฉวนเต้า', 'นิสัยร่าเริงและชอบท้าทาย', 'เกี่ยวข้องกับครอบครัวอากาอิ', 'สนใจตัวตนของโคนันอย่างมาก'] },
  { id: 'haneda-shukichi', name: 'ฮาเนดะ ชูคิจิ', aliases: ['ชูคิจิ', 'Shukichi'], clues: ['ยอดฝีมือในวงการโชงิ', 'ดูสบาย ๆ แต่มีสมองเฉียบคม', 'เกี่ยวข้องกับครอบครัวอากาอิ', 'มีความสัมพันธ์กับตำรวจหญิงคนหนึ่ง', 'มักถูกเรียกด้วยภาพลักษณ์อัจฉริยะ'] },
  { id: 'miyano-akemi', name: 'มิยาโนะ อาเคมิ', aliases: ['อาเคมิ', 'Akemi'], clues: ['หญิงสาวที่เกี่ยวข้องกับองค์กรชุดดำ', 'เป็นพี่สาวของคนสำคัญคนหนึ่ง', 'มีนิสัยอ่อนโยน', 'เกี่ยวข้องกับคดีเงินจำนวนมาก', 'ความสัมพันธ์ของเธอส่งผลต่อหลายตัวละคร'] },
  { id: 'miyano-atsushi', name: 'มิยาโนะ อัตสึชิ', aliases: ['อัตสึชิ', 'Atsushi'], clues: ['นักวิทยาศาสตร์ที่เกี่ยวข้องกับงานวิจัยสำคัญ', 'เป็นพ่อในครอบครัวมิยาโนะ', 'เกี่ยวข้องกับองค์กรลึกลับ', 'มักถูกกล่าวถึงผ่านอดีต', 'มีผลต่อชะตาของลูกสาวทั้งสอง'] },
  { id: 'miyano-elena', name: 'มิยาโนะ เอเลน่า', aliases: ['เอเลน่า', 'Elena'], clues: ['นักวิทยาศาสตร์หญิงผู้มีฉายาในองค์กร', 'เป็นแม่ของครอบครัวมิยาโนะ', 'มีน้ำเสียงและความทรงจำสำคัญต่อไฮบาระ', 'เกี่ยวข้องกับงานวิจัยยา', 'เป็นตัวละครที่ส่งอิทธิพลจากอดีต'] },
  { id: 'jodie-starling', name: 'โจดี้ สตาร์ลิ่ง', aliases: ['โจดี้', 'Jodie'], clues: ['หญิงต่างชาติที่เคยเป็นครูสอนภาษาอังกฤษ', 'เกี่ยวข้องกับ FBI', 'มีอดีตกับองค์กรชุดดำ', 'นิสัยมั่นใจและพูดญี่ปุ่นปนอังกฤษ', 'ทำงานร่วมกับอากาอิในหลายเหตุการณ์'] },
  { id: 'james-black', name: 'เจมส์ แบล็ก', aliases: ['เจมส์', 'James Black'], clues: ['เจ้าหน้าที่อาวุโสของ FBI', 'มีท่าทีสุขุมและเป็นผู้นำ', 'ทำงานร่วมกับโจดี้และอากาอิ', 'มักวางแผนปฏิบัติการสำคัญ', 'เป็นผู้ใหญ่ที่ทีมให้ความเคารพ'] },
  { id: 'camel-andre', name: 'อังเดร คาเมล', aliases: ['คาเมล', 'Andre Camel'], clues: ['เจ้าหน้าที่ FBI รูปร่างใหญ่', 'มีทักษะขับรถดี', 'ภายนอกดูน่ากลัวแต่จริงใจ', 'เกี่ยวข้องกับปฏิบัติการของอากาอิ', 'เคยมีความผิดพลาดที่ส่งผลต่ออดีต'] },
  { id: 'yamamura-misao', name: 'ยามามูระ มิซาโอะ', aliases: ['ยามามูระ', 'Misao'], clues: ['ตำรวจจากจังหวัดกุนมะ', 'มักมีท่าทีตื่นเต้นเกินเหตุ', 'ชื่นชมโคโกโร่มาก', 'บางครั้งสรุปคดีเร็วไป', 'สร้างสีสันในสถานที่เกิดเหตุ'] },
  { id: 'yamato-kansuke', name: 'ยามาโตะ คันสุเกะ', aliases: ['คันสุเกะ', 'Yamato'], clues: ['ตำรวจจังหวัดนางาโนะที่มีบุคลิกเข้ม', 'มีรอยแผลและไม้เท้าเป็นเอกลักษณ์', 'สังเกตการณ์เฉียบคม', 'ทำงานเกี่ยวข้องกับอุเอฮาระ ยูอิ', 'มีความมุ่งมั่นสูงในคดี'] },
  { id: 'uehara-yui', name: 'อุเอฮาระ ยูอิ', aliases: ['ยูอิ', 'Yui'], clues: ['ตำรวจหญิงจากนางาโนะ', 'เกี่ยวข้องกับยามาโตะ คันสุเกะ', 'ใจเย็นและรับมือสถานการณ์ได้ดี', 'มีอดีตที่เกี่ยวกับครอบครัวและงานตำรวจ', 'มักอยู่ในคดีที่บรรยากาศจริงจัง'] },
  { id: 'morofushi-takaaki', name: 'โมโรฟุชิ ทาคาอากิ', aliases: ['ทาคาอากิ', 'Komei'], clues: ['ตำรวจนางาโนะผู้สุขุม', 'มีฉายาที่โยงกับนักยุทธศาสตร์', 'ชอบใช้ถ้อยคำลึกซึ้ง', 'วิเคราะห์คดีอย่างรอบคอบ', 'เกี่ยวข้องกับตระกูลโมโรฟุชิ'] },
  { id: 'matsuda-jinpei', name: 'มัตสึดะ จินเปย์', aliases: ['มัตสึดะ', 'Jinpei'], clues: ['อดีตตำรวจหน่วยเก็บกู้ระเบิด', 'มีบุคลิกห้าวและมั่นใจ', 'มีความเชี่ยวชาญด้านระเบิด', 'เกี่ยวข้องกับความทรงจำของซาโต้', 'เป็นเพื่อนร่วมรุ่นของตำรวจคนสำคัญหลายคน'] },
  { id: 'date-wataru', name: 'ดาเตะ วาตารุ', aliases: ['ดาเตะ', 'Date'], clues: ['ตำรวจที่มีความเป็นผู้นำสูง', 'เป็นรุ่นพี่ที่หลายคนเคารพ', 'เกี่ยวข้องกับทาคางิผ่านของสำคัญบางอย่าง', 'มีบุคลิกเข้มแข็งและจริงใจ', 'เป็นหนึ่งในความทรงจำของกลุ่มตำรวจรุ่นหนึ่ง'] },
  { id: 'morofushi-hiromitsu', name: 'โมโรฟุชิ ฮิโรมิตสึ', aliases: ['ฮิโรมิตสึ', 'สกอตช์', 'Scotch'], clues: ['เกี่ยวข้องกับตำรวจและงานแฝงตัว', 'มีชื่อรหัสที่โยงกับเครื่องดื่ม', 'เป็นคนสำคัญของฟุรุยะ เรย์', 'มีบุคลิกอ่อนโยนแต่เด็ดเดี่ยว', 'เกี่ยวข้องกับอดีตของหลายตัวละคร'] },
  { id: 'chianti', name: 'เคียนติ', aliases: ['Chianti'], clues: ['สมาชิกองค์กรชุดดำฝ่ายซุ่มยิง', 'มีบุคลิกรุนแรงและใจร้อน', 'มักทำงานร่วมกับคอร์น', 'แต่งหน้าและสไตล์โดดเด่น', 'ไม่ค่อยพอใจบางสมาชิกในองค์กร'] },
  { id: 'korn', name: 'คอร์น', aliases: ['Korn'], clues: ['มือซุ่มยิงขององค์กรชุดดำ', 'พูดน้อยและนิ่ง', 'มักทำงานคู่กับเคียนติ', 'มีทักษะยิงระยะไกล', 'ปรากฏในภารกิจลอบสังหาร'] },
  { id: 'rum', name: 'รัม', aliases: ['Rum'], clues: ['บุคคลระดับสูงในองค์กรชุดดำ', 'ตัวตนถูกปกคลุมด้วยข่าวลือหลายแบบ', 'เกี่ยวข้องกับคำสั่งสำคัญขององค์กร', 'มีอิทธิพลเหนือสมาชิกจำนวนมาก', 'เป็นปริศนาใหญ่ของฝั่งองค์กร'] },
  { id: 'okita-soshi', name: 'โอคิตะ โซชิ', aliases: ['โอคิตะ', 'Okita'], clues: ['นักเคนโด้ฝีมือดีจากเกียวโต', 'หน้าตาคล้ายคนสำคัญบางคน', 'มีบุคลิกมั่นใจและสบาย ๆ', 'เกี่ยวข้องกับการแข่งขันเคนโด้', 'ทำให้รันสับสนในบางสถานการณ์'] }
];

export function getCharacterById(id) {
  return characters.find((character) => character.id === id) ?? null;
}
```

- [ ] **Step 3: Write failing shared rule tests**

Write `shared/gameRules.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { characters } from './characters.js';
import {
  MATCH_ROUNDS,
  MAX_PLAYERS,
  ROUND_SECONDS,
  REVEAL_SECONDS,
  isCorrectAnswer,
  normalizeText,
  searchCharacters,
  scoreAttempt
} from './gameRules.js';

describe('shared game rules', () => {
  it('defines the approved match constants', () => {
    expect(MATCH_ROUNDS).toBe(10);
    expect(MAX_PLAYERS).toBe(8);
    expect(ROUND_SECONDS).toBe(20);
    expect(REVEAL_SECONDS).toBe(5);
  });

  it('ships exactly 50 characters with five clues each', () => {
    expect(characters).toHaveLength(50);
    expect(characters.every((character) => character.clues.length === 5)).toBe(true);
  });

  it('normalizes search text', () => {
    expect(normalizeText('  Conan  ')).toBe('conan');
  });

  it('searches by Thai name and alias', () => {
    expect(searchCharacters('โคนัน').map((character) => character.id)).toContain('edogawa-conan');
    expect(searchCharacters('bourbon').map((character) => character.id)).toContain('amuro-toru');
  });

  it('checks correct answers by character id', () => {
    expect(isCorrectAnswer('edogawa-conan', 'edogawa-conan')).toBe(true);
    expect(isCorrectAnswer('mouri-ran', 'edogawa-conan')).toBe(false);
  });

  it('scores only the first correct answer', () => {
    expect(scoreAttempt({ isCorrect: true, roundHasWinner: false, isLate: false })).toEqual({ points: 1, winsRound: true });
    expect(scoreAttempt({ isCorrect: false, roundHasWinner: false, isLate: false })).toEqual({ points: 0, winsRound: false });
    expect(scoreAttempt({ isCorrect: true, roundHasWinner: true, isLate: false })).toEqual({ points: 0, winsRound: false });
    expect(scoreAttempt({ isCorrect: true, roundHasWinner: false, isLate: true })).toEqual({ points: 0, winsRound: false });
  });
});
```

- [ ] **Step 4: Run shared tests to verify they fail**

Run:

```bash
npm test --workspace shared
```

Expected: FAIL because `shared/gameRules.js` does not exist.

- [ ] **Step 5: Implement shared rules**

Write `shared/gameRules.js`:

```js
import { characters } from './characters.js';

export const MATCH_ROUNDS = 10;
export const ROUND_SECONDS = 20;
export const REVEAL_SECONDS = 5;
export const MAX_PLAYERS = 8;

export function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function searchCharacters(query, roster = characters) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return roster;

  return roster.filter((character) => {
    const terms = [character.name, ...character.aliases].map(normalizeText);
    return terms.some((term) => term.includes(normalizedQuery));
  });
}

export function isCorrectAnswer(answerId, correctCharacterId) {
  return answerId === correctCharacterId;
}

export function scoreAttempt({ isCorrect, roundHasWinner, isLate }) {
  if (!isCorrect || roundHasWinner || isLate) {
    return { points: 0, winsRound: false };
  }

  return { points: 1, winsRound: true };
}

export function createRoundDeck(count = MATCH_ROUNDS, roster = characters, random = Math.random) {
  const pool = [...roster];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, count).map((character) => character.id);
}
```

- [ ] **Step 6: Run shared tests to verify they pass**

Run:

```bash
npm test --workspace shared
```

Expected: PASS for all shared rule tests.

- [ ] **Step 7: Install workspace dependencies**

Run:

```bash
npm install
```

Expected: npm creates `package-lock.json` without errors.

- [ ] **Step 8: Commit shared rules**

Run:

```bash
git add shared/package.json shared/characters.js shared/gameRules.js shared/gameRules.test.js package-lock.json
git commit -m "feat: add shared conan quiz data"
```

Expected: commit succeeds.

---

### Task 3: Backend Room Store

**Files:**
- Create: `server/package.json`
- Create: `server/src/roomStore.js`
- Create: `server/src/roomStore.test.js`

- [ ] **Step 1: Create backend package metadata**

Write `server/package.json`:

```json
{
  "name": "@conan-online/server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@conan-online/shared": "1.0.0",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Write failing room store tests**

Write `server/src/roomStore.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { createRoomStore } from './roomStore.js';

describe('room store', () => {
  it('creates a room with a host and room code', () => {
    const store = createRoomStore({ now: () => 1000, random: () => 0.1 });
    const result = store.createRoom({ nickname: 'รัน', sessionId: 's1', socketId: 'socket-1' });

    expect(result.room.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(result.player.isHost).toBe(true);
    expect(result.room.players).toHaveLength(1);
  });

  it('joins a room and suffixes duplicate nicknames', () => {
    const store = createRoomStore({ now: () => 1000, random: () => 0.1 });
    const created = store.createRoom({ nickname: 'โคนัน', sessionId: 's1', socketId: 'socket-1' });
    const joined = store.joinRoom({ roomCode: created.room.code, nickname: 'โคนัน', sessionId: 's2', socketId: 'socket-2' });

    expect(joined.player.nickname).toBe('โคนัน 2');
    expect(joined.room.players).toHaveLength(2);
  });

  it('rejects room start from non-host', () => {
    const store = createRoomStore({ now: () => 1000, random: () => 0.1 });
    const created = store.createRoom({ nickname: 'host', sessionId: 's1', socketId: 'socket-1' });
    const joined = store.joinRoom({ roomCode: created.room.code, nickname: 'guest', sessionId: 's2', socketId: 'socket-2' });

    expect(() => store.startMatch({ roomCode: created.room.code, playerId: joined.player.id })).toThrow('Only the host can start the match.');
  });

  it('starts a 10-round match', () => {
    const store = createRoomStore({ now: () => 1000, random: () => 0.1 });
    const created = store.createRoom({ nickname: 'host', sessionId: 's1', socketId: 'socket-1' });
    const started = store.startMatch({ roomCode: created.room.code, playerId: created.player.id });

    expect(started.room.status).toBe('playing');
    expect(started.round.roundNumber).toBe(1);
    expect(started.room.deck).toHaveLength(10);
  });

  it('allows wrong answers and ends on first correct answer', () => {
    let currentTime = 1000;
    const store = createRoomStore({ now: () => currentTime, random: () => 0.1 });
    const created = store.createRoom({ nickname: 'host', sessionId: 's1', socketId: 'socket-1' });
    const joined = store.joinRoom({ roomCode: created.room.code, nickname: 'guest', sessionId: 's2', socketId: 'socket-2' });
    const started = store.startMatch({ roomCode: created.room.code, playerId: created.player.id });
    const correctId = started.room.deck[0];

    const wrong = store.submitAnswer({ roomCode: created.room.code, playerId: created.player.id, answerId: 'wrong-id' });
    expect(wrong.result.correct).toBe(false);
    expect(wrong.room.status).toBe('playing');

    currentTime = 2000;
    const correct = store.submitAnswer({ roomCode: created.room.code, playerId: joined.player.id, answerId: correctId });
    expect(correct.result.correct).toBe(true);
    expect(correct.result.winsRound).toBe(true);
    expect(correct.room.status).toBe('revealing');
    expect(correct.room.players.find((player) => player.id === joined.player.id).score).toBe(1);
  });

  it('ignores answers after a winner exists', () => {
    const store = createRoomStore({ now: () => 1000, random: () => 0.1 });
    const created = store.createRoom({ nickname: 'host', sessionId: 's1', socketId: 'socket-1' });
    const joined = store.joinRoom({ roomCode: created.room.code, nickname: 'guest', sessionId: 's2', socketId: 'socket-2' });
    const started = store.startMatch({ roomCode: created.room.code, playerId: created.player.id });
    const correctId = started.room.deck[0];

    store.submitAnswer({ roomCode: created.room.code, playerId: created.player.id, answerId: correctId });
    expect(() => store.submitAnswer({ roomCode: created.room.code, playerId: joined.player.id, answerId: correctId })).toThrow('Round is not accepting answers.');
  });

  it('moves to final after round 10 reveal advances', () => {
    const store = createRoomStore({ now: () => 1000, random: () => 0.1 });
    const created = store.createRoom({ nickname: 'host', sessionId: 's1', socketId: 'socket-1' });
    store.startMatch({ roomCode: created.room.code, playerId: created.player.id });

    for (let index = 0; index < 10; index += 1) {
      const room = store.getRoom(created.room.code);
      store.submitAnswer({ roomCode: created.room.code, playerId: created.player.id, answerId: room.deck[room.currentRoundIndex] });
      store.advanceAfterReveal(created.room.code);
    }

    expect(store.getRoom(created.room.code).status).toBe('finished');
  });
});
```

- [ ] **Step 3: Run backend tests to verify they fail**

Run:

```bash
npm test --workspace server
```

Expected: FAIL because `server/src/roomStore.js` does not exist.

- [ ] **Step 4: Implement room store**

Write `server/src/roomStore.js`:

```js
import { characters, getCharacterById } from '@conan-online/shared/characters.js';
import { MATCH_ROUNDS, MAX_PLAYERS, ROUND_SECONDS, createRoundDeck, isCorrectAnswer, scoreAttempt } from '@conan-online/shared/gameRules.js';

function createRoomCode(random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
}

function createId(prefix, random) {
  return `${prefix}-${Math.floor(random() * 1_000_000_000).toString(36)}`;
}

function publicPlayer(player) {
  return {
    id: player.id,
    nickname: player.nickname,
    score: player.score,
    connected: player.connected,
    isHost: player.isHost
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    players: room.players.map(publicPlayer),
    currentRoundIndex: room.currentRoundIndex,
    roundDeadline: room.roundDeadline,
    revealDeadline: room.revealDeadline,
    winner: room.winner,
    lastAnswerByPlayer: room.lastAnswerByPlayer
  };
}

function currentRound(room) {
  if (room.currentRoundIndex < 0 || room.currentRoundIndex >= room.deck.length) return null;
  const character = getCharacterById(room.deck[room.currentRoundIndex]);
  return {
    roundNumber: room.currentRoundIndex + 1,
    totalRounds: MATCH_ROUNDS,
    characterId: character.id,
    clues: character.clues,
    deadline: room.roundDeadline,
    roster: characters.map(({ id, name, aliases }) => ({ id, name, aliases }))
  };
}

function makeUniqueNickname(players, nickname) {
  const base = String(nickname || 'Player').trim() || 'Player';
  const existing = new Set(players.map((player) => player.nickname));
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

export function createRoomStore({ now = Date.now, random = Math.random } = {}) {
  const rooms = new Map();
  const sessions = new Map();

  function getRoomOrThrow(roomCode) {
    const room = rooms.get(String(roomCode || '').toUpperCase());
    if (!room) throw new Error('Room not found.');
    return room;
  }

  function createRoom({ nickname, sessionId, socketId }) {
    let code = createRoomCode(random);
    while (rooms.has(code)) code = createRoomCode(random);

    const player = {
      id: createId('player', random),
      sessionId,
      socketId,
      nickname: makeUniqueNickname([], nickname),
      score: 0,
      connected: true,
      isHost: true
    };

    const room = {
      code,
      status: 'lobby',
      hostId: player.id,
      players: [player],
      deck: [],
      currentRoundIndex: -1,
      roundStartedAt: null,
      roundDeadline: null,
      revealDeadline: null,
      attempts: [],
      winner: null,
      lastAnswerByPlayer: {}
    };

    rooms.set(code, room);
    sessions.set(sessionId, { roomCode: code, playerId: player.id });
    return { room: publicRoom(room), player: publicPlayer(player) };
  }

  function joinRoom({ roomCode, nickname, sessionId, socketId }) {
    const room = getRoomOrThrow(roomCode);
    if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full.');
    if (room.status !== 'lobby') throw new Error('Match already started.');

    const player = {
      id: createId('player', random),
      sessionId,
      socketId,
      nickname: makeUniqueNickname(room.players, nickname),
      score: 0,
      connected: true,
      isHost: false
    };

    room.players.push(player);
    sessions.set(sessionId, { roomCode: room.code, playerId: player.id });
    return { room: publicRoom(room), player: publicPlayer(player) };
  }

  function reconnect({ sessionId, socketId }) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    const room = rooms.get(session.roomCode);
    if (!room) return null;
    const player = room.players.find((candidate) => candidate.id === session.playerId);
    if (!player) return null;

    player.socketId = socketId;
    player.connected = true;
    return { room: publicRoom(room), player: publicPlayer(player), round: currentRound(room) };
  }

  function startMatch({ roomCode, playerId }) {
    const room = getRoomOrThrow(roomCode);
    if (room.hostId !== playerId) throw new Error('Only the host can start the match.');
    if (room.status !== 'lobby' && room.status !== 'finished') throw new Error('Match cannot start now.');

    room.status = 'playing';
    room.players.forEach((player) => {
      player.score = 0;
    });
    room.deck = createRoundDeck(MATCH_ROUNDS, characters, random);
    room.currentRoundIndex = 0;
    room.roundStartedAt = now();
    room.roundDeadline = room.roundStartedAt + ROUND_SECONDS * 1000;
    room.revealDeadline = null;
    room.attempts = [];
    room.winner = null;
    room.lastAnswerByPlayer = {};

    return { room: publicRoom(room), round: currentRound(room) };
  }

  function submitAnswer({ roomCode, playerId, answerId }) {
    const room = getRoomOrThrow(roomCode);
    if (room.status !== 'playing') throw new Error('Round is not accepting answers.');

    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new Error('Player not found.');

    const submittedAt = now();
    const isLate = submittedAt > room.roundDeadline;
    const correctCharacterId = room.deck[room.currentRoundIndex];
    const correct = isCorrectAnswer(answerId, correctCharacterId);
    const score = scoreAttempt({ isCorrect: correct, roundHasWinner: Boolean(room.winner), isLate });

    const attempt = { playerId, answerId, correct, submittedAt };
    room.attempts.push(attempt);
    room.lastAnswerByPlayer[playerId] = { answerId, correct };

    if (score.winsRound) {
      player.score += score.points;
      room.winner = { playerId, nickname: player.nickname, characterId: correctCharacterId, points: score.points };
      room.status = 'revealing';
      room.revealDeadline = submittedAt + 5000;
    }

    return { room: publicRoom(room), result: { correct, winsRound: score.winsRound, points: score.points } };
  }

  function expireRound(roomCode) {
    const room = getRoomOrThrow(roomCode);
    if (room.status !== 'playing') return { room: publicRoom(room) };

    room.status = 'revealing';
    room.winner = null;
    room.revealDeadline = now() + 5000;
    return { room: publicRoom(room) };
  }

  function advanceAfterReveal(roomCode) {
    const room = getRoomOrThrow(roomCode);
    if (room.status !== 'revealing') return { room: publicRoom(room), round: currentRound(room) };

    if (room.currentRoundIndex >= MATCH_ROUNDS - 1) {
      room.status = 'finished';
      return { room: publicRoom(room), round: null };
    }

    room.currentRoundIndex += 1;
    room.status = 'playing';
    room.roundStartedAt = now();
    room.roundDeadline = room.roundStartedAt + ROUND_SECONDS * 1000;
    room.revealDeadline = null;
    room.attempts = [];
    room.winner = null;
    room.lastAnswerByPlayer = {};
    return { room: publicRoom(room), round: currentRound(room) };
  }

  function disconnect(socketId) {
    for (const room of rooms.values()) {
      const player = room.players.find((candidate) => candidate.socketId === socketId);
      if (!player) continue;

      player.connected = false;
      if (room.hostId === player.id) {
        const nextHost = room.players.find((candidate) => candidate.connected && candidate.id !== player.id);
        if (nextHost) {
          player.isHost = false;
          nextHost.isHost = true;
          room.hostId = nextHost.id;
        }
      }

      return publicRoom(room);
    }
    return null;
  }

  return {
    createRoom,
    joinRoom,
    reconnect,
    startMatch,
    submitAnswer,
    expireRound,
    advanceAfterReveal,
    disconnect,
    getRoom: (roomCode) => publicRoom(getRoomOrThrow(roomCode))
  };
}
```

- [ ] **Step 5: Run backend room store tests**

Run:

```bash
npm test --workspace server
```

Expected: PASS for all room store tests.

- [ ] **Step 6: Commit backend room store**

Run:

```bash
git add server/package.json server/src/roomStore.js server/src/roomStore.test.js package-lock.json
git commit -m "feat: add realtime room store"
```

Expected: commit succeeds.

---

### Task 4: Socket.IO Backend Server

**Files:**
- Create: `server/src/index.js`
- Create: `server/.env.example`

- [ ] **Step 1: Implement backend server**

Write `server/src/index.js`:

```js
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { createRoomStore } from './roomStore.js';

const port = Number(process.env.PORT || 4000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST']
  }
});
const store = createRoomStore();
const roundTimers = new Map();
const revealTimers = new Map();

app.use(cors({ origin: clientOrigin }));
app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'conan-online-server' });
});

function emitError(socket, message) {
  socket.emit('app:error', { message });
}

function emitRoom(roomCode, event, payload) {
  io.to(roomCode).emit(event, payload);
}

function clearRoomTimers(roomCode) {
  clearTimeout(roundTimers.get(roomCode));
  clearTimeout(revealTimers.get(roomCode));
  roundTimers.delete(roomCode);
  revealTimers.delete(roomCode);
}

function scheduleRound(roomCode, deadline) {
  clearTimeout(roundTimers.get(roomCode));
  const delay = Math.max(0, deadline - Date.now());
  const timer = setTimeout(() => {
    try {
      const { room } = store.expireRound(roomCode);
      emitRoom(roomCode, 'match:reveal', { room });
      scheduleReveal(roomCode, room.revealDeadline);
    } catch (error) {
      emitRoom(roomCode, 'app:error', { message: error.message });
    }
  }, delay);
  roundTimers.set(roomCode, timer);
}

function scheduleReveal(roomCode, deadline) {
  clearTimeout(revealTimers.get(roomCode));
  const delay = Math.max(0, deadline - Date.now());
  const timer = setTimeout(() => {
    try {
      const { room, round } = store.advanceAfterReveal(roomCode);
      if (room.status === 'finished') {
        clearRoomTimers(roomCode);
        emitRoom(roomCode, 'match:final', { room });
        return;
      }
      emitRoom(roomCode, 'match:round', { room, round });
      scheduleRound(roomCode, round.deadline);
    } catch (error) {
      emitRoom(roomCode, 'app:error', { message: error.message });
    }
  }, delay);
  revealTimers.set(roomCode, timer);
}

io.on('connection', (socket) => {
  socket.on('session:resume', ({ sessionId } = {}) => {
    try {
      if (!sessionId) return;
      const resumed = store.reconnect({ sessionId, socketId: socket.id });
      if (!resumed) return;
      socket.join(resumed.room.code);
      socket.emit('session:resumed', resumed);
      emitRoom(resumed.room.code, 'room:update', { room: resumed.room });
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:create', ({ nickname, sessionId } = {}) => {
    try {
      const result = store.createRoom({ nickname, sessionId, socketId: socket.id });
      socket.join(result.room.code);
      socket.emit('room:created', result);
      emitRoom(result.room.code, 'room:update', { room: result.room });
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:join', ({ roomCode, nickname, sessionId } = {}) => {
    try {
      const result = store.joinRoom({ roomCode, nickname, sessionId, socketId: socket.id });
      socket.join(result.room.code);
      socket.emit('room:joined', result);
      emitRoom(result.room.code, 'room:update', { room: result.room });
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('room:start', ({ roomCode, playerId } = {}) => {
    try {
      const result = store.startMatch({ roomCode, playerId });
      emitRoom(result.room.code, 'match:round', result);
      scheduleRound(result.room.code, result.round.deadline);
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('answer:submit', ({ roomCode, playerId, answerId } = {}) => {
    try {
      const result = store.submitAnswer({ roomCode, playerId, answerId });
      socket.emit('answer:result', result.result);
      emitRoom(result.room.code, 'room:update', { room: result.room });
      if (result.result.winsRound) {
        clearTimeout(roundTimers.get(result.room.code));
        emitRoom(result.room.code, 'match:reveal', { room: result.room });
        scheduleReveal(result.room.code, result.room.revealDeadline);
      }
    } catch (error) {
      emitError(socket, error.message);
    }
  });

  socket.on('disconnect', () => {
    const room = store.disconnect(socket.id);
    if (room) emitRoom(room.code, 'room:update', { room });
  });
});

server.listen(port, () => {
  console.log(`Conan Online server listening on ${port}`);
});
```

- [ ] **Step 2: Add backend environment example**

Write `server/.env.example`:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

- [ ] **Step 3: Run backend tests**

Run:

```bash
npm test --workspace server
```

Expected: PASS.

- [ ] **Step 4: Start backend locally**

Run:

```bash
npm run dev --workspace server
```

Expected: server logs `Conan Online server listening on 4000`. Visit `http://localhost:4000/health` and expect JSON with `"ok": true`.

- [ ] **Step 5: Commit backend server**

Run:

```bash
git add server/src/index.js server/.env.example
git commit -m "feat: add socket server"
```

Expected: commit succeeds.

---

### Task 5: React Client Skeleton and Socket State

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/src/main.jsx`
- Create: `client/src/socket.js`
- Create: `client/src/App.jsx`
- Create: `client/.env.example`

- [ ] **Step 1: Create frontend package metadata**

Write `client/package.json`:

```json
{
  "name": "@conan-online/client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@conan-online/shared": "1.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.5"
  }
}
```

- [ ] **Step 2: Add Vite entry files**

Write `client/index.html`:

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Conan Online Quiz</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Write `client/src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './App.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Add socket factory**

Write `client/src/socket.js`:

```js
import { io } from 'socket.io-client';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export function createSocket() {
  return io(backendUrl, {
    autoConnect: true,
    transports: ['websocket', 'polling']
  });
}
```

- [ ] **Step 4: Add the React app state machine**

Write `client/src/App.jsx`:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { characters, getCharacterById } from '@conan-online/shared/characters.js';
import { searchCharacters } from '@conan-online/shared/gameRules.js';
import { createSocket } from './socket.js';

function ensureSessionId() {
  const existing = localStorage.getItem('conan-session-id');
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem('conan-session-id', created);
  return created;
}

function sortPlayers(players) {
  return [...players].sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, 'th'));
}

export default function App() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [nickname, setNickname] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [player, setPlayer] = useState(null);
  const [room, setRoom] = useState(null);
  const [round, setRound] = useState(null);
  const [answerQuery, setAnswerQuery] = useState('');
  const [lastAnswerResult, setLastAnswerResult] = useState(null);

  const sessionId = useMemo(() => ensureSessionId(), []);
  const roster = round?.roster ?? characters.map(({ id, name, aliases }) => ({ id, name, aliases }));
  const filteredRoster = useMemo(() => searchCharacters(answerQuery, roster), [answerQuery, roster]);
  const me = room?.players.find((candidate) => candidate.id === player?.id);
  const isHost = Boolean(me?.isHost);
  const correctCharacter = room?.winner?.characterId ? getCharacterById(room.winner.characterId) : null;

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setError('');
      socket.emit('session:resume', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('app:error', ({ message }) => setError(message));
    socket.on('session:resumed', ({ room: nextRoom, player: nextPlayer, round: nextRound }) => {
      setRoom(nextRoom);
      setPlayer(nextPlayer);
      setRound(nextRound);
    });
    socket.on('room:created', ({ room: nextRoom, player: nextPlayer }) => {
      setRoom(nextRoom);
      setPlayer(nextPlayer);
      setRound(null);
    });
    socket.on('room:joined', ({ room: nextRoom, player: nextPlayer }) => {
      setRoom(nextRoom);
      setPlayer(nextPlayer);
      setRound(null);
    });
    socket.on('room:update', ({ room: nextRoom }) => setRoom(nextRoom));
    socket.on('match:round', ({ room: nextRoom, round: nextRound }) => {
      setRoom(nextRoom);
      setRound(nextRound);
      setAnswerQuery('');
      setLastAnswerResult(null);
    });
    socket.on('answer:result', (result) => setLastAnswerResult(result));
    socket.on('match:reveal', ({ room: nextRoom }) => setRoom(nextRoom));
    socket.on('match:final', ({ room: nextRoom }) => {
      setRoom(nextRoom);
      setRound(null);
    });

    return () => socket.disconnect();
  }, [sessionId]);

  function createRoom() {
    setError('');
    socketRef.current.emit('room:create', { nickname, sessionId });
  }

  function joinRoom() {
    setError('');
    socketRef.current.emit('room:join', { nickname, roomCode: roomCodeInput, sessionId });
  }

  function startMatch() {
    socketRef.current.emit('room:start', { roomCode: room.code, playerId: player.id });
  }

  function submitAnswer(answerId) {
    socketRef.current.emit('answer:submit', { roomCode: room.code, playerId: player.id, answerId });
  }

  if (!room) {
    return (
      <main className="shell">
        <section className="hero-panel">
          <p className="eyebrow">Detective Board</p>
          <h1>Conan Online Quiz</h1>
          <p className="subtitle">แข่งทายตัวละครจากคำใบ้ 5 ข้อ ใครตอบถูกก่อนชนะรอบนั้น</p>
          <div className="connection">{connected ? 'เชื่อมต่อ server แล้ว' : 'กำลังเชื่อมต่อ server...'}</div>
          {error && <div className="error">{error}</div>}
          <label>
            ชื่อเล่น
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="เช่น โคนัน" />
          </label>
          <div className="actions">
            <button onClick={createRoom} disabled={!nickname || !connected}>สร้างห้อง</button>
          </div>
          <label>
            รหัสห้อง
            <input value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())} placeholder="ABCD" maxLength={4} />
          </label>
          <div className="actions">
            <button className="secondary" onClick={joinRoom} disabled={!nickname || !roomCodeInput || !connected}>เข้าห้อง</button>
          </div>
        </section>
      </main>
    );
  }

  if (room.status === 'lobby') {
    return (
      <main className="shell">
        <section className="case-header">
          <div>
            <p className="eyebrow">Room Code</p>
            <h1>{room.code}</h1>
          </div>
          <button onClick={() => navigator.clipboard.writeText(room.code)}>Copy</button>
        </section>
        {error && <div className="error">{error}</div>}
        <section className="board">
          <h2>ผู้เล่น {room.players.length}/8</h2>
          <div className="players">
            {room.players.map((candidate) => (
              <div className="player-row" key={candidate.id}>
                <span>{candidate.nickname}</span>
                <span>{candidate.isHost ? 'Host' : candidate.connected ? 'Ready' : 'Offline'}</span>
              </div>
            ))}
          </div>
          {isHost ? <button onClick={startMatch}>เริ่มเกม</button> : <p className="subtitle">รอ host เริ่มเกม</p>}
        </section>
      </main>
    );
  }

  if (room.status === 'finished') {
    return (
      <main className="shell">
        <section className="board">
          <p className="eyebrow">Final Result</p>
          <h1>จบเกม</h1>
          {sortPlayers(room.players).map((candidate, index) => (
            <div className="player-row" key={candidate.id}>
              <span>#{index + 1} {candidate.nickname}</span>
              <strong>{candidate.score}</strong>
            </div>
          ))}
          {isHost && <button onClick={startMatch}>เล่นอีกครั้ง</button>}
        </section>
      </main>
    );
  }

  return (
    <main className="game-layout">
      <section className="case-header">
        <div>
          <p className="eyebrow">Round {round?.roundNumber ?? room.currentRoundIndex + 1}/10</p>
          <h1>ใครคือคนในคดีนี้?</h1>
        </div>
        <div className="timer">{room.status === 'revealing' ? 'Reveal' : '00:20'}</div>
      </section>

      <section className="clue-board">
        {(round?.clues ?? []).map((clue, index) => (
          <div className="clue" key={clue}><span>{index + 1}</span>{clue}</div>
        ))}
      </section>

      <section className="answer-board">
        {room.status === 'revealing' ? (
          <div className="reveal">
            <p className="eyebrow">เฉลย</p>
            <h2>{correctCharacter?.name ?? 'ไม่มีผู้ชนะในรอบนี้'}</h2>
            <p>{room.winner ? `${room.winner.nickname} ได้ 1 คะแนน` : 'หมดเวลา ไม่มีใครตอบถูก'}</p>
          </div>
        ) : (
          <>
            {lastAnswerResult && !lastAnswerResult.correct && <div className="warning">ยังไม่ถูก ลองใหม่ได้</div>}
            <input value={answerQuery} onChange={(event) => setAnswerQuery(event.target.value)} placeholder="ค้นหาชื่อตัวละคร..." />
            <div className="roster">
              {filteredRoster.map((character) => (
                <button className="answer-option" key={character.id} onClick={() => submitAnswer(character.id)}>{character.name}</button>
              ))}
            </div>
          </>
        )}
      </section>

      <aside className="scoreboard">
        <h2>คะแนน</h2>
        {sortPlayers(room.players).map((candidate, index) => (
          <div className="player-row" key={candidate.id}>
            <span>#{index + 1} {candidate.nickname}</span>
            <strong>{candidate.score}</strong>
          </div>
        ))}
      </aside>
    </main>
  );
}
```

- [ ] **Step 5: Add frontend environment example**

Write `client/.env.example`:

```env
VITE_BACKEND_URL=http://localhost:4000
```

- [ ] **Step 6: Run frontend build to verify CSS is missing**

Run:

```bash
npm run build --workspace client
```

Expected: FAIL because `client/src/App.css` does not exist. This failure is intentional before Task 6.

- [ ] **Step 7: Commit client skeleton**

Run:

```bash
git add client/package.json client/index.html client/src/main.jsx client/src/socket.js client/src/App.jsx client/.env.example package-lock.json
git commit -m "feat: add react socket client"
```

Expected: commit succeeds.

---

### Task 6: Detective Board Styling

**Files:**
- Create: `client/src/App.css`

- [ ] **Step 1: Add responsive Detective Board CSS**

Write `client/src/App.css`:

```css
:root {
  color: #f8fafc;
  background: #09090b;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    linear-gradient(135deg, rgba(127, 29, 29, 0.28), transparent 34%),
    radial-gradient(circle at top right, rgba(250, 204, 21, 0.14), transparent 30%),
    #09090b;
}

button,
input {
  font: inherit;
}

button {
  border: 0;
  border-radius: 8px;
  background: #facc15;
  color: #111827;
  cursor: pointer;
  font-weight: 800;
  padding: 12px 16px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

button.secondary {
  background: #2563eb;
  color: white;
}

input {
  width: 100%;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  margin-top: 8px;
  padding: 12px 14px;
}

label {
  color: #cbd5e1;
  display: block;
  font-weight: 700;
  margin-top: 18px;
}

.shell,
.game-layout {
  margin: 0 auto;
  max-width: 1180px;
  min-height: 100vh;
  padding: 24px;
}

.shell {
  display: grid;
  place-items: center;
}

.hero-panel,
.board,
.clue-board,
.answer-board,
.scoreboard,
.case-header {
  background: rgba(15, 23, 42, 0.92);
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

.hero-panel {
  max-width: 520px;
  padding: 28px;
  width: 100%;
}

.eyebrow {
  color: #facc15;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0 0 12px;
}

.subtitle {
  color: #94a3b8;
  line-height: 1.6;
  margin: 0 0 18px;
}

.connection,
.error,
.warning {
  border-radius: 8px;
  margin: 14px 0;
  padding: 10px 12px;
}

.connection {
  background: rgba(34, 197, 94, 0.13);
  color: #bbf7d0;
}

.error,
.warning {
  background: rgba(239, 68, 68, 0.13);
  color: #fecaca;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.case-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
  padding: 18px;
}

.game-layout {
  display: grid;
  gap: 18px;
  grid-template-columns: 1.2fr 0.8fr;
  grid-template-areas:
    "header header"
    "clues scores"
    "answers scores";
}

.game-layout .case-header {
  grid-area: header;
}

.timer {
  align-items: center;
  background: #dc2626;
  border-radius: 8px;
  display: grid;
  font-size: 1.8rem;
  font-weight: 900;
  min-width: 110px;
  padding: 14px;
  place-items: center;
}

.clue-board {
  display: grid;
  gap: 10px;
  grid-area: clues;
  padding: 18px;
}

.clue {
  align-items: start;
  background: #1f2937;
  border-left: 4px solid #facc15;
  border-radius: 6px;
  color: #e5e7eb;
  display: grid;
  gap: 10px;
  grid-template-columns: auto 1fr;
  line-height: 1.55;
  padding: 12px;
}

.clue span {
  background: #facc15;
  border-radius: 999px;
  color: #111827;
  display: inline-grid;
  font-weight: 900;
  height: 26px;
  place-items: center;
  width: 26px;
}

.answer-board {
  grid-area: answers;
  padding: 18px;
}

.roster {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 14px;
  max-height: 360px;
  overflow: auto;
}

.answer-option {
  background: #111827;
  border: 1px solid #334155;
  color: #f8fafc;
  text-align: left;
}

.answer-option:hover {
  border-color: #facc15;
}

.scoreboard {
  align-self: start;
  grid-area: scores;
  padding: 18px;
  position: sticky;
  top: 18px;
}

.players,
.scoreboard {
  display: grid;
  gap: 10px;
}

.player-row {
  align-items: center;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
}

.reveal {
  background: rgba(250, 204, 21, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.4);
  border-radius: 8px;
  padding: 18px;
}

@media (max-width: 820px) {
  .shell,
  .game-layout {
    padding: 14px;
  }

  .game-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "scores"
      "clues"
      "answers";
  }

  .case-header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .timer {
    min-width: 0;
  }

  .scoreboard {
    position: static;
  }
}
```

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build --workspace client
```

Expected: PASS and Vite writes `client/dist`.

- [ ] **Step 3: Commit styling**

Run:

```bash
git add client/src/App.css
git commit -m "feat: style detective board interface"
```

Expected: commit succeeds.

---

### Task 7: Deployment Configuration and Documentation

**Files:**
- Create: `vercel.json`
- Create: `render.yaml`
- Create: `README.md`

- [ ] **Step 1: Add Vercel config**

Write `vercel.json`:

```json
{
  "buildCommand": "npm run build --workspace client",
  "outputDirectory": "client/dist",
  "installCommand": "npm install",
  "framework": "vite"
}
```

- [ ] **Step 2: Add Render config**

Write `render.yaml`:

```yaml
services:
  - type: web
    name: conan-online-server
    runtime: node
    plan: free
    buildCommand: npm install
    startCommand: npm start --workspace server
    envVars:
      - key: CLIENT_ORIGIN
        sync: false
```

- [ ] **Step 3: Add README**

Write `README.md`:

```md
# Conan Online Quiz

Thai-language realtime Detective Conan character quiz.

## Local Development

Install dependencies:

```bash
npm install
```

Start the backend:

```bash
npm run dev:server
```

Start the frontend in another terminal:

```bash
npm run dev:client
```

Open `http://localhost:5173`.

## Environment Variables

Server:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
```

Client:

```env
VITE_BACKEND_URL=http://localhost:4000
```

For production, set `CLIENT_ORIGIN` on Render to the Vercel URL and set `VITE_BACKEND_URL` on Vercel to the Render public URL.

## Game Rules

- 10 rounds per match.
- 20 seconds per round.
- 50 searchable character names.
- First correct answer wins the round and gets 1 point.
- Wrong answers do not stop other players from trying.
- Round ends immediately on the first correct answer or when time expires.
```

- [ ] **Step 4: Run full check**

Run:

```bash
npm run check
```

Expected: frontend build passes, shared tests pass, backend tests pass.

- [ ] **Step 5: Commit deployment docs**

Run:

```bash
git add vercel.json render.yaml README.md
git commit -m "docs: add deployment instructions"
```

Expected: commit succeeds.

---

### Task 8: Local Realtime Smoke Test

**Files:**
- Modify only if smoke testing reveals a defect in existing files.

- [ ] **Step 1: Start backend**

Run:

```bash
npm run dev:server
```

Expected: backend listens on `http://localhost:4000`.

- [ ] **Step 2: Start frontend**

Run in a second terminal:

```bash
npm run dev:client
```

Expected: Vite prints a local URL, usually `http://localhost:5173`.

- [ ] **Step 3: Browser smoke flow**

Open two browser tabs to `http://localhost:5173` and verify:

1. Tab A enters nickname `โคนัน` and creates a room.
2. Tab B enters nickname `รัน` and joins the room code from Tab A.
3. Tab A starts the match.
4. Tab A submits a wrong answer and sees `ยังไม่ถูก ลองใหม่ได้`.
5. Tab B submits the correct answer from the clue set.
6. Both tabs move to reveal.
7. Tab B has 1 point on the scoreboard.
8. After reveal, the next round appears.

Expected: all eight checks pass without console errors.

- [ ] **Step 4: Run full check after smoke**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit smoke fixes if needed**

If files changed during smoke fixes, run:

```bash
git add client server shared
git commit -m "fix: polish realtime smoke flow"
```

Expected: commit succeeds only if there were changes.

---

## Self-Review Notes

- Spec coverage: realtime rooms, 10 rounds, 20-second timer, 5 clues, 50-character roster, 8-player rooms, host start, nickname-only identity, race-to-answer scoring, reveal phase, Vercel/Render split, and offline/reconnect visibility are each covered by tasks above.
- Placeholder scan: no TBD/TODO/fill-in-later language remains in implementation steps.
- Type consistency: event names, room fields, player fields, and scoring properties are consistent across shared rules, room store, Socket.IO server, and React client.
