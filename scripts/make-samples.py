"""Renders the five Paperstall sample props as photo-like JPEGs (paper / chalkboard, handwriting fonts)."""
import random, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]
F = "C:/Windows/Fonts/"
W, H = 1200, 1500


def font(name, size):
    return ImageFont.truetype(F + name, size)


def noise(img, amount, seed):
    rnd = random.Random(seed)
    px = img.load()
    for _ in range(img.width * img.height // 6):
        x, y = rnd.randrange(img.width), rnd.randrange(img.height)
        r, g, b = px[x, y]
        d = rnd.randint(-amount, amount)
        px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return img


def paper(color=(246, 240, 226), lines=False, seed=1):
    img = Image.new("RGB", (W, H), color)
    d = ImageDraw.Draw(img)
    if lines:
        for y in range(260, H - 80, 72):
            d.line([(60, y), (W - 60, y)], fill=(170, 196, 222), width=2)
        d.line([(150, 0), (150, H)], fill=(222, 150, 150), width=2)
    return noise(img, 10, seed)


def chalkboard(seed=2):
    img = Image.new("RGB", (W, H), (38, 52, 44))
    d = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(140):  # old smudges
        x, y = rnd.randrange(W), rnd.randrange(H)
        r = rnd.randint(40, 160)
        d.ellipse([x - r, y - r // 3, x + r, y + r // 3], fill=(46, 61, 52))
    img = img.filter(ImageFilter.GaussianBlur(18))
    ImageDraw.Draw(img).rectangle([0, 0, W - 1, H - 1], outline=(120, 82, 48), width=40)
    return noise(img, 12, seed)


def write(img, lines, ink, seed):
    """lines: (text, font, x, y, align) — slight per-line wobble like real handwriting."""
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img)
    for text, f, x, y, align in lines:
        dx, dy = rnd.randint(-6, 6), rnd.randint(-4, 4)
        if align == "r":
            x -= d.textlength(text, font=f)
        elif align == "c":
            x -= d.textlength(text, font=f) / 2
        d.text((x + dx, y + dy), text, font=f, fill=ink)
    return img


def priced(rows, f, top, step, left=110, right=W - 110):
    out = []
    for i, (name, price) in enumerate(rows):
        y = top + i * step
        out += [(name, f, left, y, "l"), (price, f, right, y, "r")]
    return out


def photo(img, angle, seed, bg=(92, 78, 64)):
    """Rotate onto a table, add light falloff and a soft blur so it reads as a phone photo."""
    img = img.rotate(angle, expand=True, resample=Image.BICUBIC, fillcolor=bg)
    canvas = Image.new("RGB", (img.width + 160, img.height + 160), bg)
    canvas = noise(canvas, 18, seed + 9)
    canvas.paste(img, (80, 80))
    shade = Image.new("L", canvas.size, 0)
    sd = ImageDraw.Draw(shade)
    for i in range(30):
        sd.rectangle([i * 6, i * 6, canvas.width - i * 6, canvas.height - i * 6], outline=i * 3)
    canvas = Image.composite(canvas, Image.new("RGB", canvas.size, (20, 16, 12)), shade.filter(ImageFilter.GaussianBlur(40)).point(lambda v: 200 + v // 2))
    return canvas.filter(ImageFilter.GaussianBlur(0.8)).resize((canvas.width * 2 // 3, canvas.height * 2 // 3), Image.LANCZOS)


def save(img, name):
    img.save(f"{OUT}/{name}.jpg", quality=84, optimize=True)
    print(name, img.size)


# 1. Coffee cart chalkboard → storefront
chalk = (238, 236, 226)
title, body = font("BRADHITC.TTF", 110), font("Inkfree.ttf", 70)
img = chalkboard()
write(img, [("Rosa's Coffee Cart", title, W / 2, 110, "c")], chalk, 1)
write(img, priced([("Espresso", "$3.00"), ("Latte", "$4.50"), ("Cappuccino", "$4.25"), ("Cold Brew", "$4.75"), ("Chai Latte", "$4.50"),
                   ("Croissant", "$3.50"), ("Blueberry Muffin", "$3.25"), ("Banana Bread", "$3.75")], body, 330, 128), chalk, 2)
write(img, [("oat milk +50c", font("Inkfree.ttf", 52), W / 2, 1380, "c")], (230, 200, 120), 3)
save(photo(img, -2.5, 1), "coffee-cart")

# 2. Freelancer's handwritten bill → invoice
ink = (28, 40, 110)
hand, small = font("segoepr.ttf", 58), font("segoepr.ttf", 46)
img = paper(lines=True, seed=4)
write(img, [("INVOICE", font("segoeprb.ttf", 90), 190, 90, "l"), ("Sam Lee Design", small, W - 90, 120, "r")], ink, 4)
write(img, [("Bill to: Priya Shah, Bloom Florist", hand, 190, 300, "l"), ("priya@bloomflorist.example.com", small, 190, 372, "l"),
            ("Date: 2 Nov 2026    Due: 16 Nov 2026", small, 190, 444, "l")], ink, 5)
write(img, priced([("Logo design", "$350.00"), ("Business cards (200)", "$40.00"), ("Shop sign artwork", "$120.00"), ("Social templates (10)", "$90.00")],
                  hand, 588, 86, left=190, right=W - 90), ink, 6)
write(img, [("Total  $600.00", font("segoeprb.ttf", 66), W - 90, 990, "r"), ("Thank you! Pay by PayPal", small, 190, 1150, "l")], ink, 7)
save(photo(img, 1.8, 2, bg=(150, 132, 112)), "freelancer-bill")

# 3. Piano lessons notice → subscription
ink = (20, 20, 24)
img = paper(color=(250, 246, 236), seed=8)
write(img, [("Piano Lessons", font("BRADHITC.TTF", 120), W / 2, 150, "c"), ("with Ms. Elena", font("Inkfree.ttf", 70), W / 2, 310, "c")], ink, 8)
write(img, [("Beginners & kids welcome", font("Inkfree.ttf", 62), W / 2, 500, "c"),
            ("Weekly 45-min lesson", font("Inkfree.ttf", 72), W / 2, 700, "c"),
            ("$120 / month", font("BRADHITC.TTF", 130), W / 2, 820, "c"),
            ("Sibling lesson  $90 / month", font("Inkfree.ttf", 64), W / 2, 1040, "c"),
            ("First lesson free!", font("Inkfree.ttf", 64), W / 2, 1220, "c")], ink, 9)
d = ImageDraw.Draw(img)
for i in range(7):  # tear-off tabs
    x = 90 + i * 150
    d.line([(x, H - 150), (x, H)], fill=(120, 120, 120), width=2)
save(photo(img, -3.2, 3, bg=(176, 150, 112)), "piano-lessons")

# 4. Phone accessories stall → market check (branded items)
ink = (10, 10, 12)
hand = font("mvboli.ttf", 60)
img = paper(color=(255, 252, 190), seed=10)  # yellow card
write(img, [("PHONE ZONE", font("comicbd.ttf", 104), W / 2, 90, "c"), ("all original - 1 yr warranty", font("comic.ttf", 50), W / 2, 230, "c")], ink, 10)
write(img, priced([("JBL Go 4 speaker", "$49"), ("Anker 10000mAh power bank", "$29"), ("AirPods Pro 2", "$199"), ("Apple 20W USB-C charger", "$19"),
                   ("Samsung 25W charger", "$15"), ("Spigen phone case", "$15"), ("USB-C cable 2m", "$8")], hand, 400, 132, left=90, right=W - 90), ink, 11)
save(photo(img, 2.4, 4, bg=(70, 72, 80)), "phone-accessories")

# 5. Spanish taco stand menu → English storefront
img = chalkboard(seed=12)
cream, yellow = (240, 236, 222), (240, 205, 110)
write(img, [("Tacos Doña Maria", font("BRADHITC.TTF", 112), W / 2, 100, "c"), ("Precios en USD", font("Inkfree.ttf", 52), W / 2, 260, "c")], yellow, 12)
write(img, priced([("Tacos al pastor (3)", "$9"), ("Tacos de carnitas (3)", "$9"), ("Quesadilla de queso", "$7"), ("Elote asado", "$5"),
                   ("Agua de horchata", "$3"), ("Agua de jamaica", "$3"), ("Churros (4)", "$4")], font("Inkfree.ttf", 68), 380, 132), cream, 13)
write(img, [("¡Gracias!", font("BRADHITC.TTF", 90), W / 2, 1330, "c")], yellow, 14)
save(photo(img, 1.5, 5), "taco-stand")
