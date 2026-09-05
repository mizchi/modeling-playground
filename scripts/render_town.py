"""Render a still using the exact PNG path saved in the Blender scene."""
import bpy

bpy.context.scene.frame_set(1)
bpy.ops.render.render(write_still=True)
