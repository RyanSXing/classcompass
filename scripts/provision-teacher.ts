import { config } from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient, type User } from '@supabase/supabase-js';

config({path:'.env.local',quiet:true});
const EMAIL='teacher@classcompass.example';
const filename=path.resolve('.local/teacher-login.json');
type SavedLogin={id:string;email:string;password:string;projectURL:string};
const boundedFetch:typeof fetch=(input,init={})=>fetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(20000)])});
async function main(){
  const projectURL=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY,publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!projectURL||!secret||!publishable)throw Error('Set the project URL, publishable key and local admin key in .env.local.');
  const projectRef=(await fs.readFile('supabase/.temp/project-ref','utf8')).trim();
  if(!/^[a-z]{20}$/.test(projectRef)||new URL(projectURL).hostname!==`${projectRef}.supabase.co`)throw Error('The configured URL must match this repository’s linked Supabase project.');
  const options={auth:{persistSession:false,autoRefreshToken:false},db:{timeout:20000,retry:false},global:{fetch:boundedFetch}};
  const admin=createClient(projectURL,secret,options);
  let teacher:User|undefined;
  for(let page=1;page<=100;page++){
    const result=await admin.auth.admin.listUsers({page,perPage:100});
    if(result.error)throw Error(`Could not inspect the linked project's teacher account: ${result.error.message}`);
    teacher=result.data.users.find(user=>user.email?.toLowerCase()===EMAIL);
    if(teacher||result.data.users.length<100)break;
  }
  let existing:SavedLogin|null=null;
  try{existing=JSON.parse(await fs.readFile(filename,'utf8')) as SavedLogin;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw Error('The existing private login file is unreadable. Preserve it and repair the file before provisioning.');}
  if(teacher&&existing&&existing.id===teacher.id&&existing.email===EMAIL&&existing.projectURL===projectURL&&existing.password){
    const client=createClient(projectURL,publishable,options);
    const validation=await client.auth.signInWithPassword({email:EMAIL,password:existing.password});
    if(validation.error)throw Error('The saved teacher login no longer works. Review the account before resetting its password.');
    await client.auth.signOut({scope:'local'});
    await fs.chmod(filename,0o600);
    console.log(`Existing demo teacher verified. Private credentials: ${filename}`);return;
  }
  const password=`Cc!${randomBytes(32).toString('base64url')}7a`;
  if(teacher){
    const updated=await admin.auth.admin.updateUserById(teacher.id,{password,email_confirm:true,user_metadata:{...teacher.user_metadata,display_name:'Demo teacher'}});
    if(updated.error)throw Error(`Could not provision the specified demo teacher: ${updated.error.message}`);
    teacher=updated.data.user;
  }else{
    const created=await admin.auth.admin.createUser({email:EMAIL,password,email_confirm:true,user_metadata:{display_name:'Demo teacher'}});
    if(created.error)throw Error(`Could not create the fictional demo teacher: ${created.error.message}`);
    teacher=created.data.user;
  }
  if(!teacher)throw Error('The provider did not return a teacher identity.');
  const saved:SavedLogin={id:teacher.id,email:EMAIL,password,projectURL};
  await fs.mkdir(path.dirname(filename),{recursive:true,mode:0o700});
  const temporary=`${filename}.${randomUUID()}.tmp`;
  try{await fs.writeFile(temporary,JSON.stringify(saved,null,2)+'\n',{mode:0o600,flag:'wx'});await fs.rename(temporary,filename);}finally{await fs.unlink(temporary).catch(()=>{});}
  console.log(`Demo teacher provisioned. Private credentials: ${filename}`);
  console.log('No password was printed, and no invitation or confirmation email was sent.');
}
main().catch(error=>{console.error(`Teacher provisioning failed: ${error instanceof Error?error.message:'unknown error'}`);process.exitCode=1;});
