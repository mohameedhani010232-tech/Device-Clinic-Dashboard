const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}
router.post('/', (req,res)=>{
  const dataUrl=String(req.body?.dataUrl||'');
  const match=dataUrl.match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match) return res.status(400).json({success:false,message:'صورة غير صالحة'});
  const buffer=Buffer.from(match[3],'base64');
  if(buffer.length>5*1024*1024) return res.status(413).json({success:false,message:'حجم الصورة أكبر من 5MB'});
  const ext={jpeg:'jpg',png:'png',webp:'webp'}[match[2]];
  const filename=`${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  try {
    fs.writeFileSync(path.join(uploadDir,filename),buffer);
    res.status(201).json({success:true,data:{url:`/uploads/${filename}`}});
  } catch (_) {
    // In serverless, return base64 image data directly
    res.status(201).json({success:true,data:{url:dataUrl}});
  }
});
module.exports=router;
