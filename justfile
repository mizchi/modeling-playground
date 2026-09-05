blender := env_var_or_default("BLENDER", if os() == "macos" { "/Applications/Blender.app/Contents/MacOS/Blender" } else { "blender" })

default:
    @just --list

build:
    "{{blender}}" --background --python scripts/build_town.py

render:
    "{{blender}}" --background output/little-town.blend --python scripts/render_town.py

test:
    pnpm test
    python3 -m unittest discover -s tests -p 'test_*.py'

all: build character walk ik suzu test render

# Open http://127.0.0.1:5188 to inspect GLB models.
dev:
    pnpm dev

viewer-build:
    pnpm build

test-e2e:
    pnpm test:e2e

# Generate, reimport, and render the humanoid character.
character:
    "{{blender}}" --background --python scripts/build_character.py

# Generate the rig, bake Walk, export GLB and render a walking pose.
walk:
    "{{blender}}" --background --python scripts/rig_character.py

# Generate native IK controls, verify constraints, export the viewer contract and render.
ik:
    "{{blender}}" --background --python scripts/build_ik.py

# Generate the anime character with Three.js only (no Blender required).
suzu:
    node scripts/build_suzu.mjs
