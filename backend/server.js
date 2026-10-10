import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { eq, desc, sql } from 'drizzle-orm';

const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull()
});
const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull()
});
const likes = sqliteTable('likes', {
  userId: integer('user_id').notNull(),
  postId: integer('post_id').notNull()
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25kb' }));
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('Origin not allowed by CORS'));
} }));

let db;
let initPromise;
function database() {
  if (!initPromise) {
    initPromise = (async () => {
      if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw new Error('Missing Turso environment variables');
      const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
      await client.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)`);
      await client.execute(`CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), content TEXT NOT NULL, created_at TEXT NOT NULL)`);
      await client.execute(`CREATE TABLE IF NOT EXISTS likes (user_id INTEGER NOT NULL REFERENCES users(id), post_id INTEGER NOT NULL REFERENCES posts(id), PRIMARY KEY(user_id, post_id))`);
      db = drizzle(client);
      return db;
    })().catch(err => { initPromise = undefined; throw err; });
  }
  return initPromise;
}
function tokenFor(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) throw new Error('JWT_SECRET must have at least 16 characters');
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!Number.isSafeInteger(payload.id)) throw new Error('Invalid token');
    req.userId = payload.id;
    next();
  } catch { res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' }); }
}
app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api', async (req, res, next) => { try { req.db = await database(); next(); } catch (err) { next(err); } });

app.post('/api/register', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = req.body?.password;
    if (!/^[a-z0-9_]{3,20}$/.test(username) || typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: 'ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ จำนวน 3–20 ตัว และรหัสผ่าน 6–72 ตัว' });
    }
    const exists = await req.db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (exists.length) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีแล้ว' });
    const hash = await bcrypt.hash(password, 10);
    const result = await req.db.insert(users).values({ username, passwordHash: hash, createdAt: new Date().toISOString() }).returning({ id: users.id, username: users.username });
    res.status(201).json({ user: result[0], token: tokenFor(result[0]) });
  } catch (err) { if (/UNIQUE constraint/i.test(String(err))) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีแล้ว' }); next(err); }
});
app.post('/api/login', async (req, res, next) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = req.body?.password;
    if (typeof password !== 'string') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
    const found = await req.db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!found[0] || !(await bcrypt.compare(password, found[0].passwordHash))) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    const user = { id: found[0].id, username: found[0].username };
    res.json({ user, token: tokenFor(user) });
  } catch (err) { next(err); }
});
app.get('/api/me', auth, async (req, res, next) => {
  try {
    const record = await req.db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, req.userId)).limit(1);
    if (!record.length) return res.status(401).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ user: record[0] });
  } catch (err) { next(err); }
});
app.get('/api/posts', async (req, res, next) => {
  try {
    const id = req.headers.authorization ? (() => { try { return jwt.verify(req.headers.authorization.replace(/^Bearer\s+/i, ''), process.env.JWT_SECRET).id; } catch { return -1; } })() : -1;
    const data = await req.db.select({ id: posts.id, content: posts.content, createdAt: posts.createdAt, userId: posts.userId, username: users.username,
      likeCount: sql`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${posts.id})`,
      liked: sql`EXISTS (SELECT 1 FROM likes WHERE likes.post_id = ${posts.id} AND likes.user_id = ${id})`
    }).from(posts).innerJoin(users, eq(users.id, posts.userId)).orderBy(desc(posts.id)).limit(100);
    res.json({ data });
  } catch (err) { next(err); }
});
app.post('/api/posts', auth, async (req, res, next) => {
  try {
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 500) return res.status(400).json({ error: 'โพสต์ต้องมีข้อความ 1–500 ตัวอักษร' });
    const row = await req.db.insert(posts).values({ userId: req.userId, content, createdAt: new Date().toISOString() }).returning({ id: posts.id });
    res.status(201).json({ data: row[0] });
  } catch (err) { next(err); }
});
app.patch('/api/posts/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id), content = String(req.body?.content || '').trim();
    if (!Number.isSafeInteger(id) || id < 1 || !content || content.length > 500) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
    const found = await req.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!found.length) return res.status(404).json({ error: 'ไม่พบโพสต์' });
    if (found[0].userId !== req.userId) return res.status(403).json({ error: 'แก้ไขได้เฉพาะโพสต์ของตัวเอง' });
    await req.db.update(posts).set({ content }).where(eq(posts.id, id));
    res.json({ data: { id, content } });
  } catch (err) { next(err); }
});
app.delete('/api/posts/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'ID ไม่ถูกต้อง' });
    const found = await req.db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!found.length) return res.status(404).json({ error: 'ไม่พบโพสต์' });
    if (found[0].userId !== req.userId) return res.status(403).json({ error: 'ลบได้เฉพาะโพสต์ของตัวเอง' });
    await req.db.delete(likes).where(eq(likes.postId, id));
    await req.db.delete(posts).where(eq(posts.id, id));
    res.status(204).end();
  } catch (err) { next(err); }
});
app.post('/api/posts/:id/like', auth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isSafeInteger(postId) || postId < 1) return res.status(400).json({ error: 'ID ไม่ถูกต้อง' });
    const found = await req.db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).limit(1);
    if (!found.length) return res.status(404).json({ error: 'ไม่พบโพสต์' });
    const existing = await req.db.select().from(likes).where(sql`${likes.userId} = ${req.userId} AND ${likes.postId} = ${postId}`).limit(1);
    if (existing.length) await req.db.delete(likes).where(sql`${likes.userId} = ${req.userId} AND ${likes.postId} = ${postId}`);
    else await req.db.insert(likes).values({ userId: req.userId, postId });
    res.json({ liked: !existing.length });
  } catch (err) { next(err); }
});
app.use((_, res) => res.status(404).json({ error: 'ไม่พบ API' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'เซิร์ฟเวอร์มีปัญหา กรุณาลองอีกครั้ง' });
});

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`API: http://localhost:${port}/api/health`));
}

export default app;
