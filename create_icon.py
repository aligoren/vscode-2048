#!/usr/bin/env python3
"""
Simple script to create a 128x128 icon for the 2048 extension
Requires PIL (Pillow): pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_2048_icon():
    # Create a 128x128 image with transparent background
    size = 128
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors inspired by 2048 game
    bg_color = (238, 228, 218)  # Light beige background
    tile_color = (237, 194, 46)  # Gold color for 2048 tile
    text_color = (119, 110, 101)  # Dark brown text
    
    # Draw rounded rectangle background
    margin = 8
    draw.rounded_rectangle(
        [margin, margin, size-margin, size-margin], 
        radius=12, 
        fill=bg_color
    )
    
    # Draw the "2048" tile in the center
    tile_size = 80
    tile_x = (size - tile_size) // 2
    tile_y = (size - tile_size) // 2
    
    draw.rounded_rectangle(
        [tile_x, tile_y, tile_x + tile_size, tile_y + tile_size],
        radius=8,
        fill=tile_color
    )
    
    # Try to use a system font, fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 24)
        except:
            font = ImageFont.load_default()
    
    # Draw "2048" text
    text = "2048"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2 - 2  # Slight adjustment
    
    draw.text((text_x, text_y), text, fill=text_color, font=font)
    
    # Save the icon
    img.save('icon.png', 'PNG')
    print("Icon created: icon.png")

if __name__ == "__main__":
    create_2048_icon()