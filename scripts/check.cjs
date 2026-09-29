const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
for (const file of fs.readdirSync('src').filter(f=>f.endsWith('.js'))) execFileSync(process.execPath,['--check','src/'+file],{stdio:'inherit'});
for(const directory of ['tests','scripts'])for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.cjs')))execFileSync(process.execPath,['--check',directory+'/'+file],{stdio:'inherit'});
for (const file of ['experimental/largemap.html', 'hybrid-learning-v6.html']) {
  const html = fs.readFileSync(file,'utf8');
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) if(match[1].trim()) execFileSync(process.execPath,['--check'],{input:match[1],stdio:['pipe','inherit','inherit']});
}
console.log('JavaScript syntax checks passed');
