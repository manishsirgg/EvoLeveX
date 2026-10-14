import 'server-only'
import { planPrintfulReconciliation } from './reconciliation-plan'
import { previewPrintfulMedia } from './media-preview'

export const HOODIE_PRODUCT_ID = 'd0ad3d72-03b5-428b-969f-416e5c835011'
const HOODIE_SYNC_ID = 481420111
const APPROVED = [
  {fileId:1085999540,color:'BLACK',sortOrder:0,label:'Black hoodie front'},
  {fileId:1085999541,color:'NAVY',sortOrder:1,label:'Navy hoodie front'},
] as const

export type ApprovedHoodieMockup = {
  fileId:number;color:string;sortOrder:number;label:string;providerUrl:string
}
export async function stageApprovedHoodieMockupGallery():
  Promise<{ok:true;mockups:ApprovedHoodieMockup[]}|{ok:false;code:string}> {
  const plan=await planPrintfulReconciliation(HOODIE_PRODUCT_ID,HOODIE_SYNC_ID,'USD')
  if(!plan.ok || plan.prices.length!==10 || plan.images.length!==2)
    return {ok:false,code:'RECONCILIATION_FAILED'}
  const media=await previewPrintfulMedia(HOODIE_SYNC_ID)
  if('error' in media || media.inspectedVariants!==10)
    return {ok:false,code:'PROVIDER_UNAVAILABLE'}
  const mockups:ApprovedHoodieMockup[]=[]
  for(const approved of APPROVED) {
    const mapped=plan.images.find(i=>i.fileId===approved.fileId && i.color===approved.color)
    if(!mapped) return {ok:false,code:'APPROVED_FILE_CHANGED'}
    const matches=media.candidates.filter(c=>c.type==='preview' && c.fileId===approved.fileId)
    if(matches.length===0 || new Set(matches.map(c=>c.previewUrl)).size!==1)
      return {ok:false,code:'FILE_URL_AMBIGUOUS'}
    mockups.push({...approved,providerUrl:matches[0].previewUrl})
  }
  return {ok:true,mockups}
}
