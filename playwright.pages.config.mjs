import { defineConfig } from '@playwright/test';

const deployed=process.env.PLAYGROUND_URL;
export default defineConfig({
  testDir:'./tests/pages',
  timeout:30_000,
  workers:1,
  use:{baseURL:deployed??'http://127.0.0.1:4173/modeling-playground/',viewport:{width:1280,height:900}},
  webServer:deployed?undefined:{
    command:'pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort --base /modeling-playground/',
    url:'http://127.0.0.1:4173/modeling-playground/',
    reuseExistingServer:false,
  },
});
