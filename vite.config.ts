import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import {defineConfig} from 'vite';
export default defineConfig({server:{watch:{ignored:['**/work/**','**/assets/blender/**']}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[vinext()]});
