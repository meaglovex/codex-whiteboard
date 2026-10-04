import{promises as fs}from'node:fs';
import path from'node:path';
export async function thirdPartyNotices(root){
  const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'));
  const sections=[];
  for(const [location,meta]of Object.entries(lock.packages||{})){
    // shadcn's imported CSS ships in the UI even though its CLI is a build dependency.
    if(!location||meta.dev&&location!=='node_modules/shadcn'||meta.link)continue;
    const dir=path.join(root,location);let pkg;
    try{pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));}catch(e){if(meta.optional&&e.code==='ENOENT')continue;throw e;}
    const names=(await fs.readdir(dir)).filter(n=>/^licen[cs]e(?:[._-]|$)/i.test(n));
    const licenses=[];
    for(const name of names){if((await fs.stat(path.join(dir,name))).isFile())licenses.push(await fs.readFile(path.join(dir,name),'utf8'));}
    sections.push(`${pkg.name} ${pkg.version}\nLicense: ${pkg.license||meta.license||'See package repository'}\n${licenses.join('\n')||'No standalone license file in the installed package.'}`);
  }
  const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  return `Third-party software notices for Product Whiteboard ${version}\n\n`+sections.join('\n\n--------------------\n\n')+'\n';
}
