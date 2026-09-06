import { defineConfig } from 'vite';

// Relative assets work both at localhost / and GitHub Pages /modeling-playground/.
export default defineConfig({base:'./',build:{rolldownOptions:{input:{
  main:'index.html',spriteLab:'sprite-lab.html',game:'game.html',
}}}});
