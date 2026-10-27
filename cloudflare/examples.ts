import {rebuild,type Data} from '../src/model';
import type {Store} from '../src/storage';
// Explicit sample action only; no automatic import of local/enterprise data.
export function exampleStore(userId:string):Store{
 const warehouses=['A','B'].map((letter,i)=>{
  const base=`demo-${userId}-${letter}`;
  const areas=[{id:base+'-area',name:'Vorne',prefix:'V',columns:3,levels:2}];
  const r=rebuild({id:base+'-rack',name:`Beispielregal ${letter}`,number:'1',building:String(90+i),width:3,height:2.4,depth:1,x:0,z:0,rotation:0,areas,slots:[]},[]);
  const data:Data={version:1,racks:[r],materials:[{id:base+'-mat',number:i?'DEMO-0002':'00007045210',name:`Beispielmaterial ${letter} · keine Unternehmensdaten`,description:'Fiktive Daten für den Online-Test',oldLocations:[`ALT-DEMO-${letter}`]}],stock:[]};
  return {id:base,name:`BEISPIEL · Testlager ${letter}`,buildings:[String(90+i)],data};
 });return {version:2,activeId:warehouses[0].id,builderExampleAdded:true,warehouses};
}
