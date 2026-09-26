const {fetchOptionsCapital}=require('./_lib/optionsCapital');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 return res.status(200).json(await fetchOptionsCapital());
};
