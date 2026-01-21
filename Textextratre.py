from PIL import Image
import pytesseract
import cv2
import numpy as np

def image_to_text_tesseract(image_path):
    try:
      
        image = Image.open(image_path)
        
        
        text = pytesseract.image_to_string(image)
        
        return text.strip()
    
    except Exception as e:
        return f"Error: {str(e)}"

def enhanced_image_to_text(image_path):
    try:
        
        image = cv2.imread(image_path)
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        
        _, thresh = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        
        denoised = cv2.medianBlur(thresh, 3)
        
        pil_image = Image.fromarray(denoised)
        

        custom_config = r'--oem 3 --psm 6'
        text = pytesseract.image_to_string(pil_image, config=custom_config)
        
        return text.strip()
    
    except Exception as e:
        return f"Error: {str(e)}"

# Usage
if __name__ == "__main__":
    image_path = "sample_image.png"
    
    text = image_to_text_tesseract(image_path)
    print("Extracted Text:")
    print(text)
    

    enhanced_text = enhanced_image_to_text(image_path)
    print("\nEnhanced Extraction:")
    print(enhanced_text)
