<script setup>
import { ref, onMounted } from 'vue';
const base = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const user = ref(JSON.parse(localStorage.getItem('social_user') || 'null'));
const token = ref(localStorage.getItem('social_token') || '');
const posts = ref([]);
const username = ref('');
const password = ref('');
const content = ref('');
const error = ref('');
const notice = ref('');
const mode = ref('login');
const busy = ref(false);
const editingId = ref(null);
const editingText = ref('');

async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  if (response.status === 204) return null;
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
  return json;
}
async function load() {
  try { const data = await api('/posts'); posts.value = data.data || []; }
  catch { error.value = 'โหลดโพสต์ไม่สำเร็จ ตรวจสอบ Backend URL'; }
}
async function submitAuth() {
  error.value = ''; busy.value = true;
  try {
    const result = await api(mode.value === 'login' ? '/login' : '/register', 'POST', { username: username.value, password: password.value });
    user.value = result.user; token.value = result.token;
    localStorage.setItem('social_user', JSON.stringify(result.user));
    localStorage.setItem('social_token', result.token);
    password.value = ''; username.value = ''; await load();
  } catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}
function logout() {
  user.value = null; token.value = '';
  localStorage.removeItem('social_user'); localStorage.removeItem('social_token');
  editingId.value = null; load();
}
async function publish() {
  if (!content.value.trim()) return;
  error.value = ''; busy.value = true;
  try { await api('/posts', 'POST', { content: content.value }); content.value = ''; await load(); }
  catch (err) { error.value = err.message; }
  finally { busy.value = false; }
}
async function like(post) {
  if (!user.value) { error.value = 'กรุณาเข้าสู่ระบบก่อนกดไลก์'; return; }
  try { await api(`/posts/${post.id}/like`, 'POST'); await load(); }
  catch (err) { error.value = err.message; }
}
function edit(post) { editingId.value = post.id; editingText.value = post.content; }
async function saveEdit(id) {
  try { await api(`/posts/${id}`, 'PATCH', { content: editingText.value }); editingId.value = null; await load(); }
  catch (err) { error.value = err.message; }
}
async function remove(id) {
  if (!confirm('ลบโพสต์นี้ใช่ไหม?')) return;
  try { await api(`/posts/${id}`, 'DELETE'); await load(); }
  catch (err) { error.value = err.message; }
}
function dateLabel(value) { return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); }
onMounted(async () => {
  if (token.value) {
    try { user.value = (await api('/me')).user; }
    catch { logout(); }
  }
  await load();
});
</script>
<template>
  <header class="topbar"><div class="wrap top"><div class="logo">● mini<span>social</span></div><div class="right"><span v-if="user">👋 {{ user.username }}</span><button v-if="user" class="textbutton" @click="logout">ออกจากระบบ</button><span v-else class="tag">Social Media Project</span></div></div></header>
  <main class="wrap layout"><section class="primary">
    <div class="intro"><h1>แชร์เรื่องราวของคุณ ✨</h1><p>โพสต์เรื่องที่อยากเล่า กดไลก์ และดูเรื่องราวจากเพื่อน ๆ</p></div>
    <div v-if="error" class="alert">{{ error }} <button @click="error = ''">×</button></div>
    <div v-if="notice" class="alert success">{{ notice }}</div>
    <div v-if="user" class="panel composer"><strong>สร้างโพสต์ใหม่</strong><textarea v-model="content" maxlength="500" rows="4" placeholder="วันนี้มีอะไรอยากแชร์บ้าง..."></textarea><div class="actions"><small>{{ content.length }}/500 ตัวอักษร</small><button class="mainbtn" :disabled="busy || !content.trim()" @click="publish">เผยแพร่โพสต์ ↗</button></div></div>
    <div v-else class="panel login-hint">🔐 เข้าสู่ระบบเพื่อเขียนโพสต์และกดไลก์</div>
    <div class="feedtitle"><h2>ฟีดล่าสุด</h2><span>{{ posts.length }} โพสต์</span></div>
    <div v-if="!posts.length" class="panel empty">ยังไม่มีโพสต์ ลองสร้างโพสต์แรกได้เลย 🎉</div>
    <article v-for="post in posts" :key="post.id" class="panel post"><div class="posthead"><div class="avatar">{{ post.username.charAt(0).toUpperCase() }}</div><div><strong>@{{ post.username }}</strong><small>{{ dateLabel(post.createdAt) }}</small></div></div>
      <template v-if="editingId === post.id"><textarea v-model="editingText" maxlength="500" rows="3"></textarea><div class="actions"><button class="textbutton" @click="editingId = null">ยกเลิก</button><button class="mainbtn" @click="saveEdit(post.id)">บันทึก</button></div></template>
      <p v-else class="postbody">{{ post.content }}</p>
      <div class="postfoot"><button class="like" :class="{ liked: Number(post.liked) }" @click="like(post)">{{ Number(post.liked) ? '♥' : '♡' }} {{ post.likeCount }} Like</button><div v-if="user && user.id === post.userId" class="right"><button class="textbutton" @click="edit(post)">แก้ไข</button><button class="textbutton danger" @click="remove(post.id)">ลบ</button></div></div>
    </article>
  </section><aside class="sidebar"><div v-if="!user" class="panel auth"><h2>{{ mode === 'login' ? 'ยินดีต้อนรับ 👋' : 'สมัครสมาชิก' }}</h2><p>เริ่มใช้งาน Mini Social ได้เลย</p><form @submit.prevent="submitAuth"><label>ชื่อผู้ใช้ (ภาษาอังกฤษ)</label><input v-model="username" minlength="3" maxlength="20" required placeholder="username" autocomplete="username"><label>รหัสผ่าน</label><input v-model="password" type="password" minlength="6" required placeholder="อย่างน้อย 6 ตัว" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"><button class="mainbtn full" :disabled="busy">{{ busy ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก' }}</button></form><p class="switch">{{ mode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?' }} <button class="link" @click="mode = mode === 'login' ? 'register' : 'login'; error = ''">{{ mode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ' }}</button></p></div><div v-else class="panel profile"><div class="avatar large">{{ user.username.charAt(0).toUpperCase() }}</div><h2>@{{ user.username }}</h2><p>สมาชิก Mini Social</p><div class="line"></div><small>โพสต์ของคุณ: {{ posts.filter(p => p.userId === user.id).length }}</small></div><div class="about"><strong>Mini Social</strong><p>เว็บโซเชียลมีเดียตัวอย่าง • Vue + Express + Drizzle + Turso</p></div></aside></main>
</template>
