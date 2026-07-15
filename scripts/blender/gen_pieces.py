# Ramayan Chess — piece generator.
#
# Builds all 12 pieces (6 types x 2 armies) as stylized temple-idol statues
# and exports them as a single GLB whose object names are "<type>-<army>"
# (e.g. "k-ram", "n-lanka"). Figures come from skin-modifier skeletons
# (smooth, organic statue forms); crowns, weapons and pedestals are
# primitives. Every object carries exactly the shared materials
# main_ram/accent_ram or main_lanka/accent_lanka — the game swaps them for
# its own three.js materials by name prefix.
#
# Run (portable Blender, from the repo root):
#   blender -b --python scripts/blender/gen_pieces.py -- --render <dir>
#   blender -b --python scripts/blender/gen_pieces.py -- --export public/models/pieces.glb
#
# Coordinates: Z up (Blender), statues face -Y; the glTF exporter's Y-up
# conversion makes them face +Z in three.js. 1 unit = 1 board square.

import bpy
import math
import sys
from mathutils import Vector

# ---------------------------------------------------------------- cli

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(flag):
    return argv[argv.index(flag) + 1] if flag in argv else None


RENDER_DIR = arg('--render')
EXPORT_PATH = arg('--export')
ONLY = arg('--only')

# ---------------------------------------------------------------- scene

for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for item in list(block):
        block.remove(item)


def make_mat(name, color, metallic=0.0, rough=0.5, emission=None, emission_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    return m


def hexc(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))


MATS = {
    'ram': {
        'main': make_mat('main_ram', hexc('#f0e3c6'), 0.05, 0.45),
        'accent': make_mat('accent_ram', hexc('#e3a83d'), 0.9, 0.3),
    },
    'lanka': {
        'main': make_mat('main_lanka', hexc('#453b52'), 0.3, 0.5),
        'accent': make_mat('accent_lanka', hexc('#b0642a'), 0.8, 0.35, hexc('#ff5a00'), 0.35),
    },
}

# ---------------------------------------------------------------- primitives


def _take(name, army, slot):
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(MATS[army][slot])
    return obj


def sphere(army, slot, r, loc, scale=(1, 1, 1), seg=20, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=loc)
    o = _take('part', army, slot)
    o.scale = scale
    return o


