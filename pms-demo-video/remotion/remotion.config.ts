import { Config } from '@remotion/cli/config';
Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
// Use a locally installed headless Chromium when REMOTION_BROWSER is set (e.g. in CI sandboxes).
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
