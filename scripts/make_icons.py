from PIL import Image, ImageDraw, ImageFont

for size in (192, 512):
    image = Image.new("RGB", (size, size), "#1E5AA8")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", int(size * 0.52))
    text = "值"
    box = draw.textbbox((0, 0), text, font=font)
    draw.text(((size - (box[2] - box[0])) / 2, (size - (box[3] - box[1])) / 2 - box[1]), text, fill="#FFFFFF", font=font)
    image.save(f"icons/icon-{size}.png")
