import { defineConfig } from 'vite';

// Relative assets work both at localhost / and GitHub Pages /modeling-playground/.
export default defineConfig({base:'./',optimizeDeps:{include:['three/addons/loaders/FBXLoader.js']},build:{rolldownOptions:{input:{
  main:'index.html',spriteLab:'sprite-lab.html',game:'game.html',sceneEditor:'scene-editor.html',humanViewer:'human-viewer.html',motionEditor:'motion-editor.html',
}}}});