def cyl(army, slot, r1, r2, depth, loc, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    return _take('part', army, slot)


def cone(army, slot, r, depth, loc, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0, depth=depth, vertices=verts, location=loc, rotation=rot)
    return _take('part', army, slot)


def torus(army, slot, major, minor, loc, rot=(0, 0, 0), arc=None, maj_seg=28, min_seg=10):
    kw = dict(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
              major_segments=maj_seg, minor_segments=min_seg)
    bpy.ops.mesh.primitive_torus_add(**kw)
    o = _take('part', army, slot)
    if arc is not None:
        # trim to an arc by deleting verts beyond the angle (in local XY)
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(o.data)
        for v in list(bm.verts):
            a = math.atan2(v.co.y, v.co.x)
            if a < -0.01 or a > arc:
                bm.verts.remove(v)
        bm.to_mesh(o.data)
        bm.free()
    return o


def box(army, slot, size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = _take('part', army, slot)
    o.scale = size
    return o


def subsurf(obj, levels=2):
    m = obj.modifiers.new('subs', 'SUBSURF')
    m.levels = levels
    m.render_levels = levels
    return obj


def bake(obj):
    """Apply all modifiers — join() would silently drop them otherwise."""
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        for m in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    return obj

# ---------------------------------------------------------------- skin figures


def skin_figure(army, slot, joints, edges, radii, root, levels=2):
    """joints: {name: (x, y, z)}; edges: [(a, b)]; radii: {name: r}."""
    names = list(joints)
    idx = {n: i for i, n in enumerate(names)}
    mesh = bpy.data.meshes.new('fig')
    mesh.from_pydata([joints[n] for n in names], [(idx[a], idx[b]) for a, b in edges], [])
    obj = bpy.data.objects.new('fig', mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATS[army][slot])

    skin = obj.modifiers.new('skin', 'SKIN')
    skin.use_smooth_shade = True
    for n in names:
        sv = obj.data.skin_vertices[0].data[idx[n]]
        r = radii[n]
        sv.radius = (r, r)
        if n == root:
            sv.use_root = True
    subsurf(obj, levels)
    return bake(obj)

# ---------------------------------------------------------------- shared elements


def pedestal(army, r):
    """Temple pedestal. Ram: round lotus steps; Lanka: angular obsidian."""
    verts = 24 if army == 'ram' else 8
    parts = [
        cyl(army, 'main', r, r * 0.96, 0.05, (0, 0, 0.025), verts=verts),
        cyl(army, 'main', r * 0.88, r * 0.7, 0.06, (0, 0, 0.08), verts=verts),
        torus(army, 'accent', r * 0.66, 0.015, (0, 0, 0.1)),
    ]
    return parts


def finalize(name, parts, face_smooth=True):
    """Join parts into one object whose base rests on z=0."""
    target = parts[0]
    with bpy.context.temp_override(active_object=target, selected_editable_objects=parts):
        bpy.ops.object.join()
    target.name = name
    if face_smooth:
        mesh = target.data
        mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
        if hasattr(mesh, 'set_sharp_from_angle'):
            mesh.set_sharp_from_angle(angle=math.radians(48))
        mesh.update()
    return target


def gada(army, x, z, tilt=0.0, scale=1.0):
    """Hanuman's mace: shaft + heavy head + finial, tilted about Y."""
    s, c = math.sin(tilt), math.cos(tilt)
    parts = []
    # shaft center
    sh = 0.30 * scale
    parts.append(cyl(army, 'accent', 0.018 * scale, 0.024 * scale, sh, (x + s * sh * 0.0, 0, z), (0, tilt, 0), verts=10))
    hx = x - s * (sh / 2 + 0.07 * scale) * -1
    parts.append(sphere(army, 'accent', 0.085 * scale, (x + s * (sh / 2 + 0.06 * scale), 0, z + c * (sh / 2 + 0.06 * scale))))
    parts.append(cone(army, 'accent', 0.03 * scale, 0.07 * scale,
                      (x + s * (sh / 2 + 0.16 * scale), 0, z + c * (sh / 2 + 0.155 * scale)), (0, tilt, 0)))
    return parts


def bow(army, x, z, height):
    """Kodanda: vertical limb arc bulging outward, straight string at x."""
    joints, edges, radii = {}, [], {}
    n = 7
    for i in range(n):
        t = i / (n - 1) * 2 - 1  # -1 .. 1 along the limb
        joints[f'w{i}'] = (x + (1 - t * t) * height * 0.16, 0, z + t * height / 2)
        radii[f'w{i}'] = 0.015 - abs(t) * 0.007
        if i:
            edges.append((f'w{i - 1}', f'w{i}'))
    limb = skin_figure(army, 'accent', joints, edges, radii, 'w3')
    string = cyl(army, 'accent', 0.004, 0.004, height * 0.98, (x, 0, z), verts=6)
    return [limb, string]


def trident(army, x, z, h=0.42):
    parts = [cyl(army, 'accent', 0.013, 0.013, h, (x, 0, z), verts=8)]
    top = z + h / 2
    parts.append(cone(army, 'accent', 0.013, 0.08, (x, 0, top + 0.045)))
    for dx in (-0.038, 0.038):
        parts.append(cone(army, 'accent', 0.011, 0.06, (x + dx, 0, top + 0.032)))
    parts.append(torus(army, 'accent', 0.038, 0.007, (x, 0, top - 0.005), (math.pi / 2, 0, 0), maj_seg=16))
    return parts


def mukut(army, z, r=0.075, tall=0.16):
    """Tall temple crown."""
    parts = [
        torus(army, 'accent', r, 0.018, (0, 0, z)),
        cone(army, 'accent', r * 0.9, tall, (0, 0, z + tall / 2 + 0.01), verts=16),
        sphere(army, 'accent', 0.022, (0, 0, z + tall + 0.03), seg=10, rings=8),
    ]
    return parts

# ---------------------------------------------------------------- figures
# Shared humanoid: robe skirt -> chest -> head, posed arms.


def humanoid(army, slot, *, h=1.0, base_r=0.16, chest_r=0.10, arm_r=0.032,
             l_hand=None, r_hand=None, l_elbow=None, r_elbow=None, lean=0.0):
    """h: shoulder height. Hands/elbows given in absolute coords or defaults."""
    sh = h  # shoulder line
    waist = h * 0.52
    yl = lean  # forward lean (toward -Y)
    joints = {
        'hem': (0, 0, 0.04),
        'skirt': (0, 0, waist * 0.55),
        'waist': (0, -yl * 0.3, waist),
        'chest': (0, -yl * 0.8, sh * 0.9),
        'neck': (0, -yl, sh),
        'shL': (chest_r + 0.055, -yl * 0.9, sh * 0.965),
        'shR': (-(chest_r + 0.055), -yl * 0.9, sh * 0.965),
    }
    radii = {
        'hem': base_r, 'skirt': base_r * 0.72, 'waist': base_r * 0.5,
        'chest': chest_r, 'neck': chest_r * 0.62,
        'shL': arm_r * 1.25, 'shR': arm_r * 1.25,
    }
    edges = [('hem', 'skirt'), ('skirt', 'waist'), ('waist', 'chest'), ('chest', 'neck'),
             ('chest', 'shL'), ('chest', 'shR')]

    def add_arm(side, elbow, hand):
        if not hand:
            # relaxed arm by the side
            elbow = elbow or ((chest_r + 0.09) * side, -yl * 0.7, sh * 0.75)
            hand = ((chest_r + 0.10) * side, -yl * 0.5 - 0.02, sh * 0.55)
        elbow = elbow or ((chest_r + 0.10) * side, -0.06, sh * 0.78)
        joints[f'el{side}'] = elbow
        joints[f'ha{side}'] = hand
        radii[f'el{side}'] = arm_r
        radii[f'ha{side}'] = arm_r * 1.1
        edges.append(('shL' if side > 0 else 'shR', f'el{side}'))
        edges.append((f'el{side}', f'ha{side}'))

    add_arm(1, l_elbow, l_hand)
    add_arm(-1, r_elbow, r_hand)
    return skin_figure(army, slot, joints, edges, radii, 'waist')


def head_with(army, z, r=0.085, y=0.0):
    return sphere(army, 'main', r, (0, y, z))

# ---------------------------------------------------------------- pawn


def build_pawn(army):
    parts = pedestal(army, 0.24)
    if army == 'ram':
        # vanar warrior: alert stance, tail curling behind
        fig = humanoid(army, 'main', h=0.42, base_r=0.115, chest_r=0.075, arm_r=0.026,
                       l_hand=(0.13, -0.09, 0.3), r_hand=None)
        fig.location.z = 0.1
        parts.append(fig)
        parts.append(head_with(army, 0.6, 0.075))
        # muzzle + ears
        parts.append(sphere(army, 'main', 0.032, (0, -0.065, 0.585), seg=12, rings=8))
        for dx in (-0.062, 0.062):
            parts.append(sphere(army, 'main', 0.026, (dx, 0, 0.645), seg=10, rings=8))
        parts.append(torus(army, 'accent', 0.062, 0.011, (0, 0, 0.65)))
        # tail: sweeping S-curve up the back
        tail = skin_figure(army, 'main', {
            't0': (0, 0.10, 0.12), 't1': (0, 0.17, 0.3), 't2': (0, 0.14, 0.5),
            't3': (0, 0.05, 0.62), 't4': (0, -0.01, 0.56),
        }, [('t0', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4')],
            {'t0': 0.028, 't1': 0.024, 't2': 0.02, 't3': 0.016, 't4': 0.012}, 't0')
        tail.location.z = 0.1
        parts.append(tail)
        # small club resting on shoulder
        parts.append(cyl(army, 'accent', 0.016, 0.028, 0.2, (0.16, -0.1, 0.42), (0.5, 0.5, 0), verts=8))
    else:
        # rakshasa imp: hunched, horned
        fig = humanoid(army, 'main', h=0.4, base_r=0.12, chest_r=0.082, arm_r=0.028, lean=0.05)
        fig.location.z = 0.1
        parts.append(fig)
        parts.append(head_with(army, 0.58, 0.078, y=-0.03))
        for sx in (-1, 1):
            parts.append(cone(army, 'accent', 0.02, 0.09, (sx * 0.05, -0.03, 0.66), (0, sx * 0.5, 0), verts=8))
            # jagged pauldrons
            parts.append(cone(army, 'main', 0.045, 0.08, (sx * 0.135, -0.02, 0.5), (0, sx * 0.9, 0), verts=6))
        parts.append(torus(army, 'accent', 0.06, 0.01, (0, -0.03, 0.6)))
    return finalize(f'p-{army}', parts)

# ---------------------------------------------------------------- rook


def build_rook(army):
    if army == 'ram':
        # jamvant: bear-elder fortress — stocky bear with crenellated collar
        parts = pedestal(army, 0.28)
        fig = humanoid(army, 'main', h=0.46, base_r=0.17, chest_r=0.115, arm_r=0.045,
                       l_hand=(0.1, -0.14, 0.38), r_hand=(-0.1, -0.14, 0.38),
                       l_elbow=(0.19, -0.05, 0.42), r_elbow=(-0.19, -0.05, 0.42))
        fig.location.z = 0.1
        parts.append(fig)
        # bear head: broad skull bigger than the chest + muzzle + round ears
        parts.append(sphere(army, 'main', 0.12, (0, 0, 0.72), scale=(1, 0.95, 0.9)))
        parts.append(sphere(army, 'main', 0.052, (0, -0.105, 0.68), seg=12, rings=10))
        for dx in (-0.09, 0.09):
            parts.append(sphere(army, 'main', 0.035, (dx, 0.01, 0.82), seg=10, rings=8))
        # fortress collar: gold ring + temple blocks. Lowered clear of the
        # head (bottom ~z 0.612) and blocks pushed out to straddle the ring
        # like crenellations — they used to interpenetrate both.
        parts.append(torus(army, 'accent', 0.135, 0.017, (0, 0, 0.535)))
        n = 6
        for i in range(n):
            a = i / n * math.pi * 2
            parts.append(box(army, 'accent', (0.05, 0.035, 0.05),
                             (math.cos(a) * 0.158, math.sin(a) * 0.158, 0.565), (0, 0, a)))
        # belt: was major 0.1 — swallowed inside the skirt (radius ~0.127 there)
        parts.append(torus(army, 'accent', 0.128, 0.015, (0, 0, 0.205)))
        return finalize('r-ram', parts)
    # kumbhakarna: colossal drowsy giant, tower-broad
    parts = pedestal(army, 0.3)
    fig = humanoid(army, 'main', h=0.56, base_r=0.19, chest_r=0.15, arm_r=0.05,
                   l_hand=(0.2, -0.1, 0.24), r_hand=(-0.2, -0.1, 0.24),
                   l_elbow=(0.235, -0.02, 0.42), r_elbow=(-0.235, -0.02, 0.42))
    fig.location.z = 0.1
    parts.append(fig)
    # belly
    parts.append(sphere(army, 'main', 0.115, (0, -0.05, 0.42), scale=(1, 0.85, 1)))
    parts.append(head_with(army, 0.76, 0.095))
    # tusks + heavy brow
    for sx in (-1, 1):
        parts.append(cone(army, 'accent', 0.014, 0.05, (sx * 0.04, -0.085, 0.72), (0.35, 0, 0), verts=8))
    # spiked crown ring
    parts.append(torus(army, 'accent', 0.085, 0.016, (0, 0, 0.83)))
    for i in range(5):
        a = i / 5 * math.pi * 2
        parts.append(cone(army, 'accent', 0.016, 0.07, (math.cos(a) * 0.07, math.sin(a) * 0.07, 0.875), verts=8))
    parts.append(torus(army, 'accent', 0.12, 0.015, (0, 0, 0.24)))
    return finalize('r-lanka', parts)

# ---------------------------------------------------------------- knight


def build_knight(army):
    parts = pedestal(army, 0.26)
    # horse: chest rising from pedestal, arched swan neck, alert head — faces -Y
    horse = skin_figure(army, 'main', {
        'base': (0, 0.03, 0.1),
        'chest': (0, 0.01, 0.28),
        'neck1': (0, -0.005, 0.45),
        'neck2': (0, -0.045, 0.60),
        'neck3': (0, -0.105, 0.72),
        'poll': (0, -0.175, 0.775),
        'head': (0, -0.245, 0.73),
        'muzzle': (0, -0.325, 0.685),
    }, [('base', 'chest'), ('chest', 'neck1'), ('neck1', 'neck2'), ('neck2', 'neck3'),
        ('neck3', 'poll'), ('poll', 'head'), ('head', 'muzzle')],
        {'base': 0.125, 'chest': 0.105, 'neck1': 0.085, 'neck2': 0.07,
         'neck3': 0.058, 'poll': 0.046, 'head': 0.05, 'muzzle': 0.032}, 'base')
    horse.location.z = 0.06
    parts.append(horse)
    # jaw + ears
    parts.append(sphere(army, 'main', 0.042, (0, -0.225, 0.76), seg=12, rings=10))
    for dx in (-0.032, 0.032):
        parts.append(cone(army, 'main', 0.015, 0.07, (dx, -0.14, 0.9), (0.3, 0, dx * 5), verts=8))
    # mane ridge down the back of the neck
    mane = skin_figure(army, 'accent', {
        'm0': (0, 0.115, 0.30), 'm1': (0, 0.10, 0.50), 'm2': (0, 0.045, 0.66), 'm3': (0, -0.035, 0.80),
    }, [('m0', 'm1'), ('m1', 'm2'), ('m2', 'm3')],
        {'m0': 0.034, 'm1': 0.03, 'm2': 0.026, 'm3': 0.018}, 'm0', levels=1)
    mane.location.z = 0.06
    parts.append(mane)
    # bridle band around the nose
    parts.append(torus(army, 'accent', 0.042, 0.008, (0, -0.29, 0.755), (0.5, 0, 0), maj_seg=18))
    if army == 'ram':
        # lakshman's quiver against the shoulder, with a proper sheaf of
        # arrows rising out of its mouth (the old version had two tiny cones
        # floating beside the quiver — invisible at game scale)
        quiver_rot = (0.45, 0, -0.3)
        parts.append(cyl(army, 'accent', 0.032, 0.036, 0.2, (0.085, 0.09, 0.42), quiver_rot, verts=10))
        parts.append(torus(army, 'accent', 0.036, 0.006, (0.073, 0.053, 0.51), quiver_rot, maj_seg=14))
        # arrows stand more upright than the quiver bore (euler X ~0.28 vs
        # 0.45 — at the bore's full forward tilt the tallest tips would graze
        # the horse's neck) and each leans its own way, so the sheaf reads as
        # a fan of separate arrows instead of one long tube continuing the
        # quiver. The angle spread is swallowed inside the 0.032 bore radius.
        from mathutils import Euler
        mouth = Vector((0.073, 0.053, 0.505))
        side = Vector((0.9553, -0.2955, 0.0))    # perpendicular, across the mouth
        for dx, dy, up, rx, rz in (
            (-0.016, 0.004, 0.125, 0.21, -0.42),
            (0.013, 0.008, 0.155, 0.31, -0.20),
            (0.0, -0.011, 0.145, 0.36, -0.32),
            (0.016, -0.005, 0.112, 0.23, -0.25),
        ):
            rot = (rx, 0, rz)
            aax = Euler(rot).to_matrix() @ Vector((0, 0, 1))
            base = mouth + side * dx + aax.cross(side) * dy
            mid = base + aax * (up / 2 - 0.05)   # shaft sinks 0.05 into the quiver
            parts.append(cyl(army, 'accent', 0.005, 0.005, up + 0.1, tuple(mid), rot, verts=6))
            tip = base + aax * up
            # fletching: feather taper just under the nock
            parts.append(cone(army, 'accent', 0.015, 0.052, tuple(tip - aax * 0.034), rot, verts=6))
            parts.append(sphere(army, 'accent', 0.007, tuple(tip), seg=8, rings=6))
        # strung bow resting against the left flank — lakshman's iconic pairing
        bj, be, br = {}, [], {}
        n = 7
        for i in range(n):
            t = i / (n - 1) * 2 - 1
            bj[f'v{i}'] = (-0.105 - (1 - t * t) * 0.052, 0.10 + t * 0.02, 0.51 + t * 0.21)
            br[f'v{i}'] = 0.011 - abs(t) * 0.005
            if i:
                be.append((f'v{i - 1}', f'v{i}'))
        parts.append(skin_figure(army, 'accent', bj, be, br, 'v3', levels=1))
        parts.append(cyl(army, 'accent', 0.0035, 0.0035, 0.421, (-0.105, 0.10, 0.51), (-0.095, 0, 0), verts=6))
    else:
        # indrajit's serpent coiled around the neck, hood raised by the cheek
        parts.append(torus(army, 'accent', 0.098, 0.02, (0, 0.0, 0.42), (0.2, 0, 0), maj_seg=24))
        parts.append(torus(army, 'accent', 0.082, 0.017, (0, -0.015, 0.52), (0.32, 0, 0), maj_seg=24))
        parts.append(sphere(army, 'accent', 0.03, (0.085, -0.17, 0.7), scale=(1.35, 0.6, 1.55), seg=12, rings=10))
    return finalize(f'n-{army}', parts)

# ---------------------------------------------------------------- bishop


def build_bishop(army):
    parts = pedestal(army, 0.25)
    if army == 'ram':
        # hanuman: mid-stride devotion — gada raised high, tail arcing over
        fig = humanoid(army, 'main', h=0.62, base_r=0.14, chest_r=0.098, arm_r=0.034,
                       l_hand=(0.17, -0.02, 0.86), l_elbow=(0.2, -0.05, 0.68),
                       r_hand=(-0.05, -0.13, 0.5), r_elbow=(-0.17, -0.07, 0.55))
        fig.location.z = 0.1
        parts.append(fig)
        parts.append(head_with(army, 0.79, 0.082))
        parts.append(sphere(army, 'main', 0.034, (0, -0.07, 0.775), seg=12, rings=8))  # muzzle
        parts.append(torus(army, 'accent', 0.068, 0.013, (0, 0, 0.845)))  # crown band
        parts.append(cone(army, 'accent', 0.035, 0.07, (0, 0, 0.895), verts=12))
        # gada in the raised left hand, finial crowned with a flame tip —
        # a nod to the burning of Lanka
        parts.append(cyl(army, 'accent', 0.016, 0.02, 0.24, (0.19, -0.02, 0.98), (0, 0.12, 0), verts=10))
        parts.append(sphere(army, 'accent', 0.07, (0.205, -0.02, 1.12)))
        parts.append(cone(army, 'accent', 0.024, 0.055, (0.21, -0.02, 1.2), verts=10))
        parts.append(sphere(army, 'accent', 0.017, (0.211, -0.02, 1.245), scale=(0.75, 0.75, 1.5), seg=10, rings=8))
        # tail: high arc behind, curling forward over the head
        tail = skin_figure(army, 'main', {
            't0': (0, 0.12, 0.14), 't1': (0, 0.2, 0.45), 't2': (0, 0.17, 0.78),
            't3': (0, 0.06, 0.95), 't4': (-0.02, -0.04, 0.9),
        }, [('t0', 't1'), ('t1', 't2'), ('t2', 't3'), ('t3', 't4')],
            {'t0': 0.032, 't1': 0.027, 't2': 0.022, 't3': 0.017, 't4': 0.012}, 't0')
        tail.location.z = 0.1
        parts.append(tail)
        # chest band
        parts.append(torus(army, 'accent', 0.1, 0.012, (0, -0.01, 0.62), (0.15, 0, 0)))
        return finalize('b-ram', parts)
    # ahiravan: hooded sorcerer of the netherworld with trident
    fig = humanoid(army, 'main', h=0.6, base_r=0.145, chest_r=0.09, arm_r=0.03,
                   l_hand=(0.14, -0.1, 0.62), l_elbow=(0.17, -0.04, 0.5))
    fig.location.z = 0.1
    parts.append(fig)
    # hood: smooth cowl rising to a point
    hood = cone(army, 'main', 0.105, 0.34, (0, 0.01, 0.88), verts=14)
    subsurf(hood, 1)
    parts.append(bake(hood))
    parts.append(sphere(army, 'main', 0.07, (0, -0.035, 0.76), seg=14, rings=10))
    # glowing eyes hint: tiny accent gems
    for dx in (-0.028, 0.028):
        parts.append(sphere(army, 'accent', 0.011, (dx, -0.095, 0.77), seg=8, rings=6))
    parts.extend(trident(army, 0.155, 0.36, h=0.48))
    parts.append(torus(army, 'accent', 0.09, 0.012, (0, 0, 0.68)))
    return finalize('b-lanka', parts)

# ---------------------------------------------------------------- queen


def build_queen(army):
    parts = pedestal(army, 0.26)
    if army == 'ram':
        # sita ji: serene, hands joined, lotus crown, long braid
        fig = humanoid(army, 'main', h=0.72, base_r=0.15, chest_r=0.09, arm_r=0.028,
                       l_hand=(0.015, -0.115, 0.56), r_hand=(-0.015, -0.115, 0.56),
                       l_elbow=(0.13, -0.05, 0.6), r_elbow=(-0.13, -0.05, 0.6))
        fig.location.z = 0.1
        parts.append(fig)
        parts.append(head_with(army, 0.9, 0.08))
        # lotus crown
        parts.append(torus(army, 'accent', 0.062, 0.012, (0, 0, 0.955)))
        for i in range(8):
            a = i / 8 * math.pi * 2
            parts.append(cone(army, 'accent', 0.018, 0.07,
                              (math.cos(a) * 0.05, math.sin(a) * 0.05, 1.0),
                              (math.sin(a) * 0.35, -math.cos(a) * 0.35, 0), verts=8))
        parts.append(sphere(army, 'accent', 0.02, (0, 0, 1.03), seg=10, rings=8))
        # lotus blossom cradled at the joined hands. The figure object sits at
        # location.z = 0.1, so world hand height is the joint's 0.56 + 0.1 —
        # raw parts like this one must use world coords.
        parts.append(sphere(army, 'accent', 0.028, (0, -0.13, 0.662), scale=(1, 1, 0.75), seg=12, rings=8))
        for i in range(6):
            a = i / 6 * math.pi * 2
            parts.append(cone(army, 'accent', 0.012, 0.045,
                              (math.cos(a) * 0.026, -0.13 + math.sin(a) * 0.026, 0.684),
                              (math.sin(a) * 0.55, -math.cos(a) * 0.55, 0), verts=6))
        # braid down the back
        braid = skin_figure(army, 'main', {
            'b0': (0, 0.075, 0.88), 'b1': (0, 0.1, 0.6), 'b2': (0, 0.09, 0.36),
        }, [('b0', 'b1'), ('b1', 'b2')], {'b0': 0.028, 'b1': 0.024, 'b2': 0.014}, 'b0', levels=1)
        braid.location.z = 0.1
        parts.append(braid)
        parts.append(torus(army, 'accent', 0.065, 0.01, (0, -0.01, 0.82)))  # necklace
        return finalize('q-ram', parts)
    # mandodari: regal and sharp — winged shoulders, spiked coronet
    fig = humanoid(army, 'main', h=0.72, base_r=0.155, chest_r=0.09, arm_r=0.028,
                   l_hand=(0.12, -0.11, 0.5), r_hand=(-0.12, -0.11, 0.5))
    fig.location.z = 0.1
    parts.append(fig)
    parts.append(head_with(army, 0.9, 0.08))
    for sx in (-1, 1):
        parts.append(cone(army, 'main', 0.04, 0.12, (sx * 0.15, 0.02, 0.78), (0, sx * 1.1, 0), verts=8))
    parts.append(torus(army, 'accent', 0.062, 0.012, (0, 0, 0.955)))
    for i in range(6):
        a = i / 6 * math.pi * 2
        parts.append(cone(army, 'accent', 0.014, 0.085,
                          (math.cos(a) * 0.048, math.sin(a) * 0.048, 1.005), verts=8))
    parts.append(sphere(army, 'accent', 0.016, (0, -0.075, 0.9), seg=10, rings=8))  # brow gem
    parts.append(torus(army, 'accent', 0.065, 0.01, (0, -0.01, 0.82)))
    return finalize('q-lanka', parts)

# ---------------------------------------------------------------- king


def build_king(army):
    parts = pedestal(army, 0.28)
    if army == 'ram':
        # shri ram: tall, serene, kodanda bow planted at his side
        fig = humanoid(army, 'main', h=0.8, base_r=0.16, chest_r=0.098, arm_r=0.03,
                       l_hand=(0.27, -0.02, 0.64),                      # holds the bow grip
                       l_elbow=(0.2, -0.06, 0.5),
                       r_hand=(-0.14, -0.12, 0.68), r_elbow=(-0.16, -0.05, 0.62))  # blessing hand
        fig.location.z = 0.1
        parts.append(fig)
        parts.append(head_with(army, 0.99, 0.085))
        parts.extend(mukut(army, 1.05, r=0.08, tall=0.13))
        parts.extend(bow(army, 0.16, 0.64, 0.8))
        parts.append(torus(army, 'accent', 0.07, 0.011, (0, -0.01, 0.9)))   # necklace
        parts.append(torus(army, 'accent', 0.085, 0.012, (0, 0, 0.52)))     # sash
        # prabhavali: slim golden halo ring behind the crown, flame finial on
        # top — the classic temple-idol aura
        parts.append(torus(army, 'accent', 0.155, 0.009, (0, 0.075, 1.05), (math.pi / 2, 0, 0), maj_seg=28))
        parts.append(cone(army, 'accent', 0.014, 0.05, (0, 0.075, 1.235), verts=8))
        return finalize('k-ram', parts)
    # ravana: broad-shouldered demon king, fan of ten heads
    fig = humanoid(army, 'main', h=0.78, base_r=0.17, chest_r=0.115, arm_r=0.036,
                   l_hand=(0.16, -0.12, 0.6), r_hand=(-0.16, -0.12, 0.6))
    fig.location.z = 0.1
    parts.append(fig)
    parts.append(head_with(army, 0.98, 0.088))
    # ten heads: two stacked tiers fanned behind the main head (5 + 4 + the
    # sculpted centre head = a true ten), each fan head wearing a small crown
    for cnt, rr, zz, sr in ((5, 0.125, 0.97, 0.038), (4, 0.085, 1.055, 0.031)):
        for i in range(cnt):
            a = (i / (cnt - 1) - 0.5) * math.pi * 0.9
            hx = math.sin(a) * rr
            parts.append(sphere(army, 'main', sr, (hx, 0.08, zz), seg=10, rings=8))
            parts.append(cone(army, 'accent', sr * 0.55, sr * 0.9, (hx, 0.08, zz + sr * 1.1), verts=6))
    # ember prabha arc ringing the head fan
    parts.append(torus(army, 'accent', 0.165, 0.008, (0, 0.115, 1.01), (math.pi / 2, 0, 0), maj_seg=28))
    # tiered central crown
    parts.append(torus(army, 'accent', 0.075, 0.014, (0, 0, 1.05)))
    parts.append(cyl(army, 'accent', 0.062, 0.045, 0.06, (0, 0, 1.095), verts=12))
    parts.append(cyl(army, 'accent', 0.04, 0.028, 0.05, (0, 0, 1.15), verts=12))
    parts.append(cone(army, 'accent', 0.02, 0.06, (0, 0, 1.2), verts=10))
    for sx in (-1, 1):
        parts.append(cone(army, 'accent', 0.016, 0.06, (sx * 0.055, -0.085, 0.94), (0.4, 0, 0), verts=8))  # tusks
    parts.append(torus(army, 'accent', 0.08, 0.012, (0, -0.01, 0.88)))
    parts.append(torus(army, 'accent', 0.095, 0.013, (0, 0, 0.52)))
    return finalize('k-lanka', parts)

# ---------------------------------------------------------------- build all

BUILDERS = {
    'p': build_pawn, 'r': build_rook, 'n': build_knight,
    'b': build_bishop, 'q': build_queen, 'k': build_king,
}

TARGET_H = {'p': 0.66, 'r': 0.88, 'n': 0.92, 'b': 1.06, 'q': 1.18, 'k': 1.34}

pieces = []
for t, builder in BUILDERS.items():
    for army in ('ram', 'lanka'):
        name = f'{t}-{army}'
        if ONLY and ONLY != name:
            continue
        obj = builder(army)
        # normalize: base exactly at z=0, height exactly the ladder target
        bpy.context.view_layer.update()
        zs = [(obj.matrix_world @ Vector(c))[2] for c in obj.bound_box]
        zmin, zmax = min(zs), max(zs)
        s = TARGET_H[t] / max(0.001, (zmax - zmin))
        obj.scale = (s, s, s)
        obj.location.z -= zmin * s
        pieces.append(obj)

bpy.context.view_layer.update()

# ---------------------------------------------------------------- preview renders

if RENDER_DIR:
    import os
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene = bpy.context.scene
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 480
    scene.render.resolution_y = 640
    scene.render.film_transparent = False

    world = bpy.data.worlds['World'] if 'World' in bpy.data.worlds else bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    # warm mid-grey env so metallic gold has something to reflect
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.28, 0.22, 0.2, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7

    key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))
    key.data.energy = 3.5
    key.data.color = (1.0, 0.85, 0.65)
    key.rotation_euler = (math.radians(55), 0, math.radians(35))
    bpy.context.collection.objects.link(key)
    fill = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'SUN'))
    fill.data.energy = 1.0
    fill.data.color = (0.6, 0.65, 1.0)
    fill.rotation_euler = (math.radians(60), 0, math.radians(-140))
    bpy.context.collection.objects.link(fill)

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.collection.objects.link(cam)
    scene.camera = cam

    # stash: park everything far away, bring back one at a time
    for i, obj in enumerate(pieces):
        obj.location.x = 1000 + i * 10

    for obj in pieces:
        px = obj.location.x
        obj.location.x = 0
        h = TARGET_H[obj.name[0]]
        d = h * 2.6
        for tag, az in (('front', math.radians(-90)), ('three-q', math.radians(-58))):
            el = math.radians(14)
            cam.location = (math.cos(az) * math.cos(el) * d, math.sin(az) * math.cos(el) * d, h * 0.52 + math.sin(el) * d)
            direction = cam.location - Vector((0, 0, h * 0.5))
            cam.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
            scene.render.filepath = os.path.join(RENDER_DIR, f'{obj.name}-{tag}.png')
            bpy.ops.render.render(write_still=True)
        obj.location.x = px

    # army line-ups
    for army in ('ram', 'lanka'):
        row = [o for o in pieces if o.name.endswith(army)]
        order = ['p', 'r', 'n', 'b', 'q', 'k']
        row.sort(key=lambda o: order.index(o.name[0]))
        for i, o in enumerate(row):
            o.location.x = (i - 2.5) * 0.85
            o.location.y = 0
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 520
        d = 7.2
        el = math.radians(10)
        cam.location = (0, -math.cos(el) * d, 0.7 + math.sin(el) * d)
        direction = cam.location - Vector((0, 0, 0.62))
        cam.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(RENDER_DIR, f'lineup-{army}.png')
        bpy.ops.render.render(write_still=True)
        for o in row:
            o.location.x = 1000

# ---------------------------------------------------------------- export

if EXPORT_PATH:
    for obj in pieces:
        obj.location.x = 0
        obj.location.y = 0
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=EXPORT_PATH,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )
    print('EXPORTED', EXPORT_PATH, 'pieces:', len(pieces))

print('DONE', [o.name for o in pieces])
