export const plans={BC:[[500,65],[1000,75],[2000,85]],AB:[[500,65],[1000,75],[2000,85]],MB:[[100,70],[500,85],[2000,95]],SK:[[1000,55],[2000,65]],ON:[[1000,55],[2000,65]]};
export const tvPlans={none:0,essential:35,plus:55,ultimate:95};
export function quote(province,speed,tv='none',phone=false,autopay=false){
 const plan=plans[province]?.find(p=>p[0]===Number(speed));
 if(!plan||!Object.hasOwn(tvPlans,tv))throw Error('Invalid plan');
 const discount=['BC','AB','MB'].includes(province)&&autopay?5:0;
 const internet=plan[1]-discount;const television=tvPlans[tv];const homePhone=phone?25:0;
 return {internet,television,homePhone,discount,total:internet+television+homePhone,promo:['SK','ON'].includes(province),dueToday:0};
}
