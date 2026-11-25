"""Tavern environment: room back layer, front layer (bar counter), close-up wall, long tables, fire frames, HUD icons."""
import random
from pixgen import Layer, dark, light, mix, inside, to_svg, sheet_svg, to_png, OUT

RW, RH = 560, 200
FLOOR = 150
PL1, PL2, GAP = '#5a3822', '#4d2f1c', '#2c1a10'
BEAM = '#3b2415'
ST = ['#7d7468', '#878072', '#706a5e', '#8f887a']
MORT = '#3e3934'
FL1, FL2, FLG = '#6e4729', '#633f24', '#3a2416'
rnd = random.Random(7)


def wall(L, x0, x1, y0, y1, plank=8):
    for x in range(x0, x1):
        k = (x - x0) // plank
        c = PL1 if k % 2 else PL2
        for y in range(y0, y1):
            col = c
            if (x - x0) % plank == 0: col = GAP
            L.put(x, y, col)
    for _ in range((x1 - x0) // 10):
        x = rnd.randrange(x0 + 2, x1 - 2); y = rnd.randrange(y0 + 4, y1 - 4)
        L.put(x, y, dark(PL1, .35)); L.put(x + 1, y, dark(PL1, .25))


def stones(L, x0, x1, y0, y1):
    for y in range(y0, y1):
        for x in range(x0, x1): L.put(x, y, MORT)
    row = 0; y = y0
    while y < y1:
        h = rnd.choice([7, 8, 9]); x = x0 - (row % 2) * 6
        while x < x1:
            w = rnd.choice([10, 12, 14, 16]); c = rnd.choice(ST)
            for yy in range(y + 1, min(y + h, y1)):
                for xx in range(max(x + 1, x0), min(x + w, x1)):
                    edge_tl = (yy == y + 1) or (xx == x + 1)
                    edge_br = (yy == y + h - 1) or (xx == x + w - 1)
                    col = light(c, .18) if edge_tl else (dark(c, .2) if edge_br else c)
                    L.put(xx, yy, col)
            # round corners
            for (cx, cy) in ((x + 1, y + 1), (x + w - 1, y + 1), (x + 1, y + h - 1), (x + w - 1, y + h - 1)):
                if x0 <= cx < x1 and y0 <= cy < y1: L.put(cx, cy, MORT)
            x += w
        y += h; row += 1


def floor(L, x0, x1, y0, y1):
    y = y0; i = 0
    while y < y1:
        h = 6 if y < y0 + 20 else 7
        c = FL1 if i % 2 else FL2
        c = mix(c, '#8a5a34', min(.35, (y - y0) / 120))
        off = rnd.randrange(0, 60)
        for yy in range(y, min(y + h, y1)):
            for x in range(x0, x1):
                col = c
                if yy == y: col = FLG
                elif (x + off) % 64 == 0: col = FLG
                elif yy == y + 1: col = light(c, .08)
                L.put(x, yy, col)
        y += h; i += 1


def post(L, x, y0, y1, w=6):
    for xx in range(x, x + w):
        for y in range(y0, y1):
            c = BEAM if xx < x + w - 2 else dark(BEAM, .3)
            if xx == x: c = light(BEAM, .15)
            L.put(xx, y, c)


def rect(L, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): L.put(x, y, c)


def door(L, x0, y0, x1, y1):
    cx = (x0 + x1) / 2; r = (x1 - x0) / 2
    # stone arch frame
    for y in range(y0 - 5, y1):
        for x in range(x0 - 5, x1 + 6):
            dy = y - (y0 + r); inarch = (y >= y0 + r) or ((x + .5 - cx) ** 2 + (dy) ** 2 <= (r + 5) ** 2)
            if inarch: L.put(x, y, rnd.choice(['#9a9285', '#8a8376', '#a39b8d']))
    for y in range(y0, y1):
        for x in range(x0, x1 + 1):
            dy = y - (y0 + r)
            if y >= y0 + r or (x + .5 - cx) ** 2 + dy ** 2 <= r ** 2:
                k = (x - x0) // 6
                c = '#7a4a2a' if k % 2 else '#6b4024'
                if (x - x0) % 6 == 0: c = '#3a2214'
                L.put(x, y, c)
    for yb in (y0 + r + 4, y1 - 12):
        for x in range(x0 + 1, x1): L.put(x, yb, '#2e2a28'); L.put(x, yb + 1, '#4a4440')
    for (x, y) in ((x1 - 7, (y0 + y1) // 2 + 6), (x1 - 6, (y0 + y1) // 2 + 7)): L.put(x, y, '#e2b23c')
    L.put(x1 - 7, (y0 + y1) // 2 + 7, '#9a7a2a')


def window(L, x0, y0, w, h, moon=False):
    rect(L, x0 - 3, y0 - 3, x0 + w + 2, y0 + h + 2, '#3b2415')
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            L.put(x, y, mix('#17203d', '#2a3a66', (y - y0) / h))
    for _ in range(6):
        L.put(x0 + rnd.randrange(1, w - 1), y0 + rnd.randrange(1, h - 6), '#dfe6ff')
    if moon:
        for y in range(y0 + 3, y0 + 11):
            for x in range(x0 + w - 12, x0 + w - 4):
                if (x - (x0 + w - 8)) ** 2 + (y - (y0 + 7)) ** 2 <= 13 and not ((x - (x0 + w - 6)) ** 2 + (y - (y0 + 6)) ** 2 <= 9):
                    L.put(x, y, '#f4ecc8')
    mx = x0 + w // 2; my = y0 + h // 2
    for y in range(y0, y0 + h): L.put(mx, y, '#3b2415')
    for x in range(x0, x0 + w): L.put(x, my, '#3b2415')
    rect(L, x0 - 4, y0 + h + 2, x0 + w + 3, y0 + h + 4, '#6b4428')  # sill


def sconce(L, x, y):
    rect(L, x, y + 6, x + 4, y + 7, '#4a4440'); rect(L, x + 1, y + 1, x + 3, y + 5, '#efe0c0')
    L.put(x + 2, y, '#ffd27a'); L.put(x + 2, y - 1, '#fff0b0'); L.put(x + 1, y, '#f2a93b'); L.put(x + 3, y, '#f2a93b')


def notice(L, x0, y0, x1, y1):
    rect(L, x0, y0, x1, y1, '#5e3a1e')
    rect(L, x0 + 2, y0 + 2, x1 - 2, y1 - 2, '#b98a54')
    for _ in range(30): L.put(rnd.randrange(x0 + 3, x1 - 3), rnd.randrange(y0 + 3, y1 - 3), '#a77a46')
    papers = [(x0 + 4, y0 + 4, 12, 14), (x0 + 19, y0 + 5, 14, 10), (x0 + 6, y0 + 21, 10, 13), (x0 + 20, y0 + 18, 13, 16)]
    for (px, py, w, h) in papers:
        rect(L, px, py, px + w, py + h, '#efe0c0')
        for k in range(py + 3, py + h - 1, 3):
            for x in range(px + 2, px + w - 2): L.put(x, k, '#a8987a')
        L.put(px + w // 2, py, '#c8423b')
    # crown sketch on the first paper (leaderboard)
    for (x, y) in ((x0 + 7, y0 + 8), (x0 + 9, y0 + 7), (x0 + 11, y0 + 8), (x0 + 13, y0 + 7), (x0 + 15, y0 + 8)): L.put(x, y, '#c08a1a')
    # header plank
    rect(L, x0 + 6, y0 - 7, x1 - 6, y0 - 1, '#7a4a2a'); rect(L, x0 + 6, y0 - 7, x1 - 6, y0 - 7, '#9a6236')


def stairs(L, xr, xl, yb, yt, steps=10):
    rise = (yb - yt) / steps; run = (xr - xl) / steps
    for i in range(steps):
        ytop = int(yb - rise * (i + 1)); xs = int(xr - run * (i + 1))
        for y in range(ytop, yb):
            for x in range(xs, int(xs + run) + 1):
                c = '#7a4a2a' if y < ytop + 2 else '#4e2f1c'
                if y == ytop: c = '#9a6236'
                L.put(x, y, c)
        for y in range(ytop + 2, yb):
            L.put(xs, y, '#3a2214')
    # stringer + railing
    for i in range(0, int(xr - xl) + 1):
        x = xr - i; y = yb - (yb - yt) * i / (xr - xl)
        for k in range(0, 3): L.put(int(x), int(y) - 18 - k, '#3b2415')
        if i % 7 == 0:
            for k in range(0, 18): L.put(int(x), int(y) - k, '#4a2c19')
    # landing + upstairs door
    rect(L, xl - 8, yt - 2, xl + 10, yt + 3, '#6b4428')
    rect(L, xl - 6, yt - 34, xl + 10, yt - 3, '#3b2415')
    rect(L, xl - 4, yt - 32, xl + 8, yt - 3, '#7a4a2a')
    for y in range(yt - 32, yt - 3): L.put(xl + 2, y, '#5e3a1e')
    L.put(xl + 6, yt - 17, '#e2b23c')


def hearth(L, x0, x1):
    # chimney
    for y in range(8, 100):
        for x in range(x0 + 8, x1 - 8): L.put(x, y, MORT)
    stones(L, x0 + 8, x1 - 8, 8, 100)
    stones(L, x0, x1, 100, FLOOR)
    # mantel
    rect(L, x0 - 3, 96, x1 + 2, 101, '#6b4428'); rect(L, x0 - 3, 96, x1 + 2, 96, '#9a6236'); rect(L, x0 - 3, 101, x1 + 2, 101, '#3b2415')
    # firebox
    fx0, fx1 = x0 + 7, x1 - 7
    for y in range(112, FLOOR):
        for x in range(fx0, fx1):
            top = 112 + max(0, int(((x - (fx0 + fx1) / 2) / ((fx1 - fx0) / 2)) ** 2 * 6))
            if y >= top: L.put(x, y, mix('#0f0805', '#2a140a', (y - 112) / 38))
    # logs
    rect(L, fx0 + 4, FLOOR - 5, fx1 - 4, FLOOR - 3, '#5a3a22'); rect(L, fx0 + 7, FLOOR - 8, fx1 - 9, FLOOR - 6, '#6b4428')
    for x in range(fx0 + 4, fx1 - 4, 5): L.put(x, FLOOR - 4, '#3a2416')


def shelves(L, x0, x1):
    for ys in (52, 74):
        rect(L, x0, ys, x1, ys + 2, '#7a4a2a'); rect(L, x0, ys + 3, x1, ys + 3, '#3b2415')
        x = x0 + 3
        while x < x1 - 6:
            k = rnd.randrange(4)
            if k == 0:   # bottle
                c = rnd.choice(['#2f6b3a', '#6b2f2f', '#2f4f6b', '#8a6a2a'])
                rect(L, x, ys - 10, x + 3, ys - 1, c); rect(L, x + 1, ys - 13, x + 2, ys - 11, c); L.put(x + 1, ys - 13, '#c9b79c'); L.put(x, ys - 8, light(c, .4))
                x += 6
            elif k == 1:  # mug
                rect(L, x, ys - 6, x + 4, ys - 1, '#b8743c'); L.put(x + 5, ys - 4, '#b8743c'); L.put(x + 5, ys - 3, '#b8743c'); rect(L, x, ys - 7, x + 4, ys - 7, '#f5efe2')
                x += 8
            elif k == 2:  # jug
                rect(L, x, ys - 8, x + 5, ys - 1, '#c9874a'); rect(L, x + 1, ys - 10, x + 3, ys - 9, '#c9874a'); x += 8
            else:
                x += 4
    # casks
    for (cx, cy) in ((x0 + 12, 106), (x0 + 34, 106)):
        for y in range(cy - 11, cy + 12):
            for xx in range(cx - 11, cx + 12):
                d = (xx - cx) ** 2 + (y - cy) ** 2
                if d <= 121:
                    c = '#8a5a32'
                    if d > 95: c = '#3b2415'
                    elif abs(xx - cx) in (5, 6) or abs(y - cy) in (5, 6): c = '#6a6258'
                    L.put(xx, y, c)
        L.put(cx, cy, '#e2b23c'); L.put(cx + 1, cy, '#e2b23c')
    rect(L, x0 + 1, 117, x0 + 46, 120, '#4e2f1c')


def wardrobe(L, x0, x1, y0):
    rect(L, x0, y0, x1, FLOOR - 1, '#4e2f1c')
    rect(L, x0 + 2, y0 + 4, x1 - 2, FLOOR - 4, '#7a4a2a')
    mx = (x0 + x1) // 2
    for y in range(y0 + 4, FLOOR - 3): L.put(mx, y, '#3b2415')
    for (a, b) in ((x0 + 4, mx - 2), (mx + 2, x1 - 4)):
        rect(L, a, y0 + 8, b, y0 + 26, '#6b4024'); rect(L, a, y0 + 32, b, FLOOR - 8, '#6b4024')
    L.put(mx - 2, y0 + 30, '#e2b23c'); L.put(mx + 2, y0 + 30, '#e2b23c')
    rect(L, x0 - 2, y0 - 3, x1 + 2, y0, '#9a6236')
    # hanging sign with a pointed hat
    rect(L, mx - 8, y0 - 22, mx + 8, y0 - 9, '#9a6236'); rect(L, mx - 7, y0 - 21, mx + 7, y0 - 10, '#c99a5e')
    for i in range(7):
        for x in range(mx - i // 2 - 1, mx + i // 2 + 1): L.put(x, y0 - 19 + i, '#c8423b')
    L.put(mx - 6, y0 - 23, '#3b2415'); L.put(mx + 6, y0 - 23, '#3b2415')
    for y in range(y0 - 9, y0 - 3): L.put(mx - 6, y, '#3b2415'); L.put(mx + 6, y, '#3b2415')


def lectern(L, x0, yb):
    rect(L, x0 + 6, yb - 22, x0 + 10, yb - 1, '#5e3a1e'); rect(L, x0 + 2, yb - 2, x0 + 14, yb, '#4e2f1c')
    for i in range(6): rect(L, x0 - 1 + i // 3, yb - 28 + i, x0 + 17 - i // 3, yb - 28 + i, '#7a4a2a')
    rect(L, x0, yb - 33, x0 + 16, yb - 29, '#efe0c0'); L.put(x0 + 8, yb - 33, '#a8987a')
    for x in range(x0 + 2, x0 + 7): L.put(x, yb - 31, '#a8987a')
    for x in range(x0 + 10, x0 + 15): L.put(x, yb - 31, '#a8987a')
    L.put(x0 + 14, yb - 37, '#f6efe2'); L.put(x0 + 13, yb - 36, '#f6efe2'); L.put(x0 + 12, yb - 35, '#f6efe2')


def room_back():
    L = Layer(RW, RH)
    wall(L, 0, RW, 8, 118)
    stones(L, 0, RW, 118, FLOOR)
    floor(L, 0, RW, FLOOR, RH)
    rect(L, 0, 0, RW - 1, 7, BEAM); rect(L, 0, 7, RW - 1, 7, dark(BEAM, .3))
    for x in (0, 120, 168, 392, 448, 554): post(L, x, 8, FLOOR)
    window(L, 236, 40, 26, 34, moon=True); window(L, 308, 40, 26, 34)
    door(L, 12, 84, 46, FLOOR)
    stairs(L, 118, 74, FLOOR, 82)
    notice(L, 128, 66, 164, 104)
    for (x, y) in ((186, 70), (290, 70), (374, 70)): sconce(L, x, y)
    hearth(L, 398, 446)
    shelves(L, 456, 532)
    wardrobe(L, 534, 556, 84)
    lectern(L, 52, 174)
    # crates near the door
    for (x, y) in ((2, 150), (2, 138)):
        rect(L, x, y, x + 9, y + 11, '#8a5a32'); rect(L, x, y, x + 9, y, '#a87444')
        for k in range(x, x + 10): L.put(k, y + 5, '#5e3a1e')
    return L


def room_front():
    L = Layer(RW, RH)
    x0, x1 = 452, 534
    rect(L, x0, 122, x1, 126, '#9a6236'); rect(L, x0, 122, x1, 122, '#c08a50'); rect(L, x0, 127, x1, 128, '#3b2415')
    rect(L, x0 + 2, 129, x1 - 2, 172, '#6b4024')
    for px in range(x0 + 4, x1 - 8, 16):
        rect(L, px, 133, px + 12, 166, '#7a4a2a'); rect(L, px + 2, 135, px + 10, 164, '#5e3a1e')
        rect(L, px + 3, 136, px + 9, 136, '#8a5a32')
    rect(L, x0, 172, x1, 174, '#3b2415')
    return L


def table_long(w, h=40, top='#9a6236', edge='#5e3a1e', trim=None):
    L = Layer(w, h)
    for lx in (6, w // 2 - 2, w - 11):
        rect(L, lx, 12, lx + 4, h - 2, edge)
        rect(L, lx + 3, 12, lx + 4, h - 2, dark(edge, .25))
    for y in range(2, 13):
        for x in range(1, w - 1):
            c = top
            if y <= 3: c = light(top, .18)
            if y >= 10: c = trim if (trim and y == 10) else dark(top, .22)
            L.put(x, y, c)
    for _ in range(w // 12):
        x = rnd.randrange(4, w - 6); y = rnd.randrange(4, 9); L.put(x, y, dark(top, .15)); L.put(x + 1, y, dark(top, .15))
    return L.outline()


def closeup_wall(w=320, h=150):
    L = Layer(w, h)
    wall(L, 0, w, 6, 96)
    stones(L, 0, w, 96, 124)
    floor(L, 0, w, 124, h)
    rect(L, 0, 0, w - 1, 5, BEAM)
    for x in (0, 150, 314): post(L, x, 6, 124)
    window(L, 22, 22, 28, 36, moon=True)
    sconce(L, 74, 40); sconce(L, 270, 40)
    return L


def fire_frames():
    frames = []
    for f in range(3):
        L = Layer(32, 28)
        rr = random.Random(f * 13 + 1)
        for x in range(4, 28):
            hcol = 10 + int(10 * (1 - abs(x - 16) / 12)) + rr.randrange(-3, 4)
            for k in range(hcol):
                y = 27 - k
                t = k / max(hcol, 1)
                c = '#ffe9a8' if t < .25 and abs(x - 16) < 6 else ('#ffb04a' if t < .55 else ('#f2622a' if t < .85 else '#b8302a'))
                L.put(x, y, c)
        for _ in range(4): L.put(rr.randrange(8, 24), rr.randrange(0, 8), '#ffb04a')
        frames.append([L])
    return frames


def ember_frames():
    L = Layer(32, 28)
    for x in range(6, 26):
        for y in range(23, 28):
            if rnd.random() < .7: L.put(x, y, rnd.choice(['#b8302a', '#f2622a', '#5a2a1a', '#3a1a10']))
    return [[L]]


def icons():
    I = {}
    # coin pouch 16x16
    L = Layer(16, 16)
    L.ellipse(8, 10.5, 6, 5, '#8a5a32'); L.rect(5, 3, 11, 5, '#8a5a32', shade=False)
    for x in range(5, 12): L.put(x, 6, '#e2b23c')
    L.ellipse(8, 2.5, 2.5, 1.5, '#e8b83a', shade=False); I['pouch'] = L.outline()
    L = Layer(16, 16)
    L.poly([(8, 0.5), (10, 5.5), (15.5, 6), (11.5, 9.5), (12.8, 15), (8, 12), (3.2, 15), (4.5, 9.5), (0.5, 6), (6, 5.5)], '#f2c94c'); I['star'] = L.outline()
    L = Layer(16, 16)
    L.poly([(8, 0.5), (12, 6), (13, 11), (10, 15.5), (6, 15.5), (3, 11), (4, 6), (6, 8)], '#f2622a', shade=False)
    L.poly([(8, 6), (10.5, 10), (10, 14.5), (6, 14.5), (5.5, 11)], '#ffd27a', shade=False); I['flame'] = L.outline()
    L = Layer(16, 16)
    L.ellipse(8, 8, 5.5, 5.5, '#a8a29a'); L.ellipse(8, 8, 2, 2, '#4a4440', shade=False, hi=False)
    for (x, y) in ((8, 1), (8, 14), (1, 8), (14, 8), (3, 3), (12, 12), (3, 12), (12, 3)):
        L.put(x, y, '#a8a29a'); L.put(x + (1 if x < 8 else 0), y, '#a8a29a')
    I['gear'] = L.outline()
    L = Layer(16, 16)
    L.rect(3, 2, 12, 13, '#efe0c0', shade=False); L.rect(2, 1, 13, 2, '#c9a86a', shade=False); L.rect(2, 13, 13, 14, '#c9a86a', shade=False)
    for (x, y) in ((6, 5), (7, 4), (8, 4), (9, 5), (9, 6), (8, 7), (8, 8), (8, 10)): L.put(x, y, '#5e3a1e')
    I['help'] = L.outline()
    L = Layer(16, 16)
    L.ellipse(8, 8, 6.5, 6.5, '#b8302a'); L.ellipse(8, 8, 3.5, 3.5, '#8e2420', shade=False, hi=False)
    L.poly([(8, 5), (10.5, 10), (5.5, 10)], '#d84a3a', shade=False); I['seal'] = L.outline()
    return I


if __name__ == '__main__':
    from PIL import Image
    b = room_back(); f = room_front()
    im = to_png([b, f], 3); im.save('room.png'); print(im.size)
