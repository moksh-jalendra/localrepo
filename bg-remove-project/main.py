from withoutbg import WithoutBG

# Initialize model once
model = WithoutBG.opensource()

# Process image
result = model.remove_background("Anya.jpg")
result.save("photo-withoutbg.png")

# Process with progress callback
def progress(value):
    print(f"Progress: {value * 100:.1f}%")

result = model.remove_background("Anya.jpg", progress_callback=progress)