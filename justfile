blender := env_var_or_default("BLENDER", if os() == "macos" { "/Applications/Blender.app/Contents/MacOS/Blender" } else { "blender" })

default:
    @just --list

build:
    "{{blender}}" --background --python scripts/build_town.py

render:
    "{{blender}}" --background output/little-town.blend --python scripts/render_town.py

test:
    pnpm exec tsc -p tsconfig.game.json
    pnpm test
    python3 -m unittest discover -s tests -p 'test_*.py'

all: build character walk ik suzu raven bastion strix ashley wyvern dog corgi corgi-chibi fes256 aster base45 lumi test render

# Open http://127.0.0.1:5188 to inspect GLB models.
dev:
    pnpm dev

viewer-build:
    pnpm build

test-e2e:
    pnpm test:e2e

# Character workshop: http://127.0.0.1:5188/human-viewer.html
human-viewer:
    pnpm dev --open /human-viewer.html

human-check:
    node --test tests/human.test.mjs
    pnpm exec playwright test tests/e2e/human.spec.mjs

# Type-check and test the TPS controller, then exercise the playable stage.
game-check:
    pnpm exec tsc -p tsconfig.game.json
    node --test tests/game.test.mjs tests/game-rig.test.mjs tests/game-combat.test.mjs tests/game-controls.test.mjs tests/game-enemies.test.mjs
    pnpm exec playwright test tests/e2e/game.spec.mjs tests/e2e/game-combat.spec.mjs tests/e2e/game-jump.spec.mjs tests/e2e/game-enemies.spec.mjs

# Build and check all models at the production subdirectory path.
test-pages: viewer-build
    pnpm test:pages

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

# Generate the weighted robot and its Hover / Boost / BladeSlash clips.
raven:
    node scripts/build_raven.mjs

# Three.js authoring path; Python/Blender assets remain usable without regeneration.
models-js: suzu raven bastion strix ashley wyvern dog corgi corgi-chibi fes256 aster base45 lumi

# Generate the ground-heavy robot with 11 interchangeable module sockets.
bastion:
    node scripts/build_bastion.mjs

# Generate the four-legged IK rig and Idle / Walk / Advance / Boost clips.
strix:
    node scripts/build_strix.mjs

# Generate the textured low-poly Ashley study and the editable PNG atlas.
ashley:
    node scripts/build_ashley.mjs

# Generate the low-poly wyvern with a weighted Hover loop and Rest pose.
wyvern:
    node scripts/build_wyvern.mjs

# Compact skinned dog: one palette material and sparse Idle curves.
dog:
    node scripts/build_dog.mjs

# Same canine generator, rig, and animation; only the breed preset differs.
corgi:
    node scripts/build_dog.mjs corgi

# More stylized proportions, sharing the same canine mesh and rig generator.
corgi-chibi:
    node scripts/build_dog.mjs corgi-chibi

# FES-inspired three-head-tall character; relaxed budget prioritizes cheek/hair volume.
fes256:
    node scripts/build_fes256.mjs

# Independent long-limbed study; keep LILA unchanged for comparison.
aster:
    node scripts/build_aster.mjs

# Connected quad base, weighted GLB, editable OBJ and topology/rig contract.
base45:
    node scripts/build_base45.mjs
    node scripts/build_base45_inspection.mjs

# Optional native Blender authoring file with quad mesh and editable armature.
base45-blend: base45
    "{{blender}}" --background --python scripts/build_base45_blend.py

# Separate dressed/haired instance; does not regenerate or overwrite BASE-45.
lumi:
    node scripts/build_lumi.mjs

# Deterministic indexed-pixel walk study, with shared 3D pose and 8 directions.
sprite-walk:
    node scripts/build_sprite_walk.mjs
