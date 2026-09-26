import type { OptionsCapitalSnapshot } from '../types';
export function OptionsCapitalHint({value,useKite=true,onModeChange,onRefresh}: {
 value?:OptionsCapitalSnapshot; useKite?:boolean;
 onModeChange?:(enabled:boolean)=>void; onRefresh?:()=>void;
}) {
 return <div role="status" style={{fontSize:12,marginBottom:12}}>
  {onModeChange && <label><input type="checkbox" checked={useKite} onChange={e=>onModeChange(e.target.checked)}/> Use Kite opening cash balance</label>}
  <div>Wheel cash capital: {value ? '₹'+value.valueLakhs.toFixed(2)+'L' : 'Loading…'}
   {value && (value.source==='kite' ? ' · Kite opening balance' : ' · Manual: '+value.reason)}</div>
  {value?.source==='kite' && <>
   <div>Available margin: ₹{value.availableMarginRupees?.toLocaleString('en-IN')} · Blocked/used: ₹{value.blockedMarginRupees?.toLocaleString('en-IN')}</div>
   <div>Fetched {value.asOf ? new Date(value.asOf).toLocaleString('en-IN') : ''}. Opening cash only; excludes shares and today's cash movements.</div>
  </>}
  {onRefresh && <button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>Refresh capital</button>}
 </div>;
}
