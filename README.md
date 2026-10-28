# منصة المحاضرات التعليمية

مستودع واحد (npm workspaces) يضم الباك إند، وعامل تحويل الفيديو، ولوحة المدرّس والإدارة، ومنصة الطالب على الويب، وتطبيق الطالب (Expo)، والبنية التحتية لسيرفر VPS واحد.

```
apps/api       Express 5 + Mongoose — الحسابات، الكورسات، الرفع (tus)، التشغيل المؤمّن، الأكواد، الإدارة
apps/worker    BullMQ + FFmpeg — تحويل كل محاضرة إلى HLS مشفّر AES-128 بثلاث جودات
apps/admin     React (Vite) + Uppy — لوحة المدرّس والإدارة
apps/web       Next.js + hls.js — منصة الطالب وصفحة تفعيل الكود
apps/mobile    React Native (Expo) — تطبيق الطالب (حزمة مستقلة خارج workspaces)
packages/shared  الثوابت المشتركة: الأدوار، حالات الدرس، رموز الأخطاء ورسائلها بالعربية
infra/         docker-compose، قوالب Nginx، تهيئة MongoDB، سكربتات النسخ الاحتياطي وإنشاء المدير
docs/API.md    مرجع كامل لمسارات الـAPI
```

## التشغيل محلياً للتطوير

المتطلبات: Node.js 22 أو أحدث، FFmpeg في PATH، MongoDB كمجموعة نسخ (replica set) وRedis. أسهل طريقة لتشغيل الأخيرين:

```bash
docker run -d --name lp-mongo -p 27017:27017 mongo:8.0 --replSet rs0 --bind_ip_all
```

```bash
docker exec lp-mongo mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

```bash
docker run -d --name lp-redis -p 6379:6379 redis:7-alpine
```

ثم:

```bash
npm install
```

```bash
MEDIA_ROOT=./media-dev npm run dev:api
```

```bash
MEDIA_ROOT=./media-dev npm run dev:worker
```

```bash
MONGO_URI="mongodb://127.0.0.1:27017/lectures?replicaSet=rs0" node infra/scripts/create-admin.js --name "المدير" --phone 07700000000 --password "password123"
```

```bash
npm run dev:admin
```

```bash
npm run dev:web
```

القيم الافتراضية في وضع التطوير: الـAPI على `http://localhost:4000/api/v1`. في التطوير لا يوجد Nginx، لذا روابط المقاطع الموقّعة (`MEDIA_PUBLIC_URL`) تحتاج خادماً يقدّم مجلد `media-dev` — أو شغّل Nginx من `infra` محلياً.

## الاختبارات

```bash
npm test
```

أول تشغيل ينزّل نسخة MongoDB للاختبار (حوالي 800 ميغابايت). لاستعمال نسخة موجودة على جهازك: `MONGOMS_SYSTEM_BINARY=<مسار mongod> MONGOMS_VERSION=<رقمها> npm test`.

تشغّل اختبارات الـAPI على MongoDB في الذاكرة (مجموعة نسخ حقيقية بعقدة واحدة)، وتشمل اختباراً كاملاً لمسار الفيديو: رفع عبر tus على دفعتين (استئناف)، تحويل حقيقي بـFFmpeg إلى ثلاث جودات مشفّرة، ثم طلب التشغيل وقوائم HLS والمفتاح، وفك تشفير مقطع والتحقق منه بـffprobe.

## النشر على الـVPS

1. سيرفر Ubuntu بأربع أنوية و8 غيغابايت رام وقرص NVMe بحجم 200 غيغابايت أو أكثر. ثبّت Docker وrclone.
2. الجدار الناري: لا منفذ مفتوح غير 22 و80 و443.
   ```bash
   sudo ufw default deny incoming && sudo ufw allow 22,80,443/tcp && sudo ufw enable
   ```
   MongoDB وRedis في ملف Compose **بلا** `ports:` عمداً، لأن Docker يتجاوز ufw لأي منفذ منشور.
3. وجّه أسماء النطاقات الأربعة (API، الوسائط، الموقع، اللوحة) إلى عنوان السيرفر.
4. انسخ المستودع إلى `/opt/lectures`، ثم `cp .env.example infra/.env` واملأ كل القيم (`openssl rand -base64 48` للأسرار)، وأنشئ مجلد الوسائط:
   ```bash
   sudo mkdir -p /srv/media && sudo chown 1000:1000 /srv/media
   ```
5. الشهادة لأول مرة، ثم التشغيل:
   ```bash
   cd /opt/lectures/infra && ./scripts/init-certs.sh
   ```
   ```bash
   docker compose up -d --build
   ```
6. أول حساب مدير:
   ```bash
   docker compose run --rm -v ./scripts:/app/apps/api/scripts:ro api node scripts/create-admin.js --name "المدير" --phone 07700000000 --password "كلمة-مرور-طويلة"
   ```
7. النسخ الاحتياطي كل ليلة: اضبط `rclone config` على سيرفر ثانٍ، ثم أضف إلى crontab الخاص بـroot:
   ```
   0 3 * * * /opt/lectures/infra/scripts/backup.sh >> /var/log/lectures-backup.log 2>&1
   ```

التجديد التلقائي للشهادات يتم عبر خدمة `certbot`، وNginx يعيد التحميل كل 6 ساعات.

## كيف يعمل التشغيل المؤمّن

1. التطبيق يطلب `POST /lessons/:id/playback` برمز JWT. الـAPI يتحقق من الاشتراك (أو المعاينة المجانية)، ومن عدم وجود مشاهدة متزامنة من جهاز آخر، ثم يعيد رابط قائمة التشغيل برمز تشغيل صالح 4 ساعات، ونص العلامة المائية.
2. قوائم HLS تمر بالـAPI الذي يضع رابط المفتاح برمز التشغيل، ويحوّل كل مقطع إلى رابط Nginx موقّع (`secure_link`) ينتهي مع الرمز.
3. المفتاح (16 بايت) يأتي من MongoDB فقط، بلا تخزين مؤقت. Nginx لا يرى المفاتيح ولا يقدّم ملفات `m3u8` ولا ملفات الرفع الأصلية.

## ما يحتاج تدخّلك قبل الإطلاق

- حسابات Apple Developer وGoogle Play لبناء التطبيق ونشره (`eas build`)، راجع `apps/mobile/README.md`.
- قيم الإنتاج في `infra/.env` وأسماء النطاقات.
- اختبار التحميل بـk6 (المرحلة الثامنة) يُجرى على السيرفر الفعلي بسكربت `infra/k6/playback.js`.
- المراقبة: `docker compose --profile monitoring up -d` تشغّل Uptime Kuma (المنفذ 3001) وNetdata (19999) على 127.0.0.1 فقط، وتُفتح عبر نفق SSH.

## حدود معروفة

- على iOS لا يستطيع التطبيق إيقاف الفيديو أثناء تسجيل الشاشة؛ النظام يحجب الصورة المسجّلة لكن الصوت يُسجَّل. الحل الكامل يحتاج وحدة native صغيرة.
- على متصفح الويب لا يمكن منع تسجيل الشاشة، والتصوير بكاميرا خارجية لا يمنعه شيء؛ العلامة المائية هي ما يكشف مصدر التسريب.
- اختيار الجودة يدوياً في التطبيق يعتمد على تسمية مجلدات الجودات `v0`، `v1`، `v2` التي يكتبها العامل.
