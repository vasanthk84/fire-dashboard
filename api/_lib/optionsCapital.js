async function fetchOptionsCapital() {
 const token = process.env.OI_ANALYZER_TOKEN;
 if (!token) return {configured:false,error:'OI Analyzer connection is not configured'};
 try {
  const base=(process.env.OI_ANALYZER_URL || 'http://165.227.84.87:82').replace(/\/$/, '');
  const res=await fetch(base+'/api/wheel-journal/external/funds', {
   headers:{Authorization:'Bearer '+token}, signal:AbortSignal.timeout(6000)});
  if (!res.ok) return {configured:true,error:'Kite funds unavailable (HTTP '+res.status+')'};
  const d=await res.json();
  if (!Number.isFinite(d.opening_balance) || d.opening_balance<0 ||
      !Number.isFinite(d.available_margin) || !Number.isFinite(d.blocked_margin) ||
      !Number.isFinite(Date.parse(d.asOf)) || Math.abs(Date.now()-Date.parse(d.asOf))>300000)
    return {configured:true,error:'Invalid or stale Kite funds snapshot'};
  return {configured:true,asOf:d.asOf,openingBalanceRupees:d.opening_balance,
    availableMarginRupees:d.available_margin,blockedMarginRupees:d.blocked_margin};
 } catch { return {configured:true,error:'Could not reach Kite funds through OI Analyzer'}; }
}
function resolveOptionsCapital(d, manualLakhs, useKite=true) {
 if (!useKite || !d.configured || d.error || !Number.isFinite(d.openingBalanceRupees) || d.openingBalanceRupees<0)
   return {source:'manual',valueLakhs:manualLakhs,reason:useKite ? d.error || 'Kite funds unavailable' : 'Manual override selected'};
 return {source:'kite',valueLakhs:d.openingBalanceRupees/100000,asOf:d.asOf,
   availableMarginRupees:d.availableMarginRupees,blockedMarginRupees:d.blockedMarginRupees};
}
module.exports={fetchOptionsCapital,resolveOptionsCapital};
