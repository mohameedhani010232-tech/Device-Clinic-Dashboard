# تشغيل المشروع
ضع ملف `.env` في نفس المجلد الذي يحتوي على `package.json`.

```env
MONGODB_URI=...
APP_PASSWORD=...
APP_SESSION_SECRET=...
SESSION_HOURS=12
```

السيرفر يبحث عن `.env` من جذر المشروع حتى لو شغلت `npm start` من مجلد مختلف.
