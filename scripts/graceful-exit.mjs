if(process.platform==='win32'){const exit=process.exit.bind(process);process.exit=(code=0)=>{if(Number(code)!==0)return exit(code);setTimeout(()=>exit(code),500);};}
