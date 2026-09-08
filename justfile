blender := env_var_or_default("BLENDER", if os() == "macos" { "/Applications/Blender.app/Contents/MacOS/Blender" } else { "blender" })

default:
    @just --list

build:
    "{{blender}}" --background --python models/little-town/src/build_town.py

render:
    "{{blender}}" --background models/little-town/output/little-town.blend --python models/little-town/src/render_town.py

test:
    pnpm typecheck
    pnpm test
    python3 -m unittest discover -s tests -p 'test_*.py'

all: build character walk ik suzu raven bastion strix ashley wyvern dog corgi corgi-chibi fes256 aster base45 lumi test render

# Open http://127.0.0.1:5188 to inspect GLB models.
dev:
    pnpm dev

viewer-build:
    pnpm build

test-e2e *args:
    pnpm test:e2e {{args}}
    node --test tests/model-layout.test.ts

# Character workshop: http://127.0.0.1:5188/human-viewer.html
human-viewer:
    pnpm dev --open /human-viewer.html

# Local reference video + keyframe authoring; no external API calls.
motion-editor:
    pnpm dev --open /motion-editor.html

# plan is offline; submit requires an explicit --execute flag.
motion-generate *args:
    node motion/generation/cli.ts {{args}}

motion-check:
    pnpm typecheck:native
    node --test tests/motion-*.test.ts
    pnpm exec playwright test tests/e2e/motion.spec.ts

human-check:
    node --test tests/quad-normals.test.ts tests/lumi.test.ts
    node --test tests/human.test.ts tests/human-female.test.ts tests/human-side-tail.test.ts tests/human-body-shape.test.ts tests/human-proportions.test.ts tests/base45-cheek.test.ts tests/base45-head.test.ts tests/base45-neck.test.ts tests/base45-ears.test.ts
    pnpm exec playwright test tests/e2e/human.spec.ts tests/e2e/human-side-tail.spec.ts tests/e2e/human-body-shape.spec.ts tests/e2e/human-proportions.spec.ts tests/e2e/human-face-contour.spec.ts

# Compatible female body preset; preserve approved BASE-45 / LUMI assets.
human-female:
    node human/models/base45/src/build-female.ts

# 女性素体 + 黄色のサイドテール、設定JSONとモーション付きGLB
human-side-tail:
    node human/models/lumi/src/build-side-tail.ts

# Type-check and test the TPS controller, then exercise the playable stage.
game-check:
    pnpm exec tsc -p tsconfig.game.json
    node --test tests/game.test.ts tests/game-rig.test.ts tests/game-combat.test.ts tests/game-controls.test.ts tests/game-enemies.test.ts
    pnpm exec playwright test tests/e2e/game.spec.ts tests/e2e/game-combat.spec.ts tests/e2e/game-jump.spec.ts tests/e2e/game-enemies.spec.ts

# Build and check all models at the production subdirectory path.
test-pages: viewer-build
    pnpm test:pages

# Generate, reimport, and render the humanoid character.
character:
    "{{blender}}" --background --python human/models/traveler/src/build_character.py

# Generate the rig, bake Walk, export GLB and render a walking pose.
walk:
    "{{blender}}" --background --python human/models/traveler/src/rig_character.py

# Generate native IK controls, verify constraints, export the viewer contract and render.
ik:
    "{{blender}}" --background --python human/models/traveler/src/build_ik.py

# Generate the anime character with Three.js only (no Blender required).
suzu:
    node human/models/suzu/src/build.ts

# Generate the weighted robot and its Hover / Boost / BladeSlash clips.
raven:
    node robot/models/raven/src/build.ts

# Three.js authoring path; Python/Blender assets remain usable without regeneration.
models-js: suzu raven bastion strix ashley wyvern dog corgi corgi-chibi fes256 aster base45 lumi

# Generate the ground-heavy robot with 11 interchangeable module sockets.
bastion:
    node robot/models/bastion/src/build.ts

# Generate the four-legged IK rig and Idle / Walk / Advance / Boost clips.
strix:
    node robot/models/strix/src/build.ts

# Generate the textured low-poly Ashley study and the editable PNG atlas.
ashley:
    node human/models/ashley/src/build.ts

# Generate the low-poly wyvern with a weighted Hover loop and Rest pose.
wyvern:
    node models/wyvern/src/build.ts

# Compact skinned dog: one palette material and sparse Idle curves.
dog:
    node models/dog/src/build.ts

# Same canine generator, rig, and animation; only the breed preset differs.
corgi:
    node models/dog/src/build.ts corgi

# More stylized proportions, sharing the same canine mesh and rig generator.
corgi-chibi:
    node models/dog/src/build.ts corgi-chibi

# FES-inspired three-head-tall character; relaxed budget prioritizes cheek/hair volume.
fes256:
    node human/models/fes256/src/build.ts

# Independent long-limbed study; keep LILA unchanged for comparison.
aster:
    node human/models/aster/src/build.ts

# Connected quad base, weighted GLB, editable OBJ and topology/rig contract.
base45:
    node human/models/base45/src/build.ts
    node human/models/base45/src/build-inspection.ts

# Optional native Blender authoring file with quad mesh and editable armature.
base45-blend: base45
    "{{blender}}" --background --python human/models/base45/src/build-blend.py

# Separate dressed/haired instance; does not regenerate or overwrite BASE-45.
lumi:
    node human/models/lumi/src/build.ts

# Deterministic indexed-pixel walk study, with shared 3D pose and 8 directions.
sprite-walk:
    node models/sprite-walk/src/build.ts
