"""Build the pinned SimC adapter using Emscripten. No Node native modules needed."""
from pathlib import Path
import argparse, concurrent.futures as cf, json, os, re, subprocess, sys
from patch_simc import patch

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--source',required=True,type=Path)
    ap.add_argument('--emxx',default='em++',help='em++ executable or full path to em++.py')
    ap.add_argument('--em-config',help='Optional .emscripten configuration path')
    ap.add_argument('--jobs',type=int,default=4)
    ap.add_argument('--build-dir',type=Path,default=Path('build-wasm'))
    a=ap.parse_args();src=a.source.resolve();out=Path(__file__).resolve().parent;obj=a.build_dir.resolve();obj.mkdir(parents=True,exist_ok=True)
    env=os.environ.copy()
    if a.em_config:env['EM_CONFIG']=str(Path(a.em_config).resolve())
    em=([sys.executable,a.emxx] if a.emxx.endswith('.py') else [a.emxx])
    version=subprocess.check_output(em+['--version'],env=env,text=True)
    nums=re.search(r'(\d+)\.(\d+)\.(\d+)',version)
    old=nums and tuple(map(int,nums.groups()))<(3,1,27)
    patch(src)
    flags=['-std=c++17','-O1','-fexceptions','-DSC_NO_NETWORKING','-DSC_NO_THREADING','-DSC_USE_PTR=0',*[f'-I{src / "engine" / p}' for p in ('','lib','include')]]
    files=[src/'engine'/s for s in (src/'source_files/cmake_engine.txt').read_text().splitlines() if s.endswith('.cpp')]
    files.append(out/'gear_resolver.cpp')
    def compile(p):
        name=str(p.relative_to(src)).replace('\\','_').replace('/','_') if p.is_relative_to(src) else 'gear_resolver.cpp'
        target=obj/(name+'.o')
        # Rebuild every source to account for header and compiler changes.
        r=subprocess.run(em+flags+['-c',str(p),'-o',str(target)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
        if r.returncode:raise RuntimeError(str(p)+'\n'+r.stdout)
        return target
    print('Compiling',len(files),'sources',flush=True)
    with cf.ThreadPoolExecutor(max_workers=a.jobs) as pool:targets=list(pool.map(compile,files))
    args=[str(p) for p in targets]+['-O1','-fexceptions','-sDISABLE_EXCEPTION_CATCHING=0','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=134217728','-sMAXIMUM_MEMORY=2147483648','-sENVIRONMENT=node','-sMODULARIZE=1','-sEXPORTED_RUNTIME_METHODS=["callMain","FS"]','-sEXIT_RUNTIME=0',('-sTOTAL_STACK=' if old else '-sSTACK_SIZE=')+'5242880','-o',str(out/'gear-resolver.js')]
    rsp=obj/'link.rsp';rsp.write_text('\n'.join(json.dumps(x) for x in args),encoding='utf-8')
    subprocess.run(em+['@'+str(rsp)],env=env,check=True)
    print('Built gear-resolver.js + gear-resolver.wasm')

if __name__=='__main__':main()
