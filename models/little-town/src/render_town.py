"""Render a still beside this model, including legacy blends with an old absolute path."""
from pathlib import Path
import bpy

output = Path(__file__).resolve().parents[1] / 'output'
output.mkdir(parents=True, exist_ok=True)
bpy.context.scene.render.filepath = str(output / 'little-town.png')
bpy.context.scene.frame_set(1)
bpy.ops.render.render(write_still=True)
