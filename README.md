# Mini Social — Final Project

เว็บไซต์ Social Media ตัวอย่างสำหรับส่งงาน: **Vue 3 + Express 5 + Drizzle ORM + Turso + Vercel**

## ฟังก์ชัน
- สมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ
- แสดงชื่อผู้ใช้ และแยกข้อมูลของแต่ละบัญชี
- ฟีดโพสต์จากทุกคน
- เขียน / แก้ไข / ลบโพสต์ของตัวเอง
- กด Like / ยกเลิก Like บันทึกลง Turso
- Responsive มือถือและคอมพิวเตอร์

## 1. สร้างฐานข้อมูล Turso
สร้าง Database ใหม่ใน Turso Dashboard และคัดลอก **Database URL** กับ **Auth Token** มาใส่ใน `backend/.env` (สร้างจาก `.env.example`).
**ไม่ต้องสร้างตารางเอง**: backend จะสร้าง `users`, `posts`, `likes` ใน Turso อัตโนมัติเมื่อเรียก API (ยกเว้น health endpoint)

## 2. รันบนเครื่อง
ต้องมี Node.js **20.19+ (แนะนำ 22.18+ หรือ 24+)** และ npm

เปิด Terminal 1:
```
cd backend
npm install
```
สร้างไฟล์ `.env` ใน backend ตาม `.env.example` แล้วตั้ง `JWT_SECRET` เป็นข้อความสุ่มยาว ๆ (16 ตัวขึ้นไป)
```
npm run dev
```
API test: `http://localhost:3000/api/health`

เปิด Terminal 2:
```
cd frontend
npm install
```
สร้างไฟล์ `.env` ใน frontend โดยใช้ `VITE_API_URL=http://localhost:3000`
```
npm run dev
```
เข้าเว็บ `http://localhost:5173`

## 3. Deploy บน Vercel (แยก 2 โปรเจกต์)
ใช้ GitHub repository เดียวที่มี `backend` และ `frontend` หรือแยก repository ก็ได้

### Backend
1. Import Git Repository ใน Vercel
2. **Root Directory = `backend`**
3. Framework Preset = Other (ไม่ต้องใส่ Output Directory)
4. ตั้ง Environment Variables (Production):
   - `TURSO_DATABASE_URL` = URL จาก Turso
   - `TURSO_AUTH_TOKEN` = token จาก Turso
   - `JWT_SECRET` = secret ยาว 16+ ตัวอักษร
   - `CORS_ORIGIN` = `https://ชื่อเว็บ-frontend.vercel.app`
5. Deploy แล้วทดสอบ `https://ชื่อ-backend.vercel.app/api/health` ต้องขึ้น `{"status":"ok"}`

### Frontend
1. Import **repository เดียวกัน** อีกครั้งใน Vercel
2. **Root Directory = `frontend`**
3. Framework Preset = Vite, Build Command = `npm run build`, Output Directory = `dist`
4. ตั้ง `VITE_API_URL` = `https://ชื่อ-backend.vercel.app` (**ไม่มี `/api` ปิดท้าย**)
5. Deploy แล้วเปิด Public URL ทดสอบสมัครสมาชิก/โพสต์/กดไลก์

**สำคัญ:** กลับไปตั้งค่า Backend `CORS_ORIGIN` ให้ตรงกับ URL หน้าเว็บจริง แล้ว Redeploy Backend ถ้า URL ที่ได้ต่างจากที่ตั้งไว้

> Backend และ Frontend ต้องอยู่คนละ Vercel Project ส่วน `VITE_API_URL` เปิดเผยให้ browser เห็นได้ตามปกติ แต่ **TURSO_AUTH_TOKEN** และ **JWT_SECRET** ห้ามใส่ใน frontend, GitHub, หรือส่งให้คนอื่น

## 4. ทดสอบก่อนส่ง
1. สมัคร `friend_a` และโพสต์หนึ่งข้อความ
2. กด Like แล้ว Refresh ต้องยังอยู่
3. Logout สมัคร `friend_b` ต้องเห็นโพสต์ของ `friend_a` แต่ **แก้หรือลบไม่ได้**
4. ให้ `friend_b` สร้างโพสต์และทดลองแก้ไข/ลบของตัวเอง
5. Refresh และเปิดเว็บบนมือถือเพื่อตรวจว่าข้อมูลไม่หาย

## 5. สิ่งที่ส่งอาจารย์
- Public URL Frontend
- Public URL Backend (เช่น `/api/health`)
- GitHub Repository URL
- Screenshot / วิดีโอแสดงการสมัครสมาชิก, โพสต์, Like และสิทธิ์แยกบัญชี

หมายเหตุ: โค้ดนี้เป็นเวอร์ชันงานเรียน ไม่ได้มีระบบ reset password, email verification, rate-limit หรือระบบ moderating แบบ production จริง
