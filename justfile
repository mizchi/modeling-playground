blender := env_var_or_default("BLENDER", if os() == "macos" { "/Applications/Blender.app/Contents/MacOS/Blender" } else { "blender" })

default:
    @just --list

build:
    "{{blender}}" --background --python scripts/build_town.py

render:
    "{{blender}}" --background output/little-town.blend --python scripts/render_town.py

test:
    pnpm test

all: build test render

# Open http://127.0.0.1:5188 to inspect GLB models.
dev:
    pnpm dev

viewer-build:
    pnpm build

test-e2e:
    pnpm test:e2e
