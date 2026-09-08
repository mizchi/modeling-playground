# Motion test fixtures

`motion-reference.webm` is a locally generated 4-second VP8 test pattern, not a third-party video. It keeps Playwright tests offline and does not require FFmpeg in CI.

To regenerate when intentionally updating the fixture:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=160x120:rate=30' -t 4 -c:v libvpx -an tests/fixtures/motion-reference.webm
```

Real Hunyuan FBX assets are not redistributed. Optionally set `HUNYUAN_SAMPLE_FBX` to a local file to run the provider smoke test. This test never invokes a paid API.
