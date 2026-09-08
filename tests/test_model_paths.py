"""The legacy Blender render entry point must not write into the old flat output directory."""
import runpy
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


class ModelPathTests(unittest.TestCase):
    def test_town_render_retargets_legacy_blend_path(self):
        root = Path(__file__).resolve().parents[1]
        scene = SimpleNamespace(render=SimpleNamespace(filepath='/old/output/little-town.png'), frame_set=Mock())
        render = Mock()
        bpy = SimpleNamespace(context=SimpleNamespace(scene=scene), ops=SimpleNamespace(render=SimpleNamespace(render=render)))
        with patch.dict(sys.modules, {'bpy': bpy}):
            runpy.run_path(str(root / 'models/little-town/src/render_town.py'))
        self.assertEqual(scene.render.filepath, str(root / 'models/little-town/output/little-town.png'))
        scene.frame_set.assert_called_once_with(1)
        render.assert_called_once_with(write_still=True)
