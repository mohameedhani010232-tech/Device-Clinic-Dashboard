const { z } = require('zod');
const JobOption = require('../models/JobOption');
const schema=z.object({name:z.string().trim().min(1).max(150)}).strict();
async function list(req,res){res.json({success:true,data:await JobOption.find({isActive:true}).sort({createdAt:1}).lean()});}
async function create(req,res){const payload=schema.parse(req.body);const data=await JobOption.findOneAndUpdate({name:payload.name},{$setOnInsert:payload,$set:{isActive:true}},{new:true,upsert:true,runValidators:true});res.status(201).json({success:true,data});}
async function update(req,res){const data=await JobOption.findByIdAndUpdate(req.params.id,schema.parse(req.body),{new:true,runValidators:true}).lean();if(!data)return res.status(404).json({success:false,message:'الوظيفة غير موجودة'});res.json({success:true,data});}
async function remove(req,res){const data=await JobOption.findByIdAndUpdate(req.params.id,{isActive:false},{new:true}).lean();if(!data)return res.status(404).json({success:false,message:'الوظيفة غير موجودة'});res.json({success:true});}
module.exports={list,create,update,remove};
