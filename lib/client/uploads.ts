import { api } from "@/lib/client/api";

export async function inspectFile(file:File, purpose:'worksheet'|'lesson') {
  if(file.size>5*1024*1024)throw new Error(`${file.name} exceeds the 5 MB limit.`);
  if(!['image/png','image/jpeg','application/pdf','application/json'].includes(file.type))throw new Error('Please choose a PNG, JPEG, PDF, or lesson JSON file.');
  if(file.type==='application/pdf'){
    const pdfjs = await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())});const doc=await task.promise;
    if(doc.numPages>(purpose==='worksheet'?1:3))throw new Error(purpose==='worksheet'?'Each worksheet must be one page.':'Lesson PDFs may have up to three pages.');
    let text='';let normalized:Blob|undefined;
    for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);const content=await page.getTextContent();text+=content.items.map(item=>'str'in item?item.str:'').join(' ')+'\n';if(p===1){const viewport=page.getViewport({scale:1.8});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvas,viewport}).promise;normalized=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to render this PDF.')),'image/png'));}}
    await task.destroy();return {preview:normalized?URL.createObjectURL(normalized):'',normalized,text};
  }
  if(file.type.startsWith('image/')){const bitmap=await createImageBitmap(file);const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>20_000_000)throw new Error('Images must be 20 megapixels or smaller.');return {preview:URL.createObjectURL(file),normalized:undefined,text:''};}
  return {preview:'',normalized:undefined,text:await file.text()};
}
export async function uploadFile(file:File, purpose:'worksheet'|'lesson', templateId?:string, studentId?:string,normalized?:Blob){
  const result=await api<{assets:{id:string;uploadUrl:string;method?:string;headers?:Record<string,string>;normalizedUploadUrl?:string}[]}>('/api/uploads/prepare',{purpose,templateId,files:[{name:file.name,type:file.type,size:file.size,...(studentId?{studentId}:{})}]});
  const asset=result.assets[0];const uploaded=await fetch(asset.uploadUrl,{method:asset.method??'PUT',headers:{'Content-Type':file.type,...asset.headers},body:file});if(!uploaded.ok)throw new Error(`Couldn't upload ${file.name}. Try again.`);
  if(normalized&&asset.normalizedUploadUrl){const normalizedResult=await fetch(asset.normalizedUploadUrl,{method:'PUT',headers:{'Content-Type':'image/png'},body:normalized});if(!normalizedResult.ok)throw new Error('The PDF preview could not be uploaded.');}
  await api(`/api/uploads/${asset.id}/complete`,{});return asset.id;
}
