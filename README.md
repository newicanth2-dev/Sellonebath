# คุ้มเว่อร์ 1 บาท

เว็บไซต์รวบรวมและแนะนำสินค้า ลูกค้าจะไปซื้อสินค้ากับร้านค้าต้นทางโดยตรง โครงการนี้ใช้ HTML, CSS, Vanilla JavaScript, Supabase และ GitHub Pages

## สถานะ MVP

- หน้าร้าน: หน้าแรก, ค้นหา/กรอง/เรียงสินค้า, แบ่งหน้า, รายละเอียดสินค้า และลิงก์ไปยังร้านต้นทาง
- Admin: เข้าสู่ระบบ, Dashboard, เพิ่ม/แก้ไข/ซ่อน/เผยแพร่/ลบสินค้า และจัดการหมวดหมู่
- จัดการหมวดหมู่และแกลเลอรีรูปสินค้า สูงสุด 10 รูปต่อสินค้า; อัปโหลด JPG/PNG/WebP ได้รูปละไม่เกิน 5 MB
- ฐานข้อมูล PostgreSQL, Storage bucket และ RLS อยู่ใน `supabase/migrations/`
- เพิ่มสินค้าและข้อมูลร้านค้าต้นทางด้วยตนเอง ไม่มีระบบนำเข้าข้อมูลจาก URL
- ยังไม่มีระบบตะกร้า ชำระเงิน ขนส่ง หรือคลังสินค้า

## 1. สร้าง Supabase Project

1. สร้าง Project ใน Supabase และเก็บ Project URL กับ Anon/Publishable Key ไว้สำหรับตั้งค่าเว็บไซต์
2. เปิด **SQL Editor** แล้วเลือกทำตามสถานะของฐานข้อมูล:
   - Supabase Project ใหม่: รัน `001_initial_schema.sql`, `002_product_gallery.sql`, `003_remove_import_workflow.sql` และ `004_category_hierarchy.sql` ตามลำดับ
   - Project ที่ตั้งค่าไว้ก่อนแล้ว: รัน `004_category_hierarchy.sql` ใน SQL Editor เพื่อเพิ่มฟีเจอร์หมวดหมู่ย่อย (Subcategories)
3. ตรวจสอบหน้า **Database → Tables** ว่ามีตาราง `admin_users`, `categories`, `products` และ `price_history` พร้อมเปิด RLS
4. ใน **Authentication → Providers** เปิด Email ตามต้องการ และปิด Public Sign-ups เพื่อไม่ให้บุคคลทั่วไปสมัครบัญชีเอง
5. สร้างบัญชีผู้ดูแลจากหน้า Authentication ของ Supabase แล้วคัดลอก User ID
6. เพิ่ม User ID เป็นผู้ดูแลด้วย SQL Editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('ใส่-USER-UUID-ที่นี่');
   ```

การเพิ่มผู้ดูแลทำได้จาก Dashboard/SQL Editor เท่านั้น ไม่มีหน้าเว็บสำหรับยกระดับสิทธิ์บัญชี

## 2. ตั้งค่า Frontend

แก้ `assets/js/config.js` ให้เป็น Project URL และ Anon/Publishable Key ของ Supabase:

```js
window.KHUEM_WOER_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY"
};
```

Anon/Publishable Key ออกแบบมาให้ใช้ใน Frontend ได้ แต่ต้องใช้คู่กับ RLS ที่ถูกต้อง **ห้ามใส่ Service Role Key หรือ Secret Key ในไฟล์นี้** เพราะไฟล์ JavaScript ทุกไฟล์เปิดดูได้จากผู้เข้าชม

## 3. เพิ่มหมวดหมู่เริ่มต้น (ถ้าต้องการ)

เพิ่มหมวดหมู่จาก SQL Editor โดยเปลี่ยนชื่อและ slug ให้เหมาะกับร้าน:

```sql
insert into public.categories (name, slug)
values ('ของใช้ในบ้าน', 'home-living');
```

## 4. ทดสอบก่อนเผยแพร่

อย่าเปิด `index.html` หรือหน้า Admin ด้วยการดับเบิลคลิกเปิดไฟล์ (`file://`) เพราะเบราว์เซอร์จะบล็อก ES Modules ด้วย CORS และ JavaScript ของหน้า Login จะไม่ทำงาน

วิธีเปิดทดสอบใน VS Code:

1. ติดตั้งส่วนขยาย **Live Server** หากยังไม่มี
2. คลิกขวา `index.html` แล้วเลือก **Open with Live Server**
3. เปิดหน้า Admin ที่ `http://127.0.0.1:5500/admin/index.html` (ใช้ host/port ที่ Live Server แสดง)
4. กรอกอีเมลและรหัสผ่านในช่องของฟอร์มเท่านั้น อย่าใส่ข้อมูลล็อกอินใน URL เช่น `?email=...&password=...`

ทดสอบผ่าน GitHub Pages หรือ Static Web Server ได้เช่นกัน ตรวจสอบว่า:

- ผู้เข้าชมทั่วไปเห็นเฉพาะสินค้าที่เผยแพร่
- ผู้เข้าชมทั่วไปไม่สามารถเพิ่ม/แก้ไข/ลบสินค้าได้
- ผู้ดูแลที่อยู่ใน `admin_users` เข้าจัดการสินค้าได้
- สินค้าที่ไม่มีราคาจะแสดง “ไม่สามารถตรวจสอบราคาได้” ไม่แสดง 0 บาท
- ลิงก์สินค้าเปิดแท็บใหม่ด้วย `rel="noopener noreferrer"`
- หน้าเว็บแสดงสถานะว่างเมื่อยังไม่มีสินค้า

## 5. เผยแพร่ด้วย GitHub Pages

1. อัปโหลดไฟล์โครงการไปยัง GitHub Repository
2. เปิด **Settings → Pages**
3. เลือก Source เป็น **Deploy from a branch**
4. เลือก Branch และโฟลเดอร์ที่มี `index.html` เช่น `main` และ `/ (root)`
5. บันทึกและเปิด URL ที่ GitHub Pages แจ้ง

GitHub Pages เป็น Static Hosting ไม่มีเซิร์ฟเวอร์ส่วนตัวสำหรับเก็บ Secrets หรือประมวลผล URL ฝั่ง Backend

## ข้อจำกัดและความปลอดภัย

- โปรเจกต์ยังไม่เชื่อมต่อ API หรือ Affiliate API ของแพลตฟอร์มใด
- ห้ามถือว่าราคาเป็นปัจจุบันหากไม่มีเวลาตรวจสอบที่เชื่อถือได้ ผู้ดูแลควรตรวจสอบก่อนบันทึกราคา
- ใช้เฉพาะรูปภาพ/รายละเอียดที่มีสิทธิ์นำมาแสดง
- RLS เป็นตัวบังคับสิทธิ์จริง การซ่อนปุ่มใน Frontend ไม่ใช่มาตรการรักษาความปลอดภัย
- ระบบไม่ดึงข้อมูลจาก URL ต้นทางโดยอัตโนมัติ ผู้ดูแลกรอกและตรวจสอบข้อมูลสินค้าด้วยตนเอง

## โครงสร้างหลัก

```text
index.html, category.html, product.html   หน้าร้าน
admin/                                     หน้า Admin
assets/css/                                รูปแบบหน้าเว็บ
assets/js/                                 การเชื่อมต่อ Supabase และ UI
supabase/migrations/                       Schema, Index, Trigger และ RLS
```
