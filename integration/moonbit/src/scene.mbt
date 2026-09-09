// Standalone compatibility proof. The production host validates the entire v1
// document before calling this renderer adapter; kagura is not a dependency.
///|
struct Solid {
  id : String
  center : Array[Double]
  size : Array[Double]
} derive(FromJson)

///|
struct Target {
  id : String
  position : Array[Double]
  yaw : Double
} derive(FromJson)

///|
struct Stage {
  spawn : Array[Double]
  solids : Array[Solid]
  targets : Array[Target]
} derive(FromJson)

///|
struct Scene {
  version : Int
  units : String
  up : String
  forward : String
  stage : Stage
} derive(FromJson)

///|
fn place(node : @three.Object3D, name : String, xyz : Array[Double]) -> Unit {
  guard xyz.length() == 3 else { abort("Expected a three-component position") }
  node.set_name(name)
  node.position().set(xyz[0], xyz[1], xyz[2]) |> ignore
}

///|
pub fn load_scene(source : String) -> @three.Group {
  let doc : Scene = @json.from_json(@json.parse(source)) catch {
    e => abort(e.to_string())
  }
  guard doc.version == 1 &&
    doc.units == "meters" &&
    doc.up == "Y" &&
    doc.forward == "+Z" else {
    abort("Unsupported scene version or coordinates")
  }
  let root = @three.Group()
  root.set_name("iron-yard")
  let spawn = @three.Group().as_object3d()
  place(spawn, "spawn", doc.stage.spawn)
  root.add(spawn) |> ignore
  for solid in doc.stage.solids {
    guard solid.size.length() == 3 else {
      abort("Expected a three-component size")
    }
    let geometry = @three.BoxGeometry(
      solid.size[0],
      solid.size[1],
      solid.size[2],
    ).as_buffer_geometry()
    let material = @three.MeshBasicMaterial(0x69716e).as_material()
    let mesh = @three.Mesh(geometry, material).as_object3d()
    place(mesh, solid.id, solid.center)
    root.add(mesh) |> ignore
  }
  for target in doc.stage.targets {
    let node = @three.Group().as_object3d()
    place(node, target.id, target.position)
    node.rotate_y(target.yaw) |> ignore
    root.add(node) |> ignore
  }
  root
}
