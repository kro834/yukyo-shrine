import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import {defineConfig} from 'vite';
export default defineConfig({base:(process.env.NEXT_PUBLIC_BASE_PATH??'')+'/',define:{'process.env.NEXT_PUBLIC_BASE_PATH':JSON.stringify(process.env.NEXT_PUBLIC_BASE_PATH??'')},server:{watch:{ignored:['**/work/**','**/assets/blender/**']}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[vinext()]});
