"""
A police spike strip laid across a lane: a folding accordion of dark steel links with rows of
short spikes, yellow and black end caps with a pull cord. Run after kit.py.

4.0 m wide by 0.06 m high by 0.30 m deep, under 300 triangles, no colliders, no lights.
"""

clear()

STEEL = mat('steel', 0x2e3135, 'metal', tile=1)
SPIKE = mat('spike', 0xa8b0b8, 'metal', tile=1)
YELLOW = mat('cap-yellow', 0xe0ad18, '', tile=1)
BLACK = mat('cap-black', 0x18191b, '', tile=1)
CORD = mat('cord', 0x1a1a1c, '', tile=1)

# End caps
box('cap-base-l', YELLOW, -1.91, 0, 0, 0.18, 0.035, 0.28, bottom=False)
box('cap-bumper-l', BLACK, -1.97, 0, 0, 0.06, 0.04, 0.30, bottom=False)
box('cap-trim-l', BLACK, -1.85, 0, 0, 0.04, 0.038, 0.24, bottom=False)

box('cap-base-r', YELLOW, 1.91, 0, 0, 0.18, 0.035, 0.28, bottom=False)
box('cap-bumper-r', BLACK, 1.97, 0, 0, 0.06, 0.04, 0.30, bottom=False)
box('cap-trim-r', BLACK, 1.85, 0, 0, 0.04, 0.038, 0.24, bottom=False)

box('cord-handle', BLACK, 1.99, 0.01, 0.10, 0.02, 0.025, 0.08, bottom=False)
poly('cord-line', CORD, [
    [(1.99, 0.005, 0.10), (1.99, 0.005, 0.14), (1.92, 0.005, 0.14), (1.92, 0.005, 0.10)],
    [(1.92, 0.005, 0.10), (1.92, 0.005, 0.14), (1.82, 0.005, 0.08), (1.82, 0.005, 0.06)],
])

# Accordion scissor lattice (7 diamond bays across 3.64 m)
N_SECT = 7
x_start = -1.82
x_end = 1.82
dx = (x_end - x_start) / N_SECT
z_span = 0.11

for i in range(N_SECT):
    x0 = x_start + i * dx
    x1 = x0 + dx
    w_bar = 0.024

    b1_lo = [(x0, 0.002, -z_span), (x0 + w_bar, 0.002, -z_span), (x1, 0.002, z_span), (x1 - w_bar, 0.002, z_span)]
    b1_hi = [(x0, 0.016, -z_span), (x0 + w_bar, 0.016, -z_span), (x1, 0.016, z_span), (x1 - w_bar, 0.016, z_span)]
    poly(f'bar1_{i}', STEEL, [
        [b1_hi[0], b1_hi[1], b1_hi[2], b1_hi[3]],
        [b1_lo[0], b1_lo[1], b1_hi[1], b1_hi[0]],
        [b1_lo[1], b1_lo[2], b1_hi[2], b1_hi[1]],
        [b1_lo[2], b1_lo[3], b1_hi[3], b1_hi[2]],
        [b1_lo[3], b1_lo[0], b1_hi[0], b1_hi[3]],
    ])

    b2_lo = [(x0, 0.008, z_span), (x0 + w_bar, 0.008, z_span), (x1, 0.008, -z_span), (x1 - w_bar, 0.008, -z_span)]
    b2_hi = [(x0, 0.022, z_span), (x0 + w_bar, 0.022, z_span), (x1, 0.022, -z_span), (x1 - w_bar, 0.022, -z_span)]
    poly(f'bar2_{i}', STEEL, [
        [b2_hi[0], b2_hi[1], b2_hi[2], b2_hi[3]],
        [b2_lo[0], b2_lo[1], b2_hi[1], b2_hi[0]],
        [b2_lo[1], b2_lo[2], b2_hi[2], b2_hi[1]],
        [b2_lo[2], b2_lo[3], b2_hi[3], b2_hi[2]],
        [b2_lo[3], b2_lo[0], b2_hi[0], b2_hi[3]],
    ])

    # 2 hollow metal spikes per section
    sx1 = x0 + dx * 0.3
    sz1 = -z_span * 0.4
    sy1 = 0.016

    sx2 = x0 + dx * 0.7
    sz2 = z_span * 0.4
    sy2 = 0.022

    for (sx, sy, sz) in [(sx1, sy1, sz1), (sx2, sy2, sz2)]:
        r = 0.014
        tip = (sx, 0.060, sz)
        base = [
            (sx - r, sy, sz - r),
            (sx + r, sy, sz - r),
            (sx + r, sy, sz + r),
            (sx - r, sy, sz + r),
        ]
        poly(f'spike_{i}_{sx:.2f}', SPIKE, [
            [base[0], base[1], tip],
            [base[1], base[2], tip],
            [base[2], base[3], tip],
            [base[3], base[0], tip],
        ])

frame_view()
result = 'spike_strip built'
